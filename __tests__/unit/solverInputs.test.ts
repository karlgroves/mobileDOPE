import * as ballistics from '../../src/utils/ballistics';
import { calculateBallisticSolution } from '../../src/utils/ballistics';
import {
  STANDARD_ATMOSPHERE,
  ammoConfigFor,
  atmosphereFor,
  elevationTable,
  predictElevation,
  rifleConfigFor,
} from '../../src/utils/solverInputs';
import { validAmmo, validEnvironment, validRifle } from '../helpers/fixtures';

/**
 * Stored profiles and snapshots -> solver inputs (#64).
 *
 * The input-correction suggestions compare every logged point with the solver
 * under that log's own conditions, so this mapping has to agree with the one the
 * DOPE curve plots; both now go through here.
 */

describe('ammoConfigFor', () => {
  it('prefers G7 when the profile has one', () => {
    const config = ammoConfigFor(
      validAmmo({ ballisticCoefficientG7: 0.243, ballisticCoefficientG1: 0.47 })
    );
    expect(config.dragModel).toBe('G7');
    expect(config.ballisticCoefficient).toBe(0.243);
  });

  it('falls back to G1 when G7 is not set', () => {
    const config = ammoConfigFor(
      validAmmo({ ballisticCoefficientG7: 0, ballisticCoefficientG1: 0.47 })
    );
    expect(config.dragModel).toBe('G1');
    expect(config.ballisticCoefficient).toBe(0.47);
  });
});

describe('atmosphereFor', () => {
  it('is the standard atmosphere when there is no snapshot', () => {
    expect(atmosphereFor(undefined)).toEqual(STANDARD_ATMOSPHERE);
  });

  it("uses the snapshot's temperature, pressure and humidity", () => {
    const atmosphere = atmosphereFor(
      validEnvironment({ temperature: 20, pressure: 25.5, humidity: 10 })
    );
    expect(atmosphere).toMatchObject({ temperature: 20, pressure: 25.5, humidity: 10 });
  });
});

describe('predictElevation', () => {
  const rifle = validRifle();
  const ammo = validAmmo();

  it('is what the solver returns for the same inputs', () => {
    const env = validEnvironment();
    const direct = calculateBallisticSolution(
      rifleConfigFor(rifle),
      ammoConfigFor(ammo),
      { distance: 600, angle: 0, windSpeed: 0, windDirection: 0 },
      atmosphereFor(env)
    );
    expect(predictElevation(rifle, ammo, 600, env, 'MIL')).toBeCloseTo(direct.elevationMIL, 6);
    expect(predictElevation(rifle, ammo, 600, env, 'MOA')).toBeCloseTo(direct.elevationMOA, 6);
  });

  it('depends on the conditions: denser air needs more elevation', () => {
    const cold = validEnvironment({ temperature: 10, pressure: 30.5 });
    const hot = validEnvironment({ temperature: 100, pressure: 24.5 });
    expect(predictElevation(rifle, ammo, 800, cold, 'MIL')).toBeGreaterThan(
      predictElevation(rifle, ammo, 800, hot, 'MIL')
    );
  });
});

describe('elevationTable', () => {
  const rifle = validRifle();
  const ammo = validAmmo();
  const env = validEnvironment({ temperature: 20, pressure: 30.4 });

  // The table and a full solve differ by up to ~0.011 MIL (measured over
  // 100-1200 yd in three atmospheres). Most of that is the full solve's own
  // quantisation: it integrates until it passes the target and reports that
  // state -- up to one 1 ms step, about a yard, further out -- as the target.
  // Held to 0.02 MIL: a fifth of a 0.1 MIL click, below anything dialled.
  const WITHIN_MIL = 0.02;

  it.each([300, 437, 500, 612, 800, 1000])('agrees with a full solve at %i yards', (yards) => {
    const table = elevationTable(rifle, ammo, env, 1000, 'MIL');
    const full = predictElevation(rifle, ammo, yards, env, 'MIL');
    expect(Math.abs(table(yards)! - full)).toBeLessThan(WITHIN_MIL);
  });

  it('answers in MOA when asked', () => {
    const table = elevationTable(rifle, ammo, env, 800, 'MOA');
    const full = predictElevation(rifle, ammo, 650, env, 'MOA');
    expect(Math.abs(table(650)! - full)).toBeLessThan(WITHIN_MIL * 3.438);
  });

  it('computes one trajectory, however many distances are read from it', () => {
    const spy = jest.spyOn(ballistics, 'calculateTrajectory');
    const table = elevationTable(rifle, ammo, env, 1000, 'MIL');
    [300, 400, 500, 600, 700, 800, 900, 1000].forEach((yards) => table(yards));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('has no answer beyond the distance it was built for', () => {
    expect(elevationTable(rifle, ammo, env, 500, 'MIL')(600)).toBeUndefined();
  });
});
