/**
 * How much to believe the DOPE-adjusted recommendation (#161).
 *
 * #168 produces an offset: the weighted mean of what the relevant logs say the
 * solver gets wrong for this shooter. This decides how much of that offset is
 * worth applying, and below a threshold decides not to apply it at all.
 *
 * It is a different quantity from the per-log confidence #112 already shows.
 * `calculateConfidence` scores one observation — was it a five-shot group, did
 * the rounds hit, was it measured. This scores the *recommendation*: whether a
 * set of observations, taken together, says anything reliable about the shot in
 * front of you. A shooter can have six immaculately evidenced logs that flatly
 * disagree with each other, and the honest answer there is that their DOPE does
 * not yet know this load.
 *
 * ## The four factors
 *
 * | factor | asks |
 * |---|---|
 * | `evidence` | how much relevance-weight contributed |
 * | `quality` | how well evidenced those logs are in themselves |
 * | `agreement` | how closely their offsets agree |
 * | `proximity` | how near the nearest of them was shot to today's distance |
 *
 * Each is reported separately, because "confidence is 31%" is not actionable
 * and "your nearest log is 45 yards away" is — it tells the shooter what to go
 * and do about it.
 *
 * ## Why they combine the way they do
 *
 * `evidence` and `quality` are averaged: they are both about how much the
 * evidence is worth, and one can compensate for the other. Three well-measured
 * logs and eight careless ones are genuinely comparable.
 *
 * `agreement` and `proximity` then *multiply* that average, because neither is
 * something more evidence can make up for. If the logs disagree, their mean is
 * not a measurement of anything, and a seventh disagreeing log does not improve
 * it. If every log was shot 60 yards away, none of them vouches for here, and
 * having more of them elsewhere does not change that. An average would let the
 * other three factors outvote exactly the two conditions that should stop the
 * adjustment, which is how a confident-looking wrong number gets dialled.
 *
 * ## Why this replaces #168's `trust` rather than stacking on it
 *
 * `adjustElevation` damps its own offset by `trust = Σw / (Σw + 1)`, which PR
 * #177 called deliberately *not* a confidence score and said #161 would own.
 * `trust` and this module's `evidence` measure the same thing — how much
 * relevance-weight is behind the offset — so multiplying by both would charge
 * the shooter twice for having few logs. {@link applyConfidence} therefore
 * works from `rawOffset`, the undamped weighted mean, and `evidence` carries
 * the job `trust` was doing. It saturates the same way, so #168's requirement
 * that one log cannot move the answer as far as several agreeing ones still
 * holds — see the test that asserts exactly that.
 */

import { logDistanceInYards } from './distanceUnits';
import { calculateConfidence } from './dopeAnalysis';
import { DEFAULT_SIGMA_YARDS } from './dopeMatching';
import { COVERAGE_TOLERANCE_YARDS } from './offsetInterpolation';
import { moaToMil } from './unitConversions';

import type { ElevationAdjustment } from './dopeAdjustment';
import type { MatchableLog } from './dopeMatching';
import type { InterpolatedOffset } from './offsetInterpolation';
import type { DOPELogData } from '../models/DOPELog';

/**
 * Relevance-weight at which `evidence` reaches a half.
 *
 * Two, rather than #168's one, because this figure scales the whole offset
 * where `trust` only damped it. One fully relevant log reaches a third, two
 * reach a half, six reach three quarters, and it never reaches one — the
 * solver always keeps a share, which is the property worth preserving from
 * #168's curve.
 */
export const EVIDENCE_SOFTENING = 2;

/**
 * Spread of offsets, in MIL, at which `agreement` falls to ~0.37.
 *
 * 0.15 MIL is about 5 inches at 600 yards: the point at which two logs are no
 * longer telling you the same thing about a rifle, as against reading the same
 * thing slightly differently. Below it the logs are agreeing within what a
 * shooter can hold; well above it the mean of them is an artefact.
 *
 * Stated in MIL and converted, so a MOA shooter is judged on the same physical
 * spread rather than on a number 3.44 times larger.
 */
export const AGREEMENT_SCALE_MIL = 0.15;

/**
 * Default Gaussian width for `proximity`, in yards.
 *
 * The same sigma `dopeMatching` scores distance similarity with, so a log the
 * matcher called a weak match is not then called a strong basis for a
 * recommendation. At 25 yards away proximity is 0.61; at the 50-yard edge of
 * the default query window it is 0.14.
 */
export const PROXIMITY_SIGMA_YARDS = DEFAULT_SIGMA_YARDS;

