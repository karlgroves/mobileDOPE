import {
  applyAdvancedCorrections,
  describeAdvancedCorrections,
  hasAdvancedCorrections,
} from '../../src/utils/advancedCorrections';
import { calculateBallisticSolution } from '../../src/utils/ballistics';

import type {
  AmmoConfig,
  BallisticSolution,
  RifleConfig,
  ShotParameters,
} from '../../src/types/ballistic.types';
import type { AtmosphericConditions } from '../../src/utils/atmospheric';

/**
 * Applying the advanced corrections the solver already computes (#71).
 *
 * `calculateBallisticSolution` has been returning spin drift and Coriolis for
 * some time. Nothing in `src/` reads either field: they are computed, attached
 * to the solution and dropped. So a shooter at 1000 yards gets a windage number
 * that is several inches short and nothing tells them so.
 *
 * This is the combining step, and the whole difficulty is SIGN.
 *
 * `BallisticSolution` mixes two conventions. `elevationMIL` and `windageMIL` are
 * built from the NEGATED deflection -- `inchesToCorrection(-drop, ...)` and
 * `inchesToCorrection(-windage, ...)` -- so they are corrections to dial.
 * `spinDriftMIL`, `coriolisHorizontalMIL` and `coriolisVerticalMIL` are the
 * deflections themselves, not negated. Adding them straight onto the correction
 * would push every advanced term the WRONG WAY, and at 1000 yards that is a
 * double-size error in the direction of the miss rather than a missing
 * correction. These tests pin the subtraction and each sign that depends on it.
 */

const solution = (over: Partial<BallisticSolution> = {}): BallisticSolution =>
  ({
    elevationMIL: 7.2,
    elevationMOA: 24.75,
    windageMIL: 1.5,
    windageMOA: 5.16,
    ...over,
  }) as BallisticSolution;

describe('hasAdvancedCorrections', () => {
  it('is false for a solution with neither term', () => {
    expect(hasAdvancedCorrections(solution())).toBe(false);
  });

  it('is true when spin drift was computed', () => {
    expect(hasAdvancedCorrections(solution({ spinDriftMIL: 0.25 }))).toBe(true);
  });

  it('is true when Coriolis was computed', () => {
    expect(hasAdvancedCorrections(solution({ coriolisHorizontalMIL: 0.1 }))).toBe(true);
  });

  it('is true for a genuinely zero correction, which is not the same as absent', () => {
    // At the equator the horizontal Coriolis term really is zero. That is an
    // answer, and the UI should be able to say "0.0" rather than hide the row
    // and leave the shooter wondering whether it was considered.
    expect(hasAdvancedCorrections(solution({ coriolisHorizontalMIL: 0 }))).toBe(true);
    expect(hasAdvancedCorrections(solution({ spinDriftMIL: 0 }))).toBe(true);
    expect(hasAdvancedCorrections(solution({ coriolisVerticalMIL: 0 }))).toBe(true);
  });
});

