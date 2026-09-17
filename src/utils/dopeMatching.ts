/**
 * Finding the logged DOPE that actually resembles the shot in front of you (#70).
 *
 * This is the first half of DOPE-assisted aiming: given a rifle, a load, a
 * distance and the air you are standing in, pick the entries from the shooter's
 * own history that are worth deriving a correction from. The second half — the
 * offset between what the solver predicted and what was actually dialled — needs
 * these matches to be right before it can be right.
 *
 * Pure. No store, no database, no solver. Every function here is a decision
 * about *which logs count*, and those decisions are the part with the quiet
 * failure modes: a scorer that ranks the wrong entries first still returns an
 * answer, and the correction built on it is wrong by an amount nobody can see.
 *
 * ## Why every factor is neutral rather than zero when data is missing
 *
 * Environment capture, group sizes and timestamps were all added to this app
 * after people had already been logging. A missing field is *unknown*, not
 * *bad*, and scoring it zero would systematically bury a shooter's oldest and
 * often best-earned data. So absent inputs score 0.5 and let the other factors
 * decide, and the one case where zero is right — a distance that does not match
 * — is handled by excluding the log outright rather than by scoring it low.
 */

import { calculateDensityAltitude } from './atmospheric';
import { metersToYards } from './unitConversions';

/** Distance window around the shot, in yards. The default the issue specifies. */
export const DEFAULT_DISTANCE_DELTA = 50;

/**
 * Gaussian width for distance similarity, in yards.
 *
 * Set to half the default delta so a log at the edge of the query window scores
 * exp(-2) ~ 0.14 rather than something close to a direct hit: inside the window
 * is not the same as equally good, and the whole point of scoring after
 * filtering is to say so.
 */
export const DEFAULT_SIGMA_YARDS = DEFAULT_DISTANCE_DELTA / 2;

/** Six months, as the issue specifies. */
export const DEFAULT_RECENCY_HALF_LIFE_DAYS = 182.5;

/** How many matches to derive a correction from. The issue's N = 3-10. */
export const DEFAULT_MATCH_LIMIT = 5;

/**
 * Density altitude difference, in feet, at which two environments score ~0.37.
 *
 * 2000 ft of DA is roughly where the trajectory difference starts to be worth
 * dialling for, so it is the right scale for "these are different conditions".
 */
const DENSITY_ALTITUDE_SCALE = 2000;

/** Group size, in MOA, at which quality has fallen to ~0.37. */
const GROUP_SCALE_MOA = 1.5;

/** Score used when a factor has no data to judge. Neutral, not bad. */
const NEUTRAL = 0.5;

/** The subset of a DOPE log this module reads. */
export interface MatchableLog {
  id?: number;
  rifleId: number;
  ammoId: number;
  distance: number;
  distanceUnit?: 'yards' | 'meters';
  groupSize?: number;
  hitCount?: number;
  shotCount?: number;
  timestamp?: string;
  /** The conditions the log was shot in, when they were captured. */
  environment?: MatchableEnvironment;
}

/** The subset of an environment snapshot this module reads. */
export interface MatchableEnvironment {
  temperature: number;
  pressure: number;
  altitude: number;
  /** Preferred when present: it is the figure the shooter actually saw. */
  densityAltitude?: number;
}

/** The shot being aimed. */
export interface ShotContext {
  rifleId: number;
  ammoId: number;
  /** Yards. */
  distance: number;
  environment?: MatchableEnvironment;
  /** Defaults to now. Injectable so scoring is testable and deterministic. */
  timestamp?: string;
}

/** How much each factor contributes. Any scale: the score is normalised by the total. */
export interface MatchWeights {
  distance: number;
  environment: number;
  recency: number;
  quality: number;
}

/**
 * Distance dominates because it is the factor the correction is most sensitive
 * to; environment is next because density altitude moves the trajectory
 * directly; quality and recency are tie-breakers between logs that already
 * agree on the first two.
 */
export const DEFAULT_WEIGHTS: MatchWeights = {
  distance: 0.5,
  environment: 0.25,
  recency: 0.125,
  quality: 0.125,
};

/** Overrides for the scoring constants, all of which the issue wants configurable. */
export interface ScoreOptions {
  weights?: MatchWeights;
  sigmaYards?: number;
  halfLifeDays?: number;
}

