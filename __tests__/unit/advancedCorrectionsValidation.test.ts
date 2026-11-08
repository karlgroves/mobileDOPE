/**
 * Spin drift and Coriolis checked against their published models (#222).
 *
 * The other suites check behaviour: signs, symmetry, monotonicity, plausible
 * size. None of those caught that the Coriolis deflection was computed as
 * 2ω·v·t, which is a velocity rather than a distance, because it grows the right
 * way with every input and lands in the right order of magnitude at exactly
 * 1000 yards. This suite pins NUMBERS:
 *
 * - Coriolis against the textbook flat-fire expression ω·X·t·sin(lat) (McCoy,
 *   Modern Exterior Ballistics; Litz, Applied Ballistics), worked by hand.
 * - Coriolis again, independently, by integrating the Coriolis acceleration
 *   2ω·v·sin(lat) twice over the solver's own trajectory. This needs no
 *   approximation about the bullet's average speed, so it is the reference the
 *   closed form has to agree with.
 * - Spin drift against Litz's published formula 1.25·(Sg + 1.2)·t^1.83 and
 *   Sg against Miller's rule, worked by hand.
 *
 * What this is NOT: a comparison with third-party solver output or measured
 * range data for named loads. Spin drift in particular rests on an ESTIMATED
 * bullet length when the profile has none, and no hand calculation validates
 * that estimate.
 */

import { calculateBallisticSolution } from '../../src/utils/ballistics';
import {
  calculateCoriolisComplete,
  calculateHorizontalCoriolis,
  calculateVerticalCoriolis,
} from '../../src/utils/coriolis';
import { calculateSpinDrift, calculateStabilityFactor } from '../../src/utils/spinDrift';

import type { AmmoConfig, RifleConfig } from '../../src/types/ballistic.types';
import type { AtmosphericConditions } from '../../src/utils/atmospheric';

const OMEGA = 7.2921e-5; // rad/s
const SIN45 = Math.SQRT1_2;

describe('Coriolis against the textbook closed form', () => {
  it('matches a hand-worked horizontal deflection', () => {
    // 45° N, 1.5 s of flight at an average 2000 ft/s, so X = 3000 ft (1000 yd):
    // ω·X·t·sin(45°) = 7.2921e-5 · 3000 · 1.5 · 0.70711 = 0.23203 ft = 2.784 in
    expect(calculateHorizontalCoriolis(45, 1.5, 2000)).toBeCloseTo(2.784, 3);
  });

  it('matches a hand-worked vertical deflection when firing East', () => {
    // Same flight, azimuth 90°: ω·X·t·cos(45°)·sin(90°) = 2.784 in, upward.
    expect(calculateVerticalCoriolis(45, 90, 1.5, 2000)).toBeCloseTo(2.784, 3);
  });

  it('is a distance: it grows with the SQUARE of time at a fixed speed', () => {
    // The pre-#222 formula, 2ω·v·t, only doubled here. A deflection that is
    // linear in t at fixed v has the units of a velocity.
    const short = calculateHorizontalCoriolis(45, 1, 2500);
    const long = calculateHorizontalCoriolis(45, 2, 2500);

    expect(long / short).toBeCloseTo(4, 10);
  });

  it('subtends ω·t·sin(lat) whatever the range', () => {
    // Dividing ω·X·t·sin(lat) by X: the angle depends on time of flight alone.
    // 1000 yd in 1.5 s, with muzzle and target speeds averaging X/t = 2000 ft/s.
    const result = calculateCoriolisComplete(
      { latitude: 45, timeOfFlight: 1.5, muzzleVelocity: 2600, velocityAtTarget: 1400 },
      1000
    );

    expect(result.horizontalMIL).toBeCloseTo(OMEGA * 1.5 * SIN45 * 1000, 4);
  });
});

describe('Coriolis against the acceleration integrated over a real trajectory', () => {
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

  /**
   * The deflection from a constant-direction acceleration 2ω·trig·v(t) is
   * 2ω·trig·∫x(t)dt, where x(t) is downrange distance. The trajectory gives
   * x at each time, so a trapezoid over it is a model-free reference.
   */
  const integrated = (distance: number, trig: number) => {
    const solution = calculateBallisticSolution(
      rifle,
      ammo,
      { distance, angle: 0, windSpeed: 0, windDirection: 0, latitude: 45, azimuth: 90 },
      atmosphere,
      true
    );
    const points = (solution.trajectory ?? []).filter((p) => p.distance <= distance);

    let area = 0; // ft·s
    let prevTime = 0;
    let prevFeet = 0;
    for (const p of points) {
      const feet = p.distance * 3;
      area += ((p.time - prevTime) * (feet + prevFeet)) / 2;
      prevTime = p.time;
      prevFeet = feet;
    }

    return { solution, reference: 2 * OMEGA * trig * area * 12, points: points.length };
  };

  it.each([300, 600, 1000])('agrees within 10%% horizontally at %i yards', (distance) => {
    const { solution, reference, points } = integrated(distance, SIN45);

    expect(points).toBeGreaterThan(5);
    expect(solution.coriolisHorizontal as number).toBeGreaterThan(reference * 0.9);
    expect(solution.coriolisHorizontal as number).toBeLessThan(reference * 1.1);
  });

  it('agrees within 10% vertically when firing East at 1000 yards', () => {
    const { solution, reference } = integrated(1000, SIN45);

    expect(solution.coriolisVertical as number).toBeGreaterThan(reference * 0.9);
    expect(solution.coriolisVertical as number).toBeLessThan(reference * 1.1);
  });
});

describe('spin drift against Litz and Miller', () => {
  it('matches Litz: 1.25·(Sg + 1.2)·t^1.83', () => {
    // Sg 1.5, 1.5 s: 1.25 · 2.7 · 1.5^1.83 = 1.25 · 2.7 · 2.1001 = 7.088 in
    expect(calculateSpinDrift(1.5, 1.5)).toBeCloseTo(7.088, 3);
    expect(calculateSpinDrift(1.5, 1.5, false)).toBeCloseTo(-7.088, 3);
  });

  it('matches Miller: Sg = 30·m / (t²·d³·l·(1 + l²)), t and l in calibers', () => {
    // 168 gr, 0.308 in, 1.215 in long, 1:10. t = 32.468 cal, l = 3.9448 cal:
    // 30·168 / (1054.2 · 0.029218 · 3.9448 · 16.561) = 2.505
    expect(calculateStabilityFactor(168, 0.308, 1.215, 10)).toBeCloseTo(2.505, 3);
  });
});
