/**
 * Analysis over logged DOPE (#64).
 *
 * The app records what was actually dialled; this reads that back and says how
 * much to trust each point, which points disagree with their neighbours, and
 * what the disagreement implies about the solver's inputs.
 *
 * Everything here is a pure function over `DOPELogData[]`. No store, no I/O — so
 * it is testable without a database and reusable by the DOPE-Assisted Aiming
 * feature (#70), which is the stated consumer.
 *
 * ## Why robust statistics rather than mean and standard deviation
 *
 * The thing being detected IS an outlier, and an outlier drags the mean and
 * inflates the standard deviation — so a z-score test partly hides the very
 * point it is looking for. With a handful of logs, one bad entry can pull the
 * threshold past itself.
 *
 * The median and MAD (median absolute deviation) do not move when a single value
 * is extreme, which is the property this needs. MAD is scaled by 1.4826 so that
 * for normally-distributed data it estimates the same quantity as the standard
 * deviation, which keeps the familiar "about 3 sigma" intuition usable.
 */

import { logDistanceInYards } from './distanceUnits';

import type { DOPELogData } from '../models/DOPELog';

/** MAD → standard-deviation-equivalent for normally distributed data. */
const MAD_TO_SIGMA = 1.4826;

/** Modified z-score past which a point is called an outlier. */
const OUTLIER_THRESHOLD = 3.5;

/** How confident we are in a single logged point, and why. */
export interface DOPEConfidence {
  log: DOPELogData;
  /** 0–1. Higher is more trustworthy. */
  score: number;
  /** Human-readable contributors, strongest first. */
  reasons: string[];
}

/** A logged point that disagrees with the trend its neighbours describe. */
export interface DOPEOutlier {
  log: DOPELogData;
  /** Correction the surrounding points imply at this distance. */
  expected: number;
  /** What was actually logged. */
  actual: number;
  /** Modified z-score of the residual. */
  score: number;
}

/** One point on a drop curve fitted to logged data. */
export interface DropCurvePoint {
  distance: number;
  /** Correction in the unit the contributing logs used. */
  correction: number;
  /** How many logs contributed. */
  sampleCount: number;
}

/** How logged DOPE compares with what the solver predicted. */
export interface DropComparison {
  distance: number;
  logged: number;
  calculated: number;
  /** logged − calculated, in the correction unit. */
  difference: number;
}

/** A suggested change to a solver input, derived from logged DOPE. */
export interface InputCorrection {
  /** Suggested new value. */
  suggested: number;
  /** Value the suggestion was derived from. */
  current: number;
  /** 0–1, from the spread and count of the contributing points. */
  confidence: number;
  rationale: string;
}

