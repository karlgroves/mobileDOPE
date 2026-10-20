/**
 * Adjusting the solver's elevation by the shooter's own logged DOPE (#168).
 *
 * The second half of DOPE-assisted aiming. `dopeMatching` picks the logs worth
 * deriving a correction from; this turns them into one number to add to today's
 * solution.
 *
 * Pure. No store, no database, no solver -- the per-log prediction arrives as a
 * function, exactly as `compareLogsToSolver` takes it, so the caller decides how
 * to solve and this module stays testable without the ballistics engine.
 *
 * ## Why each offset is measured against the solver in that log's own air
 *
 * The naive version compares a logged elevation with *today's* solution. That
 * reads the difference between two days' air as shooter error: a log from
 * 12,000 ft of density altitude needed 0.8 MIL less than a sea-level day, and
 * subtracting today's figure from it reports 0.8 MIL of bias that does not
 * exist.
 *
 * Here each log's offset is `logged - predicted-for-that-log`, so the air it was
 * shot in is on both sides of the subtraction and cancels. What survives is the
 * part the solver cannot model for this rifle and load: a slightly wrong muzzle
 * velocity, a scope that does not track quite 0.1 MIL per click, a BC that is
 * optimistic downrange. That is the part worth carrying forward, and it is why
 * #70's separate delta-density-altitude step is unnecessary.
 *
 * ## Why one log is not worth as much as several
 *
 * A single entry is one shot group on one day, and it carries the shooter's
 * reading error, the wind they did not call and the round that happened to go
 * high. Letting it move the dialled correction by its whole offset would make
 * the feature swing on the most recent range trip. So each match's weight is
 * capped at {@link MAX_MATCH_WEIGHT} of a full weight budget, and only the share
 * of the budget the matches actually fill is applied. One perfect log applies
 * half its offset; two agreeing logs apply all of it.
 *
 * This is a deliberately blunt instrument, not a confidence model. Scoring how
 * much to trust a set of offsets -- from their spread, their count and their age
 * -- is #161, and the number this returns is the one that work will refine.
 */

import { logDistanceInYards } from './distanceUnits';
import { correctionIn } from './dopeAnalysis';

import type { Match } from './dopeMatching';
import type { DOPELogData } from '../models/DOPELog';

/**
 * The most weight one match may carry, as a share of a full weight budget.
 *
 * Half, so that two agreeing logs fill the budget and a single one applies half
 * its offset. The alternative -- normalising whatever matches exist to a total of
 * one -- makes a lone log carry the full correction, which is the failure mode
 * this constant exists to prevent.
 */
export const MAX_MATCH_WEIGHT = 0.5;

/** Said when nothing usable was found, as the issue specifies verbatim. */
export const NO_DATA_REASON = 'No historical data, using solver only';

/** One log's contribution to the combined offset. */
export interface DopeOffsetContribution {
  /** The log as the caller supplied it. Never a converted copy. */
  log: DOPELogData;
  /** The log's distance in yards, whatever it was recorded in. */
  distanceYards: number;
  /** What was dialled, in the requested unit. */
  logged: number;
  /** What the solver predicted for this log's own distance and conditions. */
  predicted: number;
  /** `logged - predicted`, in the requested unit. */
  offset: number;
  /** The relevance score `rankMatches` gave it. */
  score: number;
  /** Share of the combined offset this log carries, 0-1. Shares sum to 1. */
  weight: number;
}

/** The solver's elevation, the shooter's history, and the number in between. */
export interface DopeAssistedElevation {
  /** The angular unit everything here is in. */
  unit: 'MIL' | 'MOA';
  /** Today's solver elevation, unchanged. Always available to the shooter. */
  solverElevation: number;
  /** `solverElevation + offset`. */
  adjustedElevation: number;
  /** The offset actually applied: `combinedOffset * appliedShare`. */
  offset: number;
  /** The weighted mean of the contributing offsets, before {@link appliedShare}. */
  combinedOffset: number;
  /** How much of {@link combinedOffset} was applied, 0-1. Grows with evidence. */
  appliedShare: number;
  /** The logs behind the offset, in the order they were matched. */
  contributions: DopeOffsetContribution[];
  /** Why the answer is what it is, for the shooter to read. */
  reason: string;
}

/** Everything {@link adjustElevationWithDope} needs to produce one answer. */
export interface DopeAssistedElevationInput {
  /** The ranked matches, as `rankMatches` returns them. */
  matches: Match<DOPELogData>[];
  /**
   * The solver's elevation for one log at `yards`, in the requested unit, under
   * that log's own conditions. The same contract `compareLogsToSolver` uses, so
   * an `elevationTable` per environment can be shared between them. Return
   * undefined where the solver has no answer.
   */
  predict: (log: DOPELogData, yards: number) => number | undefined;
  /** Today's solver elevation, in `unit`. */
  solverElevation: number;
  unit: 'MIL' | 'MOA';
  /** Override for {@link MAX_MATCH_WEIGHT}. Ignored unless it is in (0, 1]. */
  maxMatchWeight?: number;
}