/** How relevant a log is, and the per-factor breakdown behind it. */
export interface RelevanceScore {
  score: number;
  factors: { distance: number; environment: number; recency: number; quality: number };
}

/** A scored log, as returned by `rankMatches`. */
export interface Match<T extends MatchableLog = MatchableLog> extends RelevanceScore {
  log: T;
}

/**
 * Clamps to the unit interval, mapping anything non-finite to a definite 0.
 *
 * The non-finite case is not theoretical. Weights come from user settings, and
 * a set that sums to zero makes the normalisation below divide by zero: NaN if
 * the weighted total is also zero, +/-Infinity if a negative weight made it
 * otherwise. An Infinity would sort above every genuine match and a NaN sorts
 * unpredictably -- both change the recommendation silently, which is the one
 * failure mode this module exists to avoid. Zero is the honest answer: no
 * opinion.
 */
const unit = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
};

/**
 * A log's distance in yards, whatever it was recorded in.
 *
 * Comparing a metric log's raw number against a yard target is out by 9%: at
 * 600 that is 55 yards, wider than the default delta. A metric user's entire
 * history would sit just outside every query, and the system would report that
 * they have no relevant DOPE.
 */
export const logDistanceInYards = (log: MatchableLog): number =>
  log.distanceUnit === 'meters' ? metersToYards(log.distance) : log.distance;

/**
 * The logs worth scoring: same rifle, same load, within the distance window.
 *
 * A hard filter rather than a low score. A .308 log tells you nothing about a
 * 6.5 load no matter how similar the conditions were, and letting it through
 * with a small weight would let enough of them outvote a single good match.
 */
export const queryCandidates = <T extends MatchableLog>(
  logs: T[],
  context: Pick<ShotContext, 'rifleId' | 'ammoId' | 'distance'>,
  delta: number = DEFAULT_DISTANCE_DELTA
): T[] =>
  logs.filter(
    (log) =>
      log.rifleId === context.rifleId &&
      log.ammoId === context.ammoId &&
      Math.abs(logDistanceInYards(log) - context.distance) <= delta
  );

/**
 * Gaussian falloff on distance: `exp(-(d1-d2)^2 / (2*sigma^2))`.
 *
 * Never reaches zero, so a distant log still outranks no log at all — which
 * matters, because the alternative to a weak match is the unadjusted solver
 * prediction, and a shooter with any relevant history is better served by it.
 */
export const distanceSimilarity = (
  a: number,
  b: number,
  sigma: number = DEFAULT_SIGMA_YARDS
): number => {
  const separation = a - b;
  // sigma reaches this from user settings; dividing by zero would make every
  // score NaN, and NaN sorts unpredictably rather than failing.
  if (!(sigma > 0)) return separation === 0 ? 1 : 0;
  return Math.exp(-(separation * separation) / (2 * sigma * sigma));
};

/** Density altitude, preferring the figure the snapshot already carries. */
const densityAltitudeOf = (environment: MatchableEnvironment): number =>
  environment.densityAltitude ??
  calculateDensityAltitude(environment.temperature, environment.pressure, environment.altitude);

/**
 * How alike two sets of conditions are, on density altitude.
 *
 * One number rather than separate temperature, pressure and altitude terms:
 * density altitude is what the trajectory actually responds to, and it is
 * exactly the combination of the three. Scoring them separately would weight
 * the same physical difference three times and let a cold day at altitude score
 * as "different" twice over.
 */
export const environmentSimilarity = (
  a: MatchableEnvironment | undefined,
  b: MatchableEnvironment | undefined
): number => {
  if (!a || !b) return NEUTRAL;
  const separation = densityAltitudeOf(a) - densityAltitudeOf(b);
  return unit(Math.exp(-Math.abs(separation) / DENSITY_ALTITUDE_SCALE));
};

/**
 * Exponential decay on age, halving every `halfLifeDays`.
 *
 * Old DOPE is not wrong, it is just less likely to still describe this rifle:
 * barrels wear, loads get re-worked, scopes get re-zeroed. Hence a gentle decay
 * rather than a cutoff. Pass Infinity to switch it off, which the issue asks for.
 */
