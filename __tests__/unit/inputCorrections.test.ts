import * as ballistics from '../../src/utils/ballistics';
import { inputCorrectionsFor } from '../../src/utils/inputCorrections';
import { predictElevation } from '../../src/utils/solverInputs';
import { validAmmo, validDopeLog, validEnvironment, validRifle } from '../helpers/fixtures';

import type { DOPELogData } from '../../src/models/DOPELog';
import type { EnvironmentSnapshotData } from '../../src/models/EnvironmentSnapshot';

/**
 * Muzzle-velocity and BC suggestions for one rifle and load (#64).
 *
 * The logged points here are built from the solver itself plus a known offset,
 * so each test controls exactly what the evidence says.
 */

const rifle = validRifle();
const ammo = validAmmo({ muzzleVelocity: 2700, ballisticCoefficientG7: 0.258 });
const env = { ...validEnvironment(), id: 1 };
const environmentById = new Map<number, EnvironmentSnapshotData>([[1, env]]);

/** Logs at `yards`, each the solver's own prediction plus `offset(yards)` MIL. */
const logsAt = (yards: number[], offset: (y: number) => number): DOPELogData[] =>
  yards.map((distance, i) =>
    validDopeLog(
      { rifleId: 1, ammoId: 1, environmentId: 1 },
      {
        id: i + 1,
        distance,
        distanceUnit: 'yards',
        correctionUnit: 'MIL',
        elevationCorrection: predictElevation(rifle, ammo, distance, env, 'MIL') + offset(distance),
      }
    )
  );

const run = (logs: DOPELogData[], envs = environmentById) =>
  inputCorrectionsFor({ logs, rifle, ammo, environmentById: envs, unit: 'MIL' });

describe('inputCorrectionsFor', () => {
  it('says there is not enough data with fewer than three distances', () => {
    const result = run(logsAt([300, 600], () => 0.5));
    expect(result.status).toBe('insufficient');
    expect(result.distanceCount).toBe(2);
    expect(result.muzzleVelocity).toBeUndefined();
  });

  it('suggests nothing when the logs agree with the solver', () => {
    const result = run(logsAt([300, 500, 700, 900], () => 0));
    expect(result.status).toBe('agrees');
    expect(result.muzzleVelocity).toBeUndefined();
    expect(result.ballisticCoefficient).toBeUndefined();
  });

  it('suggests a lower velocity when every log needs more elevation than predicted', () => {
    const result = run(logsAt([300, 500, 700], () => 0.5));
    expect(result.status).toBe('suggests');
    expect(result.muzzleVelocity?.current).toBe(2700);
    expect(result.muzzleVelocity?.suggested).toBeLessThan(2700);
  });

  it('suggests a BC change when the gap grows with distance, on the drag model in use', () => {
    const result = run(logsAt([300, 500, 700, 900], (y) => (y - 300) / 300));
    expect(result.spanYards).toBe(600);
    expect(result.ballisticCoefficient?.dragModel).toBe('G7');
    expect(result.ballisticCoefficient?.current).toBe(0.258);
    expect(result.ballisticCoefficient?.suggested).toBeLessThan(0.258);
  });

  it("predicts each log in that log's own conditions", () => {
    // Logged exactly on the solver in cold dense air. Compared against the
    // standard atmosphere they would look like extra drop; against their own
    // snapshot they agree.
    const cold = { ...validEnvironment({ temperature: 0, pressure: 30.8 }), id: 2 };
    const logs = [300, 500, 700, 900].map((distance, i) =>
      validDopeLog(
        { rifleId: 1, ammoId: 1, environmentId: 2 },
        {
          id: i + 1,
          distance,
          distanceUnit: 'yards',
          correctionUnit: 'MIL',
          elevationCorrection: predictElevation(rifle, ammo, distance, cold, 'MIL'),
        }
      )
    );
    expect(run(logs, new Map([[2, cold]])).status).toBe('agrees');
    // The same logs filed under a standard-day snapshot read as a velocity error.
    const standardDay = { ...validEnvironment(), id: 2 };
    expect(run(logs, new Map([[2, standardDay]])).status).toBe('suggests');
  });

  it('leaves out logs with no recorded conditions, and counts them', () => {
    // Four logs agree in their own conditions. Three more, with no snapshot,
    // would suggest a large change if predicted in a standard atmosphere --
    // which is exactly the guess this refuses to make.
    const withConditions = logsAt([300, 500, 700, 900], () => 0);
    const without = logsAt([400, 600, 800], () => 1.5).map((log, i) => ({
      ...log,
      id: 100 + i,
      environmentId: 999,
    }));
    const result = run([...withConditions, ...without]);
    expect(result.withoutConditions).toBe(3);
    expect(result.status).toBe('agrees');
    expect(result.distanceCount).toBe(4);
  });

  it('computes one trajectory per snapshot, not one per log', () => {
    const spy = jest.spyOn(ballistics, 'calculateTrajectory');
    run(logsAt([300, 400, 500, 600, 700, 800, 900, 1000], () => 0.3));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
