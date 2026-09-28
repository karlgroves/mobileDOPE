import { calculateBallisticSolution } from '../../src/utils/ballistics';
import {
  STANDARD_ATMOSPHERE,
  ammoConfigFor,
  atmosphereFor,
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