/**
 * Gaussian width for `proximity` when the offset was interpolated between two
 * logged distances (#162), in yards.
 *
 * Wider than {@link PROXIMITY_SIGMA_YARDS} because a bracketed value has a
 * measurement on *both* sides of it: being 50 yards from the nearest log means
 * something different when there is another one 50 yards the other way. Half
 * of `COVERAGE_TOLERANCE_YARDS`, so the middle of the widest gap the coverage
 * summary calls "close enough to interpolate between" keeps 0.61 of its
 * proximity, and the middle of a gap twice that wide -- one it tells the
 * shooter to go and practise -- keeps 0.14.
 *
 * An *extrapolated* offset gets the ordinary width. Past the last log there is
 * nothing on the far side, which is exactly the situation a match on one side
 * is in, and `offsetInterpolation` holds the end value on the understanding
 * that this factor, not a decay of its own, is what damps it.
 */
export const INTERPOLATION_SIGMA_YARDS = COVERAGE_TOLERANCE_YARDS / 2;

/** Below this the solver's own answer stands alone. The issue's default. */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.4;

/** Said when there were logs, but not enough agreement or nearness to use them. */
export const LOW_CONFIDENCE_REASON = 'Confidence too low, using solver only';

/** Said when there were no logs at all. */
const NO_LOGS_REASON = 'No relevant logs';

/** How `evidence` and `quality` share the half of the score they between them own. */
const EVIDENCE_SHARE = 0.6;

/** A factor at or below this is named in the reasons as a thing to improve. */
const WEAK = 0.6;

/** Each factor behind the figure, in the order they are explained above. */
export interface ConfidenceFactors {
  /** How much relevance-weight contributed, saturating. */
  evidence: number;
  /** Relevance-weighted mean of the contributing logs' own confidence. */
  quality: number;
  /** How closely the offsets agree. 1 when there is only one of them. */
  agreement: number;
  /** How near the nearest contributing log was shot to the distance asked about. */
  proximity: number;
}

/** Confidence in the adjusted recommendation, and why it is what it is. */
export interface AdjustmentConfidence {
  /** 0–1. What {@link applyConfidence} scales the offset by. */
  score: number;
  factors: ConfidenceFactors;
  /** How many logs are behind it. */
  contributingLogs: number;
  /** Plain-words explanation, weakest factor first. Never empty. */
  reasons: string[];
  /** Spread of the contributing offsets, in the working unit. 0 with one log. */
  spread: number;
  /** Yards from the distance asked about to the nearest contributing log. */
  nearestLogYards: number;
}

/** A spread in `unit`, expressed on the MIL scale {@link AGREEMENT_SCALE_MIL} uses. */
const spreadInMil = (spread: number, unit: 'MIL' | 'MOA'): number =>
  unit === 'MIL' ? spread : moaToMil(spread);

/**
 * Relevance-weighted standard deviation of the offsets.
 *
 * Weighted, so a barely-relevant outlier does not report a disagreement the
 * recommendation does not actually rest on — it contributed little to the mean,
 * so it should unsettle the confidence in that mean by little too.
 */
const weightedSpread = (
  contributions: { weight: number; offset: number }[],
  mean: number
): number => {
  const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0);
  if (!(totalWeight > 0) || contributions.length < 2) return 0;

  const variance =
    contributions.reduce((sum, c) => sum + c.weight * (c.offset - mean) ** 2, 0) / totalWeight;
  return Math.sqrt(variance);
};

/**
 * Relevance-weighted mean of what each contributing log is worth in itself.
 *
 * `calculateConfidence` wants a full `DOPELogData`; the adjustment is generic
 * over anything matchable. A log that does not carry the fields it reads scores
 * neutral there anyway, so the partial case needs no special handling beyond
 * the cast.
 */
const weightedQuality = (contributions: { log: MatchableLog; weight: number }[]): number => {
  const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0);
  if (!(totalWeight > 0)) return 0;

  const weighted = contributions.reduce(
    (sum, c) => sum + c.weight * calculateConfidence(c.log as DOPELogData).score,
    0
  );
  return Math.min(1, Math.max(0, weighted / totalWeight));
};

/** `exp(-x² / 2σ²)`: 1 at no distance, falling smoothly with it. */
const gaussian = (x: number, sigma: number): number => Math.exp(-(x * x) / (2 * sigma * sigma));

/**
 * The four factors as one score. See "Why they combine the way they do" above;
 * shared by matched and interpolated offsets so the two are judged alike.
 */
