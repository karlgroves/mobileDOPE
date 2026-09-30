/**
 * Applying the advanced corrections the solver already computes (#71).
 *
 * `calculateBallisticSolution` has been returning spin drift, gyroscopic
 * stability and both Coriolis terms for some time. Nothing in `src/` reads any
 * of them: they are computed, attached to the solution and dropped. The maths is
 * implemented and unit tested; what is missing is that a shooter at long range
 * never sees it, and gets a windage figure that is several inches short with
 * nothing to say so.
 *
 * ## The sign trap
 *
 * `BallisticSolution` mixes two conventions, and this is the whole difficulty.
 *
 * `elevationMIL` and `windageMIL` are built from the NEGATED deflection:
 *
 * ```ts
 * const elevationMIL = inchesToCorrection(-targetPoint.drop, ...);
 * const windageMIL = inchesToCorrection(-windage, ...);
 * ```
 *
 * They are therefore *corrections to dial*. The advanced fields are not negated:
 * `spinDriftMIL` comes from `inchesToCorrection(spinDrift, ...)`, and the
 * Coriolis terms are `atan(deflection/distance)` directly. They are
 * *deflections*.
 *
 * So the advanced terms must be SUBTRACTED from the corrections, not added.
 * Adding them would push every advanced term the wrong way — turning a missing
 * correction into a double-sized error in the direction of the miss, which is
 * strictly worse than not applying it at all. The tests pin this, and pin it by
 * comparing against how the solver already handles wind, so the two cannot
 * drift apart.
 *
 * ## Why this is separate from the solver
 *
 * The solver's output stays exactly as it is, and this returns a new object
 * rather than mutating it. Whether to apply these is a user preference that can
 * be toggled after the solve, and a function that takes the raw solution and
 * returns an adjusted view cannot be accidentally run twice over its own output
 * — which would silently double every correction.
 */

import type { BallisticSolution, CorrectionUnit } from '../types/ballistic.types';

/** Which advanced terms to fold in. */
export interface AdvancedCorrectionOptions {
  /** The settings-level switch. Off leaves the solution untouched. */
  enabled: boolean;
  /** Default true. Independent so a shooter can trust one term and not the other. */
  spinDrift?: boolean;
  /** Default true. */
  coriolis?: boolean;
}

/** A solution's dialled figures, with the advanced terms folded in. */
export interface AdjustedSolution {
  elevationMIL: number;
  elevationMOA: number;
  windageMIL: number;
  windageMOA: number;
  /** The solver's figures before adjustment, for displaying both. */
  baseElevationMIL: number;
  baseElevationMOA: number;
  baseWindageMIL: number;
  baseWindageMOA: number;
  /** Whether anything actually changed. False when off, or when no term existed. */
  applied: boolean;
  spinDriftMIL?: number;
  spinDriftMOA?: number;
  coriolisHorizontalMIL?: number;
  coriolisHorizontalMOA?: number;
  coriolisVerticalMIL?: number;
  coriolisVerticalMOA?: number;
}

/** One advanced term, ready to display. */
export interface AdvancedCorrectionLine {
  label: string;
  value: number;
  unit: CorrectionUnit;
}

/**
 * Whether the solver produced any advanced term at all.
 *
 * Checks for presence, not for a non-zero value. At the equator the horizontal
 * Coriolis term genuinely is zero, and that is an answer worth showing: hiding
 * the row would leave the shooter unsure whether it was considered or simply
 * not computed.
 */
export const hasAdvancedCorrections = (solution: BallisticSolution): boolean =>
  solution.spinDriftMIL !== undefined ||
  solution.spinDriftMOA !== undefined ||
  solution.coriolisHorizontalMIL !== undefined ||
  solution.coriolisHorizontalMOA !== undefined ||
  solution.coriolisVerticalMIL !== undefined ||
  solution.coriolisVerticalMOA !== undefined;

/** A term's value, or 0 when the solver could not compute it in this unit. */
const term = (value: number | undefined, include: boolean): number =>
  include && value !== undefined && Number.isFinite(value) ? value : 0;

/**
 * The dialled figures with spin drift and Coriolis folded in.
 *
 * Subtracts, for the reason set out at the top of this file. Returns a new
 * object; the solver's own solution is never modified.
 */
export const applyAdvancedCorrections = (
  solution: BallisticSolution,
  options: AdvancedCorrectionOptions
): AdjustedSolution => {
  const base = {
    baseElevationMIL: solution.elevationMIL,
    baseElevationMOA: solution.elevationMOA,
    baseWindageMIL: solution.windageMIL,
    baseWindageMOA: solution.windageMOA,
    spinDriftMIL: solution.spinDriftMIL,
    spinDriftMOA: solution.spinDriftMOA,
    coriolisHorizontalMIL: solution.coriolisHorizontalMIL,
    coriolisHorizontalMOA: solution.coriolisHorizontalMOA,
    coriolisVerticalMIL: solution.coriolisVerticalMIL,
    coriolisVerticalMOA: solution.coriolisVerticalMOA,
  };

  const untouched: AdjustedSolution = {
    ...base,
    elevationMIL: solution.elevationMIL,
    elevationMOA: solution.elevationMOA,
    windageMIL: solution.windageMIL,
    windageMOA: solution.windageMOA,
    applied: false,
  };

  if (!options.enabled || !hasAdvancedCorrections(solution)) return untouched;

  const useSpin = options.spinDrift !== false;
  const useCoriolis = options.coriolis !== false;

  const windMIL =
    term(solution.spinDriftMIL, useSpin) + term(solution.coriolisHorizontalMIL, useCoriolis);
  const windMOA =
    term(solution.spinDriftMOA, useSpin) + term(solution.coriolisHorizontalMOA, useCoriolis);
  const elevMIL = term(solution.coriolisVerticalMIL, useCoriolis);
  const elevMOA = term(solution.coriolisVerticalMOA, useCoriolis);

  if (windMIL === 0 && windMOA === 0 && elevMIL === 0 && elevMOA === 0) return untouched;

  return {
    ...base,
    elevationMIL: solution.elevationMIL - elevMIL,
    elevationMOA: solution.elevationMOA - elevMOA,
    windageMIL: solution.windageMIL - windMIL,
    windageMOA: solution.windageMOA - windMOA,
    applied: true,
  };
};

/**
 * One line per advanced term, for displaying them separately from the
 * base solution — which is what the issue asks for, and what lets a shooter see
 * how much of the number came from where.
 *
 * A term the solver produced in MIL but not MOA is omitted rather than
 * converted: reporting a MIL figure under a MOA heading is a silent unit error,
 * and on a scope that is a miss.
 */
export const describeAdvancedCorrections = (
  solution: BallisticSolution,
  unit: CorrectionUnit
): AdvancedCorrectionLine[] => {
  const pick = (mil: number | undefined, moa: number | undefined): number | undefined =>
    unit === 'MIL' ? mil : moa;

  const candidates: [string, number | undefined][] = [
    ['Spin drift', pick(solution.spinDriftMIL, solution.spinDriftMOA)],
    ['Coriolis (horizontal)', pick(solution.coriolisHorizontalMIL, solution.coriolisHorizontalMOA)],
    ['Coriolis (vertical)', pick(solution.coriolisVerticalMIL, solution.coriolisVerticalMOA)],
  ];

  return candidates
    .filter(([, value]) => value !== undefined && Number.isFinite(value))
    .map(([label, value]) => ({ label, value: value as number, unit }));
};