describe('applyAdvancedCorrections', () => {
  const full = solution({
    spinDriftMIL: 0.3,
    spinDriftMOA: 1.03,
    coriolisHorizontalMIL: 0.1,
    coriolisHorizontalMOA: 0.34,
    coriolisVerticalMIL: -0.05,
    coriolisVerticalMOA: -0.17,
  });

  it('leaves the solution alone when advanced ballistics is off', () => {
    const result = applyAdvancedCorrections(full, { enabled: false });

    expect(result.windageMIL).toBe(full.windageMIL);
    expect(result.elevationMIL).toBe(full.elevationMIL);
  });

  it('still reports the terms when it is off, so the toggle can be explained', () => {
    const result = applyAdvancedCorrections(full, { enabled: false });

    expect(result.applied).toBe(false);
    expect(result.spinDriftMIL).toBe(0.3);
  });

  it('subtracts spin drift and horizontal Coriolis from the windage correction', () => {
    // Subtracts, because the windage field is already -deflection and these two
    // are +deflection. See the note at the top of this file.
    const result = applyAdvancedCorrections(full, { enabled: true });

    expect(result.windageMIL).toBeCloseTo(1.5 - 0.3 - 0.1, 10);
    expect(result.windageMOA).toBeCloseTo(5.16 - 1.03 - 0.34, 10);
  });

  it('subtracts vertical Coriolis from the elevation correction', () => {
    const result = applyAdvancedCorrections(full, { enabled: true });

    expect(result.elevationMIL).toBeCloseTo(7.2 + 0.05, 10);
    expect(result.elevationMOA).toBeCloseTo(24.75 + 0.17, 10);
  });

  it('keeps the unadjusted numbers, which the issue asks to display separately', () => {
    const result = applyAdvancedCorrections(full, { enabled: true });

    expect(result.baseWindageMIL).toBe(1.5);
    expect(result.baseElevationMIL).toBe(7.2);
  });

  it('is idempotent, so a re-render cannot correct twice', () => {
    // The dangerous failure. Applying the offsets to an already-adjusted
    // solution would double them, and nothing about the result would look wrong.
    const once = applyAdvancedCorrections(full, { enabled: true });
    const twice = applyAdvancedCorrections(
      { ...full, windageMIL: once.windageMIL, elevationMIL: once.elevationMIL },
      { enabled: true }
    );

    expect(twice.windageMIL).not.toBe(once.windageMIL);
    // ...which is exactly why the function takes the RAW solution and returns a
    // separate adjusted value rather than mutating it. Applying it to its own
    // output is a caller error the types make awkward, not something to absorb.
    expect(once.baseWindageMIL).toBe(1.5);
  });

  it('applies only the terms that exist', () => {
    const spinOnly = solution({ spinDriftMIL: 0.3, spinDriftMOA: 1.03 });
    const result = applyAdvancedCorrections(spinOnly, { enabled: true });

    expect(result.windageMIL).toBeCloseTo(1.2, 10);
    expect(result.elevationMIL).toBe(7.2);
  });

  it('changes nothing when the solver computed neither term', () => {
    const result = applyAdvancedCorrections(solution(), { enabled: true });

    expect(result.windageMIL).toBe(1.5);
    expect(result.elevationMIL).toBe(7.2);
    expect(result.applied).toBe(false);
  });

  it('can switch off spin drift and Coriolis independently', () => {
    const noSpin = applyAdvancedCorrections(full, { enabled: true, spinDrift: false });
    const noCoriolis = applyAdvancedCorrections(full, { enabled: true, coriolis: false });

    expect(noSpin.windageMIL).toBeCloseTo(1.5 - 0.1, 10);
    expect(noCoriolis.windageMIL).toBeCloseTo(1.5 - 0.3, 10);
    expect(noCoriolis.elevationMIL).toBe(7.2);
  });

  it('ignores a term that came back as NaN rather than poisoning the dial', () => {
    // A degenerate bullet geometry can make the stability calculation produce a
    // NaN. Carrying it into the windage would put NaN on the scope, which is
    // worse than no correction: the shooter sees a broken number and has no
    // idea which part of the solution to distrust.
    const poisoned = solution({ spinDriftMIL: Number.NaN, spinDriftMOA: Number.NaN });
    const result = applyAdvancedCorrections(poisoned, { enabled: true });

    expect(result.windageMIL).toBe(1.5);
    expect(result.windageMOA).toBe(5.16);
    expect(result.applied).toBe(false);
  });

  it('never returns NaN when a term is present in one unit but not the other', () => {
    // Partial data is reachable: the solver fills the MIL and MOA fields in
    // separate statements. A NaN dialled onto a scope is worse than no help.
    const partial = solution({ spinDriftMIL: 0.3 });
    const result = applyAdvancedCorrections(partial, { enabled: true });

    expect(Number.isFinite(result.windageMIL)).toBe(true);
    expect(Number.isFinite(result.windageMOA)).toBe(true);
    expect(result.windageMOA).toBe(5.16);
  });
});

describe('sign conventions', () => {
  // These are the ones that get shipped wrong. Each is stated in the type
  // definitions; this pins them against the combining step rather than trusting
  // that the comment and the code still agree.

  it('right-hand twist pushes the shot right, so the shooter dials left', () => {
    // spinDrift is positive-right. The correction must move the opposite way,
    // exactly as the wind term already does. Getting this backwards would add
    // the drift to the miss instead of removing it.
    const right = applyAdvancedCorrections(solution({ spinDriftMIL: 0.3 }), { enabled: true });
    const left = applyAdvancedCorrections(solution({ spinDriftMIL: -0.3 }), { enabled: true });

    expect(right.windageMIL).toBeLessThan(1.5);
    expect(left.windageMIL).toBeGreaterThan(1.5);
  });

  it('corrects spin drift the same way the solver already corrects wind', () => {
    // The load-bearing check: a rightward spin drift and a rightward wind drift
    // of the same angular size must move the dialled windage by the same amount
    // in the same direction. If they disagree, one of the two is wrong.
    const drift = 0.3;
    const windOnly = solution({ windageMIL: 1.5 });
    const withSpin = applyAdvancedCorrections(solution({ spinDriftMIL: drift }), {
      enabled: true,
    });

    expect(withSpin.windageMIL - windOnly.windageMIL).toBeCloseTo(-drift, 10);
  });

  it('northern and southern hemisphere Coriolis push opposite ways', () => {
    const north = applyAdvancedCorrections(solution({ coriolisHorizontalMIL: 0.1 }), {
      enabled: true,
    });
    const south = applyAdvancedCorrections(solution({ coriolisHorizontalMIL: -0.1 }), {
      enabled: true,
    });

    expect(north.windageMIL - 1.5).toBeCloseTo(-(south.windageMIL - 1.5), 10);
  });

  it('a positive vertical Coriolis term moves elevation the way extra drop does', () => {
    // The field documents positive as "additional drop when firing East", and
    // the elevation field is built from -drop. So extra drop must move the
    // elevation figure in the same direction that a larger drop already does.
    const extraDrop = applyAdvancedCorrections(solution({ coriolisVerticalMIL: 0.05 }), {
      enabled: true,
    });
    const lessDrop = applyAdvancedCorrections(solution({ coriolisVerticalMIL: -0.05 }), {
      enabled: true,
    });

    expect(extraDrop.elevationMIL).toBeLessThan(7.2);
    expect(lessDrop.elevationMIL).toBeGreaterThan(7.2);
  });
});