const combine = ({ evidence, quality, agreement, proximity }: ConfidenceFactors): number => {
  const worth = EVIDENCE_SHARE * evidence + (1 - EVIDENCE_SHARE) * quality;
  const raw = worth * agreement * proximity;
  return Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
};

/** "6 logs agreeing within 0.03 MIL" and the like, weakest thing first. */
const explain = (
  factors: ConfidenceFactors,
  count: number,
  spread: number,
  nearestYards: number,
  unit: 'MIL' | 'MOA'
): string[] => {
  const weak: { factor: number; reason: string }[] = [];

  if (factors.agreement <= WEAK) {
    weak.push({
      factor: factors.agreement,
      reason: `Logs disagree by ${spread.toFixed(2)} ${unit}`,
    });
  }
  if (factors.proximity <= WEAK) {
    weak.push({
      factor: factors.proximity,
      reason: `Nearest log is ${Math.round(nearestYards)} yd away`,
    });
  }
  if (factors.evidence <= WEAK) {
    weak.push({
      factor: factors.evidence,
      reason: `Only ${count} ${count === 1 ? 'log' : 'logs'} to go on`,
    });
  }
  if (factors.quality <= WEAK) {
    weak.push({ factor: factors.quality, reason: 'Contributing logs are thinly evidenced' });
  }

  if (weak.length === 0) {
    return [
      `${count} ${count === 1 ? 'log' : 'logs'} agreeing within ${spread.toFixed(2)} ${unit}`,
    ];
  }

  return weak.sort((a, b) => a.factor - b.factor).map((w) => w.reason);
};

/**
 * Confidence in an adjustment from #168, at the distance it was produced for.
 *
 * `distanceYards` is the shot being aimed, in yards — the same figure the
 * matcher ranked against, so proximity is measured on the scale the ranking
 * used.
 *
 * `proximitySigmaYards` defaults to {@link PROXIMITY_SIGMA_YARDS} and is passed
 * in when the shooter has widened the matching window (#167). It has to move
 * with it: the default is half the *default* window precisely so that a log at
 * the window's edge scores as a weak match, and leaving it fixed while the
 * window widens would mark every newly-admitted log down for being exactly
 * where the shooter asked the app to look.
 */
export const adjustmentConfidence = <T extends MatchableLog>(
  adjustment: ElevationAdjustment<T>,
  distanceYards: number,
  unit: 'MIL' | 'MOA',
  proximitySigmaYards: number = PROXIMITY_SIGMA_YARDS
): AdjustmentConfidence => {
  const { contributions, rawOffset } = adjustment;

  if (contributions.length === 0) {
    return {
      score: 0,
      factors: { evidence: 0, quality: 0, agreement: 0, proximity: 0 },
      contributingLogs: 0,
      reasons: [NO_LOGS_REASON],
      spread: 0,
      nearestLogYards: Number.POSITIVE_INFINITY,
    };
  }

  const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0);
  const evidence = totalWeight / (totalWeight + EVIDENCE_SOFTENING);
  const quality = weightedQuality(contributions);

  const spread = weightedSpread(contributions, rawOffset);
  // One log cannot disagree with itself. Scoring the absent spread as a
  // disagreement would bill a lone log twice for being lone, once here and
  // once in `evidence` -- and #168 requires that a single match still moves
  // the answer.
  const agreement =
    contributions.length < 2 ? 1 : Math.exp(-spreadInMil(spread, unit) / AGREEMENT_SCALE_MIL);

  // The nearest log, not the mean of them: one log on the money vouches for
  // this distance whatever the others were shot at. Each read in yards,
  // because a metric log's raw number is 9% short and would look 55 yards off
  // at 600 (#106).
  // Folded rather than spread into Math.min: `rankMatches` caps matches at
  // DEFAULT_MATCH_LIMIT, but this function is exported and takes any
  // adjustment, and a spread large enough overflows the call stack -- which
  // throws instead of returning a number.
  const nearestLogYards = contributions.reduce(
    (nearest, c) => Math.min(nearest, Math.abs(logDistanceInYards(c.log) - distanceYards)),
    Number.POSITIVE_INFINITY
  );
  const proximity = gaussian(nearestLogYards, proximitySigmaYards);

  const factors = { evidence, quality, agreement, proximity };

  return {
    score: combine(factors),
    factors,
    contributingLogs: contributions.length,
    reasons: explain(factors, contributions.length, spread, nearestLogYards, unit),
    spread,
    nearestLogYards,
  };
};

/** One log behind an interpolated offset, with what it said. */
export interface InterpolationSample {
  log: MatchableLog;
  /** Dialled minus predicted, in the working unit. */
  offset: number;
}

