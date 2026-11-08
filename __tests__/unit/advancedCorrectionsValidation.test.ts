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
 * - Coriolis again, independently, by integrating over the solver's own
 *   trajectory. Drag slows the sideways velocity the Coriolis acceleration
 *   builds up in the same proportion as the bullet, so the deflection is
 *   2ω·trig·∫t dx, not the drag-free 2ω·trig·∫x dt (which is about 30% high at
 *   1000 yards). This needs no assumption about an average speed, so it is the
 *   reference the closed form has to agree with.
 * - Coriolis against Litz's published magnitudes for a typical 1000 yard
 *   small-arms trajectory at 45° latitude: 2.5-3.0" right, and 2.5-3.0" high
 *   firing East, low firing West (Applied Ballistics, "Gyroscopic (spin) Drift
 *   and Coriolis Effect").
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
  dragLaggedVelocity,
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

  it('subtends exactly ω·t·sin(lat) at constant speed', () => {
    // 1000 yd in 1.5 s at a steady 2000 ft/s: ω·X·t·sin(lat) divided by X.
    const result = calculateCoriolisComplete(
      { latitude: 45, timeOfFlight: 1.5, muzzleVelocity: 2000, velocityAtTarget: 2000 },
      1000
    );

    expect(result.horizontalMIL).toBeCloseTo(OMEGA * 1.5 * SIN45 * 1000, 4);
  });

  it('subtends less than ω·t·sin(lat) when drag slows the bullet', () => {
    // Same range and time, slowing from 2600 to 1400 ft/s. The drag-lagged
    // speed is 2·(2250 + 9e6·(1/2600 − 1/1400)/12)/1.5² = 2·2002.75/2.25
    // = 1780.2 ft/s, below the 2000 ft/s mean of the two.
    expect(dragLaggedVelocity(3000, 1.5, 2600, 1400)).toBeCloseTo(1780.2, 1);

    const result = calculateCoriolisComplete(
      { latitude: 45, timeOfFlight: 1.5, muzzleVelocity: 2600, velocityAtTarget: 1400 },
      1000
    );

    expect(result.horizontalMIL).toBeLessThan(OMEGA * 1.5 * SIN45 * 1000);
  });

  it('falls back to the mean speed when the inputs describe no flight', () => {
    expect(dragLaggedVelocity(0, 1.5, 2600, 1400)).toBe(2000);
    expect(dragLaggedVelocity(3000, 0, 2600, 1400)).toBe(2000);
    expect(dragLaggedVelocity(3000, 1.5, 2600, 0)).toBe(1300);
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

  const solve = (distance: number, latitude = 45, azimuth = 90) =>
    calculateBallisticSolution(
      rifle,
      ammo,
      { distance, angle: 0, windSpeed: 0, windDirection: 0, latitude, azimuth },
      atmosphere,
      true
    );

  /**
   * A sideways acceleration 2ω·trig·v(t), with drag slowing the sideways speed
   * in proportion to the bullet's, leaves a sideways speed of 2ω·trig·t·v(t),
   * so the deflection is 2ω·trig·∫t dx over the downrange distance x. The
   * trajectory gives t at each x, so a trapezoid over it is the reference.
   */
  const integrated = (distance: number, trig: number) => {
    const solution = solve(distance);
    const points = (solution.trajectory ?? []).filter((p) => p.distance <= distance);

    let area = 0; // ft·s
    let prevTime = 0;
    let prevFeet = 0;
    for (const p of points) {
      const feet = p.distance * 3;
      area += ((feet - prevFeet) * (p.time + prevTime)) / 2;
      prevTime = p.time;
      prevFeet = feet;
    }

    return { solution, reference: 2 * OMEGA * trig * area * 12, points: points.length };
  };

  it.each([300, 600, 1000])('agrees within 2%% horizontally at %i yards', (distance) => {
    const { solution, reference, points } = integrated(distance, SIN45);

    expect(points).toBeGreaterThan(5);
    expect(solution.coriolisHorizontal as number).toBeGreaterThan(reference * 0.98);
    expect(solution.coriolisHorizontal as number).toBeLessThan(reference * 1.02);
  });

  it('agrees within 5% horizontally through the transonic range at 1500 yards', () => {
    const { solution, reference } = integrated(1500, SIN45);

    expect(solution.coriolisHorizontal as number).toBeGreaterThan(reference * 0.95);
    expect(solution.coriolisHorizontal as number).toBeLessThan(reference * 1.05);
  });

  it('agrees within 2% vertically when firing East at 1000 yards', () => {
    const { solution, reference } = integrated(1000, SIN45);

    expect(solution.coriolisVertical as number).toBeGreaterThan(reference * 0.98);
    expect(solution.coriolisVertical as number).toBeLessThan(reference * 1.02);
  });

  describe("Litz's published 2.5-3.0 inches at 1000 yards and 45°", () => {
    it('drifts right in the northern hemisphere, whatever the azimuth', () => {
      for (const azimuth of [0, 90, 180, 270]) {
        const h = solve(1000, 45, azimuth).coriolisHorizontal as number;

        expect(h).toBeGreaterThanOrEqual(2.5);
        expect(h).toBeLessThanOrEqual(3.0);
      }
    });

    it('drifts left by the same amount in the southern hemisphere', () => {
      const north = solve(1000, 45).coriolisHorizontal as number;
      const south = solve(1000, -45).coriolisHorizontal as number;

      expect(south).toBeCloseTo(-north, 10);
    });

    it('strikes high firing East and low firing West, by the same amount', () => {
      const east = solve(1000, 45, 90).coriolisVertical as number;
      const west = solve(1000, 45, 270).coriolisVertical as number;

      expect(east).toBeGreaterThanOrEqual(2.5);
      expect(east).toBeLessThanOrEqual(3.0);
      expect(west).toBeCloseTo(-east, 10);
    });

    it('has no vertical term firing North or South', () => {
      expect(solve(1000, 45, 0).coriolisVertical as number).toBeCloseTo(0, 10);
      expect(solve(1000, 45, 180).coriolisVertical as number).toBeCloseTo(0, 10);
    });
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
