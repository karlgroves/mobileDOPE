/**
 * Adjusting the solver's windage by the shooter's own logged DOPE (#163).
 *
 * The elevation half (#168) can average offsets directly, because two logs shot
 * at the same distance in similar air are predicted the same figure. Windage
 * cannot: a log shot in 4 mph of crosswind and one shot in 15 say the same thing
 * about the rifle and wildly different things about the turret. So the offset is
 * **normalised by the crosswind each log was shot in** before anything is
 * averaged, which is what #163 asks for, and then scaled back up to today's
 * wind.
 *
 * Per log:
 *
 * 1. `loggedWindage / crosswind` -- windage per mph of full-value wind;
 * 2. minus `solverWindage / crosswind` -- the solver's own figure per mph;
 * 3. which is `(logged - solver) / crosswind`, the solver's error per mph.
 *
 * Those per-mph errors are comparable across logs, so they are averaged by
 * relevance and damped by the same saturating trust curve the elevation offset
 * uses -- one log is evidence, six agreeing logs are better evidence, and the
 * two must not count the same. Then the mean is multiplied by today's crosswind.
 *
 * ## Why the sign takes care of itself
 *
 * Crosswind is signed, by the same convention as the rest of the app
 * (`calculateCrosswindComponent`: `speed * sin(direction)`, 90 degrees being a
 * full-value wind from one side). A log shot in a left-to-right wind and a shot
 * being taken in a right-to-left one have crosswinds of opposite sign, so the
 * scaling flips the correction -- which is what the bullet does. Nothing here
 * needs to know which way positive points, only that both sides use the same
 * convention.
 *
 * ## Why no-crosswind logs are excluded rather than divided
 *
 * A log shot in dead air, or with the wind at 12 or 6 o'clock, carries no
 * information about wind at all, and dividing by its crosswind is a division by
 * (almost) zero. "Almost" is the operative word: a wind recorded at exactly 180
 * degrees gives `sin(pi)` = 1.2e-16 rather than 0, so a guard against literal
 * zero would let a 15 mph tailwind through as an offset of around 1e17 per mph
 * and that single log would obliterate every other. Hence a threshold, not an
 * equality test.
 *
 * Pure. No store, no solver -- the caller supplies the per-mph prediction and
 * each log's crosswind, which is what makes this testable without a trajectory.
 */

import { logDistanceInYards } from './distanceUnits';
import { SINGLE_LOG_SOFTENING, windageIn } from './dopeAdjustment';

import type { Match, MatchableLog } from './dopeMatching';
import type { DOPELogData } from '../models/DOPELog';

/** Shown when the solver's windage stands unmodified for want of wind data. */
export const NO_CROSSWIND_REASON = 'No crosswind to scale from, using solver windage only';

/** Shown when there is wind today but no log that was shot in any. */
export const NO_WINDY_LOGS_REASON =
  'None of your logs were shot in a crosswind, using solver windage only';

/**
 * Crosswind below which a log is left out, in mph.
 *
 * Half a mile an hour. Two reasons it is not zero. The arithmetic one: wind
 * recorded at 180 degrees gives a crosswind of 1.2e-16 rather than 0, and
 * dividing by that produces an offset around 1e17 per mph which would swamp
 * every other log. The physical one: a shooter's recorded wind is a guess to
 * within a mile an hour at best, so an offset divided by 0.3 mph is noise
 * multiplied by three, presented as a measurement.
 */
export const MIN_CROSSWIND_MPH = 0.5;

/** One log's say in the windage adjustment. */
export interface WindageContribution<T extends MatchableLog = DOPELogData> {
  log: T;
  /** The relevance score it was ranked with. */
  weight: number;
  /** The crosswind it was shot in, mph, signed. */
  crosswind: number;
  /** `(dialled - predicted) / crosswind`, in the requested unit per mph. */
  offsetPerMph: number;
}

/** What the windage adjustment came to, and what the UI needs to explain it. */
export interface WindageAdjustment<T extends MatchableLog = DOPELogData> {
  /** The solver's figure, untouched. Always shown. */
  solverWindage: number;
  /** `solverWindage + offset`. */
  adjustedWindage: number;
  /** Today's crosswind, mph, signed -- what the mean was scaled by. */
  crosswind: number;
  /** The weighted mean per-mph offset, before damping. */
  rawOffsetPerMph: number;
  /** How much of it was believed, in [0, 1). */
  trust: number;
  /** `rawOffsetPerMph * trust * crosswind` -- what was actually added. */
  offset: number;
  /** The logs behind it, in the order they were ranked. */
  contributions: WindageContribution<T>[];
  /** Set only when the solver's answer stands alone, and says why. */
  reason?: string;
}