/**
 * Confidence in an offset read off the curve between logged distances (#162),
 * rather than drawn from logs near the shot.
 *
 * The same four factors and the same combination as
 * {@link adjustmentConfidence}, so an interpolated figure clears the same
 * threshold for the same reasons a matched one does. Two of them are measured
 * differently, because the evidence is shaped differently:
 *
 * - **`agreement`** is the spread of offsets *within* each logged distance,
 *   pooled. Across distances the offset is allowed to change -- that change is
 *   the thing being interpolated -- so treating 0.2 at 450 yd and 0.4 at 550 yd
 *   as a disagreement would mark down exactly the curve the value came from.
 *   Three logs at one distance that cannot agree with each other are a
 *   disagreement, and are scored as one.
 * - **`proximity`** is on the gap to the nearest logged distance, with
 *   {@link INTERPOLATION_SIGMA_YARDS} when the value is bracketed and the
 *   ordinary {@link PROXIMITY_SIGMA_YARDS} when it was extrapolated. That is how
 *   "lower confidence the further from a logged distance" is met, and why an
 *   extrapolation is trusted less than an interpolation the same distance from
 *   a log.
 *
 * Every log at the distances the value was drawn from counts once, at weight
 * one: there is no relevance ranking here to weight them by. Logs elsewhere on
 * the curve shaped nothing about this figure and are not counted.
 */
export const interpolationConfidence = (
  interpolation: InterpolatedOffset,
  samplesByDistance: InterpolationSample[][],
  unit: 'MIL' | 'MOA'
): AdjustmentConfidence => {
  const samples = samplesByDistance.flat();
  const count = samples.length;

  const evidence = count / (count + EVIDENCE_SOFTENING);
  const quality = weightedQuality(samples.map(({ log }) => ({ log, weight: 1 })));

  const squares = samplesByDistance.reduce((sum, group) => {
    if (group.length === 0) return sum;
    const mean = group.reduce((total, s) => total + s.offset, 0) / group.length;
    return sum + group.reduce((total, s) => total + (s.offset - mean) ** 2, 0);
  }, 0);
  const spread = count > 0 ? Math.sqrt(squares / count) : 0;
  const agreement = Math.exp(-spreadInMil(spread, unit) / AGREEMENT_SCALE_MIL);

  const sigma =
    interpolation.source === 'interpolated' ? INTERPOLATION_SIGMA_YARDS : PROXIMITY_SIGMA_YARDS;
  const proximity = gaussian(interpolation.nearestLoggedYards, sigma);

  const factors = { evidence, quality, agreement, proximity };

  return {
    score: count > 0 ? combine(factors) : 0,
    factors,
    contributingLogs: count,
    reasons: explain(factors, count, spread, interpolation.nearestLoggedYards, unit),
    spread,
    nearestLogYards: interpolation.nearestLoggedYards,
  };
};

/** An adjustment with #161's confidence applied, ready for the screen. */
export interface ConfidentAdjustment {
  /** `rawOffset * confidence.score`, or 0 when the solver stands alone. */
  offset: number;
  /** The solver's elevation plus {@link offset}. */
  adjustedElevation: number;
  /** True when the threshold was not met, or there was nothing to go on. */
  solverOnly: boolean;
  /** Set only when {@link solverOnly}, and says which of the two it was. */
  reason?: string;
}

/**
 * Scales #168's offset by #161's confidence, or drops it below the threshold.
 *
 * Works from `rawOffset` rather than `offset` on purpose: see "Why this
 * replaces #168's `trust`" at the top of this file. Applying both would damp
 * the same thinness twice.
 */
export const applyConfidence = <T extends MatchableLog>(
  adjustment: ElevationAdjustment<T>,
  confidence: AdjustmentConfidence,
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD
): ConfidentAdjustment => {
  const solverOnly = {
    offset: 0,
    adjustedElevation: adjustment.solverElevation,
    solverOnly: true,
  };

  // Nothing to go on is a different thing from not enough to go on, and the
  // shooter is owed the difference: one says go and shoot this load, the other
  // says your logs do not agree yet.
  if (confidence.contributingLogs === 0) {
    return { ...solverOnly, reason: adjustment.reason };
  }

  if (confidence.score < threshold) {
    return { ...solverOnly, reason: LOW_CONFIDENCE_REASON };
  }

  const offset = adjustment.rawOffset * confidence.score;
  return {
    offset,
    adjustedElevation: adjustment.solverElevation + offset,
    solverOnly: false,
  };
};