const median = (values: number[]): number => {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

/**
 * Median absolute deviation, scaled to be comparable with a standard deviation.
 *
 * Returns 0 when every value is identical, which callers must treat as "no
 * spread" rather than dividing by it.
 */
const medianAbsoluteDeviation = (values: number[]): number => {
  const centre = median(values);
  return MAD_TO_SIGMA * median(values.map((v) => Math.abs(v - centre)));
};

/**
 * Confidence in a single logged point, from the evidence the log itself carries.
 *
 * Deliberately NOT a function of how well the point agrees with a model. A log
 * that disagrees with the solver may be the most valuable entry in the set —
 * that disagreement is the whole reason for keeping DOPE. Agreement is scored by
 * `compareToCalculated`; this scores how well-evidenced the observation is.
 */
export const calculateConfidence = (log: DOPELogData): DOPEConfidence => {
  const reasons: string[] = [];
  let score = 0.5;

  const shots = log.shotCount ?? 0;
  if (shots >= 5) {
    score += 0.2;
    reasons.push(`${shots}-shot group`);
  } else if (shots >= 3) {
    score += 0.1;
    reasons.push(`${shots}-shot group`);
  } else if (shots > 0) {
    score -= 0.1;
    reasons.push(`only ${shots} shot${shots === 1 ? '' : 's'}`);
  } else {
    score -= 0.15;
    reasons.push('no shot count recorded');
  }

  if (log.hitCount !== undefined && shots > 0) {
    const hitRate = log.hitCount / shots;
    if (hitRate >= 0.8) {
      score += 0.15;
      reasons.push(`${Math.round(hitRate * 100)}% hits`);
    } else if (hitRate < 0.5) {
      score -= 0.15;
      reasons.push(`${Math.round(hitRate * 100)}% hits`);
    }
  }

  // Group size relative to distance, in MOA — roughly 1 inch per 100 yards.
  //
  // Through logDistanceInYards, because a log holds its distance in its own
  // unit. Using the raw number rated a metric group about 9% tighter than it
  // was, and the rating is what the app tells the shooter about their shooting.
  // (#106)
  if (log.groupSize !== undefined && log.distance > 0) {
    const moa = log.groupSize / (logDistanceInYards(log) / 100);
    if (moa <= 1) {
      score += 0.15;
      reasons.push(`${moa.toFixed(1)} MOA group`);
    } else if (moa > 3) {
      score -= 0.15;
      reasons.push(`${moa.toFixed(1)} MOA group`);
    }
  } else {
    score -= 0.05;
    reasons.push('no group size recorded');
  }

  return { log, score: Math.min(1, Math.max(0, score)), reasons };
};

/**
 * Logged points whose correction disagrees with the trend the others describe.
 *
 * Fits correction against distance by least squares, then applies a modified
 * z-score to the residuals. Needs at least four points: with three, removing one
 * leaves a perfect two-point fit and everything looks like an outlier.
 */
export const detectOutliers = (logs: DOPELogData[]): DOPEOutlier[] => {
  const usable = logs.filter((l) => l.distance > 0);
  if (usable.length < 4) return [];

  const firstPass = fitLine(usable);
  if (!firstPass) return [];

  const flagged = scoreAgainst(usable, firstPass).filter((o) => o.score > OUTLIER_THRESHOLD);
  if (flagged.length === 0) return [];

  // Refit without the flagged points before reporting.
  //
  // The first fit includes the outlier, so the line is dragged toward it and the
  // `expected` it implies is contaminated by the very point being questioned --
  // in a 1 MIL/100yd set with one entry at 12.0, the first pass expects 5.92 at
  // 500 yards where the honest answer is 5.0. Refitting on the inliers makes
  // `expected` mean what it claims: what the OTHER points imply here.
  const flaggedLogs = new Set(flagged.map((o) => o.log));
  const inliers = usable.filter((l) => !flaggedLogs.has(l));

  const refit = inliers.length >= 2 ? fitLine(inliers) : undefined;
  const line = refit ?? firstPass;

  // Spread comes from the INLIER residuals, not from all of them. Against a line
  // refitted on clean points the inliers sit almost exactly on it, so the MAD
  // over the whole set collapses toward zero -- and a zero spread means
  // `scoreAgainst` bails and reports nothing, losing the outlier it had already
  // found. Measuring scatter among the points that agree is also the more
  // meaningful denominator: it asks how far this point is from the trend in
  // units of how tightly the rest hold to it.
  const scored = scoreAgainst(usable, line, inliers);
  const byLog = new Map(scored.map((o) => [o.log, o]));

  return flagged.map((o) => byLog.get(o.log) ?? o).sort((a, b) => b.score - a.score);
};

/**
 * Theil–Sen line through (distance, elevationCorrection).
 *
 * The median of the slopes between every pair of points, rather than least
 * squares. Least squares is what a first draft reaches for and it does not work
 * here: minimising SQUARED error means one wild point dominates the fit, drags
 * the line toward itself, and inflates every other residual — so no single
 * residual looks extreme any more and the outlier hides. That is the classic
 * masking problem, and it showed up immediately on a set with one entry at 80
 * where 8 was expected: least squares reported no outliers at all.
 *
 * Theil–Sen tolerates roughly 29% of the points being arbitrary before the
 * estimate breaks down, which is the property this needs. It is also consistent
 * with the median/MAD used for the spread — fitting non-robustly and then
 * measuring scatter robustly was a half-measure.
 *
 * O(n²) in pair count, which is nothing for the number of DOPE entries anyone
 * logs for one rifle and load.
 */
const fitLine = (logs: DOPELogData[]): { slope: number; intercept: number } | undefined => {
  const slopes: number[] = [];
  for (let i = 0; i < logs.length; i++) {
    for (let j = i + 1; j < logs.length; j++) {
      const dx = logs[j].distance - logs[i].distance;
      // Two logs at the same distance contribute no slope information.
      if (dx === 0) continue;
      slopes.push((logs[j].elevationCorrection - logs[i].elevationCorrection) / dx);
    }
  }

  // Every log at the same distance: no line to fit. Spread at a single distance
  // is a grouping question, not a trend one.
  if (slopes.length === 0) return undefined;

  const slope = median(slopes);
  const intercept = median(logs.map((l) => l.elevationCorrection - slope * l.distance));
  return { slope, intercept };
};

/** Residual-based modified z-score for each log against a fitted line. */
const scoreAgainst = (
  logs: DOPELogData[],
  line: { slope: number; intercept: number },
  spreadFrom: DOPELogData[] = logs
): DOPEOutlier[] => {
  const residualOf = (l: DOPELogData) =>
    l.elevationCorrection - (line.slope * l.distance + line.intercept);

  const residuals = logs.map(residualOf);
  const centre = median(residuals);
  const rawSpread = medianAbsoluteDeviation(spreadFrom.map(residualOf));

  // A perfect fit has zero spread, which happens in two very different
  // situations and must not be collapsed into one answer:
  //
  //   - every point is on the line, so nothing is an outlier;
  //   - the reference points are on the line and something else is far off it,
  //     which is the strongest possible outlier signal.
  //
  // Bailing out would report nothing in both. Instead, substitute a spread small
  // relative to the data so a point on the line still scores 0 while one off it
  // scores far above the threshold -- and, unlike Infinity, several such points
  // still order against each other.
  const spread =
    rawSpread > 0
      ? rawSpread
      : Math.max(...residuals.map((r) => Math.abs(r - centre)), 0) / (OUTLIER_THRESHOLD * 100) ||
        Number.EPSILON;

  return logs.map((log, i) => ({
    log,
    expected: line.slope * log.distance + line.intercept,
    actual: log.elevationCorrection,
    score: Math.abs(residuals[i] - centre) / spread,
  }));
};

/**
 * A drop curve from the logged data itself, rather than from the solver.
 *
 * Averages the corrections logged at each distance. Uses the median rather than
 * the mean for the same reason as above: one mis-keyed entry should not move the
 * curve everyone else is read off.
 */
export const buildDropCurve = (logs: DOPELogData[]): DropCurvePoint[] => {
  const byDistance = new Map<number, number[]>();
  for (const log of logs) {
    if (log.distance <= 0) continue;
    const bucket = byDistance.get(log.distance) ?? [];
    bucket.push(log.elevationCorrection);
    byDistance.set(log.distance, bucket);
  }

  return [...byDistance.entries()]
    .map(([distance, corrections]) => ({
      distance,
      correction: median(corrections),
      sampleCount: corrections.length,
    }))
    .sort((a, b) => a.distance - b.distance);
};

/**
 * Logged corrections against what the solver predicted at the same distances.
 *
 * `calculatedAt` is supplied by the caller so this module stays free of the
 * ballistics engine and its rifle/ammo/atmosphere inputs.
 */
export const compareToCalculated = (
  logs: DOPELogData[],
  calculatedAt: (distance: number) => number | undefined
): DropComparison[] =>
  buildDropCurve(logs)
    .map((point) => {
      const calculated = calculatedAt(point.distance);
      if (calculated === undefined || !Number.isFinite(calculated)) return undefined;
      return {
        distance: point.distance,
        logged: point.correction,
        calculated,
        difference: point.correction - calculated,
      };
    })
    .filter((c): c is DropComparison => c !== undefined);

/**
 * Confidence in a suggested correction: more agreeing points, tighter spread.
 *
 * Saturates at eight points — beyond that, extra samples say more about how
 * often you shoot than about how well the estimate is pinned down.
 */
const suggestionConfidence = (differences: number[]): number => {
  if (differences.length < 2) return 0;
  const countWeight = Math.min(differences.length, 8) / 8;
  const spread = medianAbsoluteDeviation(differences);
  const centre = Math.abs(median(differences));
  // Relative spread: a 0.1 MIL scatter means something different around a 0.2
  // MIL bias than around a 2.0 MIL one.
  const tightness = centre === 0 ? 1 : Math.max(0, 1 - spread / Math.max(centre, 0.1));
  return Math.min(1, countWeight * 0.5 + tightness * 0.5);
};

/**
 * A muzzle-velocity correction implied by logged DOPE sitting consistently above
 * or below the solver's prediction.
 *
 * A single sign of bias that grows with distance is the signature of a wrong
 * muzzle velocity: too slow a figure under-predicts drop everywhere, and by more
 * the further out you go. The scaling below is a first-order approximation, not
 * a solve — it gets you close enough to re-chronograph or re-verify, which is
 * what the suggestion is for.
 *
 * Returns undefined when the evidence does not support a suggestion: fewer than
 * three comparisons, or a bias small enough to be noise.
 */
export const suggestMuzzleVelocity = (
  comparisons: DropComparison[],
  currentMuzzleVelocity: number,
  correctionUnit: 'MIL' | 'MOA' = 'MIL'
): InputCorrection | undefined => {
  if (comparisons.length < 3 || currentMuzzleVelocity <= 0) return undefined;

  const differences = comparisons.map((c) => c.difference);
  const bias = median(differences);

  // Below roughly a tenth of a MIL (or a third of an MOA) the bias is inside
  // normal dialling and reading error.
  const noiseFloor = correctionUnit === 'MIL' ? 0.1 : 0.34;
  if (Math.abs(bias) < noiseFloor) return undefined;

  // More logged drop than predicted => the real velocity is lower than entered.
  const perUnit = correctionUnit === 'MIL' ? 1 : 1 / 3.438;
  const fpsPerUnit = 25; // ~25 fps per 0.1 MIL at mid range, first-order
  const delta = -bias * perUnit * (fpsPerUnit / 0.1);

  return {
    suggested: Math.round(currentMuzzleVelocity + delta),
    current: currentMuzzleVelocity,
    confidence: suggestionConfidence(differences),
    rationale:
      `Logged corrections sit ${bias > 0 ? 'above' : 'below'} the prediction by ` +
      `${Math.abs(bias).toFixed(2)} ${correctionUnit} on average across ` +
      `${comparisons.length} distances. Chronograph before trusting this.`,
  };
};

/**
 * A ballistic-coefficient correction implied by a bias that GROWS with distance.
 *
 * This is what separates a BC error from a muzzle-velocity error. A velocity
 * error shows up early and scales roughly linearly; a BC error is small up close
 * and opens up downrange, because the coefficient governs how fast the bullet
 * sheds speed. So the signal is the slope of the difference against distance,
 * not its average.
 *
 * Needs points at four or more distances spanning at least 300 yards — a bias
 * measured over a narrow band cannot distinguish the two.
 */
export const suggestBallisticCoefficient = (
  comparisons: DropComparison[],
  currentBC: number
): InputCorrection | undefined => {
  if (comparisons.length < 4 || currentBC <= 0) return undefined;

  const distances = comparisons.map((c) => c.distance);
  const span = Math.max(...distances) - Math.min(...distances);
  if (span < 300) return undefined;

  const n = comparisons.length;
  const sumX = distances.reduce((a, d) => a + d, 0);
  const sumY = comparisons.reduce((a, c) => a + c.difference, 0);
  const sumXY = comparisons.reduce((a, c) => a + c.distance * c.difference, 0);
  const sumXX = distances.reduce((a, d) => a + d * d, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return undefined;

  // Difference added per yard of range.
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const overSpan = slope * span;

  // Under a tenth of a unit accumulated across the whole span, there is no
  // distance-dependent signal to act on.
  if (Math.abs(overSpan) < 0.1) return undefined;

  // More drop than predicted, growing with range => the real BC is lower.
  const adjustment = -overSpan * 0.05;
  const suggested = Math.max(0.05, currentBC * (1 + adjustment));

  return {
    suggested: Number(suggested.toFixed(3)),
    current: currentBC,
    confidence: suggestionConfidence(comparisons.map((c) => c.difference)),
    rationale:
      `The gap between logged and calculated widens by ${Math.abs(overSpan).toFixed(2)} ` +
      `across ${Math.round(span)} yards, which points at the drag model rather than ` +
      `muzzle velocity. Verify at distance before adopting.`,
  };
};
