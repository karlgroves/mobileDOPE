/**
 * Adjusting the solver's elevation by the shooter's own logged DOPE (#168).
 *
 * The second half of DOPE-assisted aiming. `dopeMatching` decides *which* logs
 * resemble the shot in front of you; this decides *what they say about it*.
 *
 * For each relevant log, take the offset between what was actually dialled and
 * what the solver predicts for that log's own distance and conditions. Combine
 * the offsets, weighted by relevance. Add the result to today's solution.
 *
 * ## Why this removes the need for a ΔDA model
 *
 * #70 §4 asked for a density-altitude term: compute the DA then and now, ask
 * the solver for the drop at each, and shift the logged elevation by the
 * difference. That is unnecessary here, because every offset is measured
 * against the solver **in that log's own air**. A log from a thin mountain
 * morning and one from dense sea-level air both reduce to "how much the solver
 * was wrong for me", and that is the quantity worth carrying forward. The air
 * is already in the prediction, not in the offset.
 *
 * ## Why the adjustment is damped
 *
 * A single log is evidence, but it is not the same evidence as six agreeing
 * logs, and #168 asks explicitly that one entry cannot move the answer as far.
 * So the weighted mean offset is scaled by a trust factor that saturates with
 * the weight behind it. It is deliberately *not* a confidence score — that is
 * #161's job, with its own factors and its own threshold. This is the narrower
 * thing: how much of a measured offset to believe, given how much of it there
 * is.
 *
 * Pure. No store, no database, no solver — the caller supplies the prediction
 * function, which is what makes this testable without a trajectory.
 */

import { logDistanceInYards } from './distanceUnits';
import { milToMoa, moaToMil } from './unitConversions';

import type { Match, MatchableLog } from './dopeMatching';
import type { DOPELogData } from '../models/DOPELog';

/** Shown, and returned, whenever the solver's own answer stands unmodified. */
export const SOLVER_ONLY_REASON = 'No historical data, using solver only';

/**
 * Weight at which the adjustment is believed half way, in the saturating
 * `w / (w + k)` trust curve.
 *
 * At 1, a lone match scored 1.0 applies half of its measured offset, three
 * such logs apply three quarters, and six apply six sevenths. That shape was
 * chosen for what it does at the thin end rather than the thick: the gap
 * between one log and several is large, which is what #168 asks for, and the
 * curve never reaches 1, so the solver always keeps a share of the answer.
 */
export const SINGLE_LOG_SOFTENING = 1;

/** One log's say in the adjustment. */
export interface Contribution<T extends MatchableLog = DOPELogData> {
  log: T;
  /** The relevance score it was ranked with. */
  weight: number;
  /** Dialled minus predicted, in the requested unit. */
  offset: number;
}

/** What the adjustment came to, and everything the UI needs to explain it. */
export interface ElevationAdjustment<T extends MatchableLog = DOPELogData> {
  /** The solver's figure, untouched. Always shown (#168). */
  solverElevation: number;
  /** `solverElevation + offset`. */
  adjustedElevation: number;
  /** The weighted mean offset before damping. */
  rawOffset: number;
  /** How much of `rawOffset` was believed, in [0, 1). */
  trust: number;
  /** `rawOffset * trust` — what was actually added. */
  offset: number;
  /** The logs behind it, in the order they were ranked. */
  contributions: Contribution<T>[];
  /** Set only when the solver's answer stands alone, and says why. */
  reason?: string;
}

/**
 * Predicts the solver's elevation for one log, at its own distance in yards
 * and in its own recorded conditions, in the unit being worked in.
 *
 * `undefined` where the solver has no answer — past the end of a trajectory,
 * say. Such a log is dropped rather than counted as agreeing, which is what
 * treating a missing prediction as a zero offset would quietly do.
 */
export type PredictForLog<T extends MatchableLog = DOPELogData> = (
  log: T,
  yards: number
) => number | undefined;

/** A log's dialled elevation in `unit`, whatever it was recorded in (#125). */
const elevationIn = (log: MatchableLog & Partial<DOPELogData>, unit: 'MIL' | 'MOA'): number => {
  const value = log.elevationCorrection ?? 0;
  if (log.correctionUnit === undefined || log.correctionUnit === unit) return value;
  return unit === 'MIL' ? moaToMil(value) : milToMoa(value);
};

/**
 * Today's solution, adjusted by what the relevant logs say the solver gets
 * wrong.
 *
 * `matches` is `rankMatches` output, consumed as it comes. With none of them
 * usable the solver's figure is returned untouched, with `reason` set.
 */
export const adjustElevation = <T extends MatchableLog & Partial<DOPELogData>>(
  matches: Match<T>[],
  predict: PredictForLog<T>,
  solverElevation: number,
  unit: 'MIL' | 'MOA'
): ElevationAdjustment<T> => {
  const contributions: Contribution<T>[] = [];

  for (const { log, score } of matches) {
    // A match scored zero says nothing, and including it would put a zero in
    // the denominator's favour without putting an opinion in the numerator.
    if (!(score > 0)) continue;

    const yards = logDistanceInYards(log);
    const predicted = predict(log, yards);
    if (predicted === undefined || !Number.isFinite(predicted)) continue;

    contributions.push({ log, weight: score, offset: elevationIn(log, unit) - predicted });
  }

  const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0);

  if (totalWeight <= 0) {
    return {
      solverElevation,
      adjustedElevation: solverElevation,
      rawOffset: 0,
      trust: 0,
      offset: 0,
      contributions: [],
      reason: SOLVER_ONLY_REASON,
    };
  }

  const rawOffset = contributions.reduce((sum, c) => sum + c.weight * c.offset, 0) / totalWeight;
  const trust = totalWeight / (totalWeight + SINGLE_LOG_SOFTENING);
  const offset = rawOffset * trust;

  return {
    solverElevation,
    adjustedElevation: solverElevation + offset,
    rawOffset,
    trust,
    offset,
    contributions,
  };
};