/** The solver's own answer, with nothing derived from history. */
const solverOnly = (
  solverElevation: number,
  unit: 'MIL' | 'MOA',
  reason: string
): DopeAssistedElevation => ({
  unit,
  solverElevation,
  adjustedElevation: solverElevation,
  offset: 0,
  combinedOffset: 0,
  appliedShare: 0,
  contributions: [],
  reason,
});

/** What one log says, or undefined when it says nothing usable. */
const offsetOf = (
  log: DOPELogData,
  score: number,
  predict: DopeAssistedElevationInput['predict'],
  unit: 'MIL' | 'MOA'
): Omit<DopeOffsetContribution, 'weight'> | undefined => {
  const distanceYards = logDistanceInYards(log);
  if (!(distanceYards > 0)) return undefined;

  const logged = correctionIn(log, unit);
  if (!Number.isFinite(logged)) return undefined;

  const predicted = predict(log, distanceYards);
  // undefined is the documented "no answer" -- `elevationTable` returns it past
  // the trajectory it computed. A non-finite number is a solve that went wrong.
  // Either way, deriving an offset from the logged value alone would read the
  // whole correction as error, so the log is dropped instead.
  if (predicted === undefined || !Number.isFinite(predicted)) return undefined;

  return { log, distanceYards, logged, predicted, offset: logged - predicted, score };
};

/** "3 logs support a 0.20 MIL offset; 100% applied". */
const describeAdjustment = (
  count: number,
  combinedOffset: number,
  appliedShare: number,
  unit: 'MIL' | 'MOA'
): string =>
  `${count} log${count === 1 ? '' : 's'} support a ` +
  `${combinedOffset >= 0 ? '+' : '-'}${Math.abs(combinedOffset).toFixed(2)} ${unit} offset; ` +
  `${Math.round(appliedShare * 100)}% applied`;

/**
 * Today's elevation, adjusted by what this shooter has actually dialled.
 *
 * Returns the solver's own figure untouched when there is nothing to go on, with
 * {@link NO_DATA_REASON} as the reason -- an unadjusted number the shooter can
 * see the provenance of is the right answer, and silently returning the solver's
 * value with no explanation is how a shooter comes to believe an adjustment was
 * applied when none was.
 */
export const adjustElevationWithDope = ({
  matches,
  predict,
  solverElevation,
  unit,
  maxMatchWeight,
}: DopeAssistedElevationInput): DopeAssistedElevation => {
  // Nothing derived from history can rescue a solution that is already NaN, and
  // adding an offset to one would hide where the problem started.
  if (!Number.isFinite(solverElevation)) {
    return solverOnly(solverElevation, unit, NO_DATA_REASON);
  }

  const cap =
    maxMatchWeight !== undefined && maxMatchWeight > 0 && maxMatchWeight <= 1
      ? maxMatchWeight
      : MAX_MATCH_WEIGHT;

  const usable = matches
    .map((m) => offsetOf(m.log, m.score, predict, unit))
    .filter((c): c is Omit<DopeOffsetContribution, 'weight'> => c !== undefined);

  if (usable.length === 0) return solverOnly(solverElevation, unit, NO_DATA_REASON);

  const capped = usable.map((c) => Math.min(Math.max(c.score, 0), cap));
  const weightTotal = capped.reduce((sum, w) => sum + w, 0);
  // All-zero scores are reachable: `scoreRelevance` maps a non-finite weighted
  // score to 0 deliberately. Dividing by that total would make every offset NaN,
  // which the shooter reads as a blank adjustment rather than as a failure, so
  // the matcher having no opinion is treated as it having no preference.
  const weights = weightTotal > 0 ? capped : capped.map(() => cap);
  const total = weightTotal > 0 ? weightTotal : cap * capped.length;

  const combinedOffset = usable.reduce((sum, c, i) => sum + c.offset * weights[i], 0) / total;
  const appliedShare = Math.min(1, total);
  const offset = combinedOffset * appliedShare;

  return {
    unit,
    solverElevation,
    adjustedElevation: solverElevation + offset,
    offset,
    combinedOffset,
    appliedShare,
    contributions: usable.map((c, i) => ({ ...c, weight: weights[i] / total })),
    reason: describeAdjustment(usable.length, combinedOffset, appliedShare, unit),
  };
};