export const recencyFactor = (
  timestamp: string | undefined,
  now: Date = new Date(),
  halfLifeDays: number = DEFAULT_RECENCY_HALF_LIFE_DAYS
): number => {
  if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0) return 1;
  if (timestamp === undefined) return 1;

  const then = Date.parse(timestamp);
  // An unusable timestamp is missing data, not old data. Treating it as ancient
  // would bury the entries logged before this app kept timestamps at all.
  if (Number.isNaN(then)) return 1;

  const ageDays = (now.getTime() - then) / 86400000;
  // A log dated in the future is a wrong clock or a hand-edited backup. It must
  // not be able to outrank every genuine entry by claiming to be from next year.
  if (ageDays <= 0) return 1;

  return Math.pow(0.5, ageDays / halfLifeDays);
};

/**
 * How much to trust what the shooter dialled, from how well they were shooting.
 *
 * Two independent signals, averaged when both are present: group size (in MOA,
 * so it is comparable across distances) and hit rate. A log that records
 * neither scores neutral -- one-tap logging is a feature of this app, and
 * penalising it would rank a carefully-measured bad group above a quick good one.
 */
const groupQuality = (log: MatchableLog): number | undefined => {
  // One shot is not a group. A recorded 0.0 there is an artefact of the input,
  // and treating it as a perfect group would float every single-shot log to the
  // top of every ranking.
  if (log.groupSize === undefined || log.groupSize < 0 || (log.shotCount ?? 0) <= 1) {
    return undefined;
  }

  const yards = logDistanceInYards(log);
  if (!(yards > 0)) return undefined;

  // 1 MOA ~ 1.047 inches per 100 yards, so the figure is comparable across
  // distances -- a 2" group at 600 is better shooting than 1" at 100.
  const moa = log.groupSize / (1.047 * (yards / 100));
  if (!Number.isFinite(moa)) return undefined;

  // exp(-moa/scale): sub-MOA lands above neutral, which the issue asks for.
  return unit(Math.exp(-moa / GROUP_SCALE_MOA));
};

const hitRateQuality = (log: MatchableLog): number | undefined => {
  const shots = log.shotCount ?? 0;
  if (log.hitCount === undefined || shots <= 0) return undefined;
  // Clamped, so a corrupt count above 100% cannot drag a bad group upwards
  // when the two signals are averaged.
  return unit(log.hitCount / shots);
};

export const shotQuality = (log: MatchableLog): number => {
  const parts = [groupQuality(log), hitRateQuality(log)].filter(
    (p): p is number => p !== undefined
  );

  if (parts.length === 0) return NEUTRAL;
  return unit(parts.reduce((sum, p) => sum + p, 0) / parts.length);
};

/** How relevant one log is to the shot, and why. */
export const scoreRelevance = (
  log: MatchableLog,
  context: ShotContext,
  options: ScoreOptions = {}
): RelevanceScore => {
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const now = context.timestamp !== undefined ? new Date(context.timestamp) : new Date();

  const factors = {
    distance: unit(
      distanceSimilarity(logDistanceInYards(log), context.distance, options.sigmaYards)
    ),
    environment: environmentSimilarity(context.environment, log.environment),
    recency: unit(recencyFactor(log.timestamp, now, options.halfLifeDays)),
    quality: shotQuality(log),
  };

  const total = weights.distance + weights.environment + weights.recency + weights.quality;
  const weighted =
    factors.distance * weights.distance +
    factors.environment * weights.environment +
    factors.recency * weights.recency +
    factors.quality * weights.quality;

  // Normalised by the weight total, so the score stays a 0-1 relevance however
  // the weights are scaled -- a user doubling every weight has not changed
  // anything, and the number they see should not move. A zero total divides by
  // zero here; `unit` is what makes that land on 0 rather than on a NaN.
  return { score: unit(weighted / total), factors };
};

/** `ScoreOptions`, plus the query window and how many matches to keep. */
export interface RankOptions extends ScoreOptions {
  delta?: number;
  limit?: number;
}

/**
 * The best matches for a shot, most relevant first.
 *
 * Filter, then score, then sort. Ties break on the log's id so the same history
 * always produces the same ranking: a recommendation that changes between runs
 * without the data changing is one nobody can debug or trust.
 */
export const rankMatches = <T extends MatchableLog>(
  logs: T[],
  context: ShotContext,
  options: RankOptions = {}
): Match<T>[] =>
  queryCandidates(logs, context, options.delta)
    .map((log) => ({ log, ...scoreRelevance(log, context, options) }))
    .sort((a, b) => b.score - a.score || (a.log.id ?? 0) - (b.log.id ?? 0))
    .slice(0, options.limit ?? DEFAULT_MATCH_LIMIT);
