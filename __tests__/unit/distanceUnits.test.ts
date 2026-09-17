import { calculateBallisticSolution } from '../../src/utils/ballistics';
import {
  SOLVER_DISTANCE_UNIT,
  fromSolverYards,
  logDistanceInYards,
  toSolverYards,
} from '../../src/utils/distanceUnits';

import type { AmmoConfig, RifleConfig } from '../../src/types/ballistic.types';
import type { AtmosphericConditions } from '../../src/utils/atmospheric';

/**
 * The distance boundary (#106).
 *
 * The defect was never in the arithmetic -- `convertDistance` was already there
 * and already correct. It was that nothing called it, because nothing said where
 * the boundary was. So the tests that matter here are the ones that check the
 * boundary is actually crossed, not the ones that check 0.9144 is 0.9144.
 */

describe('the conversions themselves', () => {
  it('names the solver unit, so nothing has to guess', () => {
    expect(SOLVER_DISTANCE_UNIT).toBe('yards');
  });

  it('converts meters to yards on the way in', () => {
    expect(toSolverYards(600, 'meters')).toBeCloseTo(656.168, 2);
  });

  it('passes yards through untouched', () => {
    // Exactly, not approximately. A round trip through a multiply and divide
    // introduces float noise that would show up as 599.9999 on a card.
    expect(toSolverYards(600, 'yards')).toBe(600);
    expect(fromSolverYards(600, 'yards')).toBe(600);
  });

  it('converts back the other way', () => {
    expect(fromSolverYards(656.168, 'meters')).toBeCloseTo(600, 2);
  });

  it('round-trips without drift', () => {
    expect(fromSolverYards(toSolverYards(600, 'meters'), 'meters')).toBeCloseTo(600, 6);
  });
});

describe('a stored log carries its own unit', () => {
  /**
   * `DOPELogEntry` writes the distance as typed with the unit beside it, so a
   * metric log holds metres. The schema comment used to claim the column was
   * yards while storing a unit next to it; both could not be true.
   */

  it('reads a metric log as metres', () => {
    expect(logDistanceInYards({ distance: 600, distanceUnit: 'meters' })).toBeCloseTo(656.168, 2);
  });

  it('reads a yard log as yards', () => {
    expect(logDistanceInYards({ distance: 600, distanceUnit: 'yards' })).toBe(600);
  });

  it('treats a missing unit as yards', () => {
    // What every log written before the column existed contains.
    expect(logDistanceInYards({ distance: 600 })).toBe(600);
  });
});

describe('the same physical distance solves the same way', () => {
  /**
   * The assertion the whole issue reduces to. If this fails, a shooter who
   * prefers metres is dialling for a different target than one who prefers
   * yards, at the same range.
   */

  const rifle: RifleConfig = {
    zeroDistance: 100,
    sightHeight: 1.5,
    twistRate: '1:10',
    barrelLength: 24,
    caliber: '.308 Winchester',
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

  const solve = (distance: number, unit: 'yards' | 'meters') =>
    calculateBallisticSolution(
      rifle,
      ammo,
      { distance: toSolverYards(distance, unit), angle: 0, windSpeed: 10, windDirection: 90 },
      atmosphere,
      false
    );

  it('600 metres and 656.168 yards agree', () => {
    const metric = solve(600, 'meters');
    const imperial = solve(656.168, 'yards');

    expect(metric.elevationMIL).toBeCloseTo(imperial.elevationMIL, 4);
    expect(metric.windageMIL).toBeCloseTo(imperial.windageMIL, 4);
    expect(metric.drop).toBeCloseTo(imperial.drop, 3);
  });

  it('and 600 metres is meaningfully different from 600 yards', () => {
    // Guards the guard. If the conversion silently did nothing, the test above
    // would still pass -- both sides would be wrong in the same way. This is
    // the assertion that fails when the boundary stops being crossed.
    const metric = solve(600, 'meters');
    const naive = solve(600, 'yards');

    expect(metric.elevationMIL).toBeGreaterThan(naive.elevationMIL);
    expect(Math.abs(metric.drop - naive.drop)).toBeGreaterThan(5);
  });
});