/**
 * The solver's windage at a log's distance, per mph of full-value crosswind.
 *
 * `undefined` where the solver has no answer. Such a log is dropped rather than
 * counted as agreeing, which treating a missing prediction as zero would do.
 */
export type PredictWindagePerMph<T extends MatchableLog = DOPELogData> = (
  log: T,
  yards: number
) => number | undefined;

/** The crosswind a log was shot in, mph and signed; undefined when unrecorded. */
export type CrosswindForLog<T extends MatchableLog = DOPELogData> = (log: T) => number | undefined;

/** The solver's windage with nothing added, and the reason why. */
const solverOnly = <T extends MatchableLog>(
  solverWindage: number,
  crosswind: number,
  reason: string
): WindageAdjustment<T> => ({
  solverWindage,
  adjustedWindage: solverWindage,
  crosswind,
  rawOffsetPerMph: 0,
  trust: 0,
  offset: 0,
  contributions: [],
  reason,
});

/**
 * Today's windage, adjusted by what the relevant logs say the solver gets wrong
 * per mph of crosswind.
 *
 * @param matches - `rankMatches` output, consumed as it comes.
 * @param predictPerMph - The solver's windage per mph for one log.
 * @param crosswindFor - The crosswind each log was shot in.
 * @param crosswind - Today's crosswind, mph, signed.
 * @param solverWindage - The solver's own figure for this shot, in `unit`.
 * @param unit - The working unit.
 * @returns The adjustment, or the solver's figure with a reason.
 */
export const adjustWindage = <T extends MatchableLog & Partial<DOPELogData>>(
  matches: Match<T>[],
  predictPerMph: PredictWindagePerMph<T>,
  crosswindFor: CrosswindForLog<T>,
  crosswind: number,
  solverWindage: number,
  unit: 'MIL' | 'MOA'
): WindageAdjustment<T> => {
  // Nothing to scale to. An offset per mph multiplied by no wind is zero, so
  // this is not a different answer from the arithmetic -- it is a different
  // *reason*, and the shooter is entitled to know which one applied.
  if (!Number.isFinite(crosswind) || Math.abs(crosswind) < MIN_CROSSWIND_MPH) {
    return solverOnly(
      solverWindage,
      Number.isFinite(crosswind) ? crosswind : 0,
      NO_CROSSWIND_REASON
    );
  }

  const contributions: WindageContribution<T>[] = [];

  for (const { log, score } of matches) {
    // A match scored zero says nothing, and would put a zero in the
    // denominator's favour without putting an opinion in the numerator.
    if (!(score > 0)) continue;

    const logCrosswind = crosswindFor(log);
    if (
      logCrosswind === undefined ||
      !Number.isFinite(logCrosswind) ||
      Math.abs(logCrosswind) < MIN_CROSSWIND_MPH
    ) {
      continue;
    }

    const yards = logDistanceInYards(log);
    const perMph = predictPerMph(log, yards);
    if (perMph === undefined || !Number.isFinite(perMph)) continue;

    const dialled = windageIn(log, unit);
    const predicted = perMph * logCrosswind;

    contributions.push({
      log,
      weight: score,
      crosswind: logCrosswind,
      offsetPerMph: (dialled - predicted) / logCrosswind,
    });
  }

  const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0);

  if (totalWeight <= 0) {
    return solverOnly(solverWindage, crosswind, NO_WINDY_LOGS_REASON);
  }

  const rawOffsetPerMph =
    contributions.reduce((sum, c) => sum + c.weight * c.offsetPerMph, 0) / totalWeight;
  const trust = totalWeight / (totalWeight + SINGLE_LOG_SOFTENING);
  const offset = rawOffsetPerMph * trust * crosswind;

  return {
    solverWindage,
    adjustedWindage: solverWindage + offset,
    crosswind,
    rawOffsetPerMph,
    trust,
    offset,
    contributions,
  };
};

/**
 * "Based on 4 logs, scaled from the wind each was shot in."
 *
 * @param count - Logs that contributed.
 * @param crosswind - Today's crosswind, mph, signed.
 * @returns The caption.
 */
export const windageCaption = (count: number, crosswind: number): string =>
  `Based on ${count} ${count === 1 ? 'log' : 'logs'}, scaled from the wind each was ` +
  `shot in to today's ${Math.abs(crosswind).toFixed(1)} mph crosswind.`;