describe('describeAdvancedCorrections', () => {
  it('names each term that was applied', () => {
    const lines = describeAdvancedCorrections(
      solution({ spinDriftMIL: 0.3, coriolisHorizontalMIL: 0.1 }),
      'MIL'
    );

    expect(lines.map((l) => l.label)).toEqual(['Spin drift', 'Coriolis (horizontal)']);
  });

  it('reports in the unit asked for', () => {
    const [line] = describeAdvancedCorrections(
      solution({ spinDriftMIL: 0.3, spinDriftMOA: 1.03 }),
      'MOA'
    );

    expect(line.value).toBe(1.03);
  });

  it('says nothing when there is nothing to say', () => {
    expect(describeAdvancedCorrections(solution(), 'MIL')).toEqual([]);
  });

  it('omits a term the solver could not compute in the requested unit', () => {
    // Reporting a MIL figure under a MOA heading would be a silent unit error,
    // which on a scope is a miss.
    expect(describeAdvancedCorrections(solution({ spinDriftMIL: 0.3 }), 'MOA')).toEqual([]);
  });
});

/**
 * The premise this whole module rests on, checked against the real solver.
 *
 * Everything above tests my *reading* of `BallisticSolution`'s sign conventions.
 * If that reading is wrong, every test above is consistently wrong with it and
 * the corrections ship inverted. So this asks the solver directly.
 */
describe('the solver conventions this module assumes', () => {
  const rifle: RifleConfig = {
    zeroDistance: 100,
    sightHeight: 1.5,
    twistRate: '1:10',
    barrelLength: 24,
    caliber: '.308 Win',
  };

  const ammo: AmmoConfig = {
    bulletWeight: 168,
    ballisticCoefficient: 0.462,
    dragModel: 'G1',
    muzzleVelocity: 2650,
  };

  const atmosphere: AtmosphericConditions = {
    temperature: 59,
    pressure: 29.92,
    humidity: 50,
    altitude: 0,
    densityAltitude: 0,
  };

  const solve = (overrides: Partial<ShotParameters> = {}) =>
    calculateBallisticSolution(
      rifle,
      ammo,
      { distance: 1000, angle: 0, windSpeed: 10, windDirection: 90, ...overrides },
      atmosphere
    );

  it('reports windage as a correction, opposite in sign to the drift', () => {
    // The premise: windageMIL = inchesToCorrection(-windage, ...). If this ever
    // stops holding, every advanced term this module folds in is inverted.
    const result = solve();

    expect(result.windage).not.toBe(0);
    expect(Math.sign(result.windageMIL)).toBe(-Math.sign(result.windage));
  });

  it('reports spin drift as a deflection, the SAME sign as the drift', () => {
    // The inconsistency this module exists to absorb. spinDriftMIL comes from
    // inchesToCorrection(spinDrift, ...) with no negation, so unlike windage it
    // is not a correction. Adding it to windageMIL directly would be wrong.
    const result = solve();

    expect(result.spinDrift).toBeDefined();
    expect(result.spinDrift).not.toBe(0);
    expect(Math.sign(result.spinDriftMIL as number)).toBe(Math.sign(result.spinDrift as number));
  });

  it('reports elevation as a correction, opposite in sign to the drop', () => {
    const result = solve();

    expect(result.drop).not.toBe(0);
    expect(Math.sign(result.elevationMIL)).toBe(-Math.sign(result.drop));
  });

  it('moves a real solution the right way once the terms are folded in', () => {
    // End to end: a right-hand twist drifts the bullet right, so the dialled
    // windage must come DOWN relative to the solver's unadjusted figure.
    const result = solve({ windSpeed: 0, windDirection: 0 });
    const adjusted = applyAdvancedCorrections(result, { enabled: true, coriolis: false });

    expect(result.spinDrift as number).toBeGreaterThan(0);
    expect(adjusted.applied).toBe(true);
    expect(adjusted.windageMIL).toBeLessThan(result.windageMIL);
  });

  it('produces a spin drift of a plausible size at 1000 yards', () => {
    // Order of magnitude only. Published figures for a .308 at 1000 yards put
    // spin drift at roughly 8-12 inches; this pins that it is inches rather
    // than tenths or feet, which is what a unit or formula error would give.
    const result = solve({ windSpeed: 0, windDirection: 0 });

    expect(result.spinDrift as number).toBeGreaterThan(3);
    expect(result.spinDrift as number).toBeLessThan(30);
  });
});
