/**
 * The boundary between what the user typed and what the solver computes (#106).
 *
 * The ballistic solver works in **yards**, and says so:
 * `ballistic.types.ts` documents `ShotParameters.distance` as yards. Every
 * screen that offered a yards/meters toggle passed the raw number through
 * anyway, so selecting meters changed the label and nothing else. A shooter who
 * entered 600 m got the solution for 600 yards -- a target 52 m closer than the
 * one they were looking at -- and the card said 600.
 *
 * `unitConversions.ts` already had `convertDistance`. Nothing in `src/screens/`
 * or `src/components/` called it. The missing piece was never the arithmetic; it
 * was that no one could see where the boundary was. This module is that
 * boundary, named, so crossing it is a deliberate act rather than an omission.
 *
 * ## The two contracts, which are not the same
 *
 * - **The solver** is always yards. Everything crossing into
 *   `calculateBallisticSolution` goes through {@link toSolverYards}.
 * - **A stored DOPE log** is in its own `distanceUnit`, not in yards. That is
 *   what `DOPELogEntry` writes -- the distance as typed, with the unit beside
 *   it -- so anything computing with a log's distance goes through
 *   {@link logDistanceInYards} first.
 *
 * The schema comment used to say `distance: number; // yards` while the column
 * next to it stored the unit. Both could not be true, and the code disagreed
 * with the comment.
 */

import { convertDistance } from './unitConversions';

/** The unit the ballistic solver works in, and the unit every calculation uses. */
export const SOLVER_DISTANCE_UNIT = 'yards' as const;

export type DistanceUnit = 'yards' | 'meters';

/**
 * A distance the user entered, in the unit the solver needs.
 *
 * @param value - The distance as the user typed it.
 * @param unit - The unit they had selected.
 */
export const toSolverYards = (value: number, unit: DistanceUnit): number =>
  convertDistance(value, unit, SOLVER_DISTANCE_UNIT);

/**
 * A distance the solver produced, in the unit the user is reading.
 *
 * @param yards - The distance in the solver's unit.
 * @param unit - The unit to display in.
 */
export const fromSolverYards = (yards: number, unit: DistanceUnit): number =>
  convertDistance(yards, SOLVER_DISTANCE_UNIT, unit);

/** The subset of a DOPE log this module needs: a distance and the unit it is in. */
export interface DistanceBearing {
  distance: number;
  distanceUnit?: DistanceUnit;
}

/**
 * A stored log's distance, in yards.
 *
 * Logs keep the distance as entered alongside the unit, so a metric log holds
 * metres. Anything that computes with it -- matching, group size in MOA, a
 * solver call -- needs yards.
 *
 * A missing unit is treated as yards, which is what every log written before
 * the column existed contains and what the column defaults to.
 *
 * @param log - Any record carrying a distance and optionally its unit.
 */
export const logDistanceInYards = (log: DistanceBearing): number =>
  toSolverYards(log.distance, log.distanceUnit ?? SOLVER_DISTANCE_UNIT);
