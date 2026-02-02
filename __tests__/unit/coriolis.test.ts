/**
 * Unit tests for Coriolis effect calculations
 */

import {
  calculateHorizontalCoriolis,
  calculateVerticalCoriolis,
  calculateCoriolisComplete,
  getHorizontalCoriolis,
  isCoriolisSignificant,
} from '../../src/utils/coriolis';

describe('coriolis', () => {
  describe('calculateHorizontalCoriolis', () => {
    it('should return zero at the equator', () => {
      const deflection = calculateHorizontalCoriolis(0, 1.0, 2500);
      expect(Math.abs(deflection)).toBeLessThan(0.001);
    });

    it('should return positive in Northern Hemisphere (bullet drifts right)', () => {
      const deflection = calculateHorizontalCoriolis(45, 1.0, 2500);
      expect(deflection).toBeGreaterThan(0);
    });

    it('should return negative in Southern Hemisphere (bullet drifts left)', () => {
      const deflection = calculateHorizontalCoriolis(-45, 1.0, 2500);
      expect(deflection).toBeLessThan(0);
    });

    it('should be maximum at the poles', () => {
      const at45 = Math.abs(calculateHorizontalCoriolis(45, 1.0, 2500));
      const at90 = Math.abs(calculateHorizontalCoriolis(90, 1.0, 2500));
      expect(at90).toBeGreaterThan(at45);
    });

    it('should be symmetric between hemispheres', () => {
      const north = calculateHorizontalCoriolis(45, 1.0, 2500);
      const south = calculateHorizontalCoriolis(-45, 1.0, 2500);
      expect(north).toBeCloseTo(-south, 6);
    });

    it('should increase with time of flight', () => {
      const short = calculateHorizontalCoriolis(45, 0.5, 2500);
      const long = calculateHorizontalCoriolis(45, 1.5, 2500);
      expect(Math.abs(long)).toBeGreaterThan(Math.abs(short));
    });

    it('should increase with velocity', () => {
      const slow = calculateHorizontalCoriolis(45, 1.0, 2000);
      const fast = calculateHorizontalCoriolis(45, 1.0, 3000);
      expect(Math.abs(fast)).toBeGreaterThan(Math.abs(slow));
    });

    it('should return zero for zero time of flight', () => {
      const deflection = calculateHorizontalCoriolis(45, 0, 2500);
      expect(deflection).toBe(0);
    });

    it('should clamp latitude to valid range', () => {
      const at100 = calculateHorizontalCoriolis(100, 1.0, 2500);
      const at90 = calculateHorizontalCoriolis(90, 1.0, 2500);
      expect(at100).toBe(at90);

      const atNeg100 = calculateHorizontalCoriolis(-100, 1.0, 2500);
      const atNeg90 = calculateHorizontalCoriolis(-90, 1.0, 2500);
      expect(atNeg100).toBe(atNeg90);
    });
  });

  describe('calculateVerticalCoriolis', () => {
    it('should be maximum when firing East (90°)', () => {
      const east = calculateVerticalCoriolis(45, 90, 1.0, 2500);
      const north = calculateVerticalCoriolis(45, 0, 1.0, 2500);
      expect(Math.abs(east)).toBeGreaterThan(Math.abs(north));
    });

    it('should be negative when firing West (270°)', () => {
      const west = calculateVerticalCoriolis(45, 270, 1.0, 2500);
      expect(west).toBeLessThan(0);
    });

    it('should be positive when firing East (90°)', () => {
      const east = calculateVerticalCoriolis(45, 90, 1.0, 2500);
      expect(east).toBeGreaterThan(0);
    });

    it('should be zero when firing North (0°) or South (180°)', () => {
      const north = calculateVerticalCoriolis(45, 0, 1.0, 2500);
      const south = calculateVerticalCoriolis(45, 180, 1.0, 2500);
      expect(Math.abs(north)).toBeLessThan(0.001);
      expect(Math.abs(south)).toBeLessThan(0.001);
    });

    it('should be zero at the poles', () => {
      const northPole = calculateVerticalCoriolis(90, 90, 1.0, 2500);
      const southPole = calculateVerticalCoriolis(-90, 90, 1.0, 2500);
      expect(Math.abs(northPole)).toBeLessThan(0.001);
      expect(Math.abs(southPole)).toBeLessThan(0.001);
    });

    it('should be maximum at the equator', () => {
      const equator = Math.abs(calculateVerticalCoriolis(0, 90, 1.0, 2500));
      const at45 = Math.abs(calculateVerticalCoriolis(45, 90, 1.0, 2500));
      expect(equator).toBeGreaterThan(at45);
    });

    it('should handle azimuth normalization', () => {
      const east = calculateVerticalCoriolis(45, 90, 1.0, 2500);
      const east360 = calculateVerticalCoriolis(45, 450, 1.0, 2500);
      const eastNeg = calculateVerticalCoriolis(45, -270, 1.0, 2500);
      expect(east).toBeCloseTo(east360, 6);
      expect(east).toBeCloseTo(eastNeg, 6);
    });
  });

  describe('calculateCoriolisComplete', () => {
    it('should return complete result with all fields', () => {
      const result = calculateCoriolisComplete(
        {
          latitude: 45,
          azimuth: 90,
          timeOfFlight: 1.0,
          muzzleVelocity: 2800,
          velocityAtTarget: 2200,
        },
        1000
      );

      expect(result.horizontalDeflection).toBeDefined();
      expect(result.verticalDeflection).toBeDefined();
      expect(result.horizontalMIL).toBeDefined();
      expect(result.horizontalMOA).toBeDefined();
      expect(result.verticalMIL).toBeDefined();
      expect(result.verticalMOA).toBeDefined();
      expect(result.hemisphere).toBe('Northern');
      expect(result.description).toBeDefined();
    });

    it('should identify Northern Hemisphere correctly', () => {
      const result = calculateCoriolisComplete(
        {
          latitude: 45,
          timeOfFlight: 1.0,
          muzzleVelocity: 2800,
          velocityAtTarget: 2200,
        },
        1000
      );
      expect(result.hemisphere).toBe('Northern');
    });

    it('should identify Southern Hemisphere correctly', () => {
      const result = calculateCoriolisComplete(
        {
          latitude: -45,
          timeOfFlight: 1.0,
          muzzleVelocity: 2800,
          velocityAtTarget: 2200,
        },
        1000
      );
      expect(result.hemisphere).toBe('Southern');
    });

    it('should identify Equator correctly', () => {
      const result = calculateCoriolisComplete(
        {
          latitude: 0,
          timeOfFlight: 1.0,
          muzzleVelocity: 2800,
          velocityAtTarget: 2200,
        },
        1000
      );
      expect(result.hemisphere).toBe('Equator');
    });

    it('should use average velocity for calculations', () => {
      // Result should be between using muzzle and target velocity
      const withFast = calculateHorizontalCoriolis(45, 1.0, 2800);
      const withSlow = calculateHorizontalCoriolis(45, 1.0, 2200);
      const result = calculateCoriolisComplete(
        {
          latitude: 45,
          timeOfFlight: 1.0,
          muzzleVelocity: 2800,
          velocityAtTarget: 2200,
        },
        1000
      );

      expect(result.horizontalDeflection).toBeGreaterThan(withSlow);
      expect(result.horizontalDeflection).toBeLessThan(withFast);
    });
  });

  describe('getHorizontalCoriolis', () => {
    it('should calculate horizontal Coriolis with average velocity', () => {
      const deflection = getHorizontalCoriolis(45, 1.0, 2800, 2200);
      const expected = calculateHorizontalCoriolis(45, 1.0, 2500); // (2800+2200)/2
      expect(deflection).toBeCloseTo(expected, 6);
    });
  });

  describe('isCoriolisSignificant', () => {
    it('should return false for short distances', () => {
      expect(isCoriolisSignificant(45, 200, 0.3)).toBe(false);
      expect(isCoriolisSignificant(45, 400, 0.4)).toBe(false);
    });

    it('should return false for short time of flight', () => {
      expect(isCoriolisSignificant(45, 1000, 0.3)).toBe(false);
    });

    it('should return true for long range at mid-latitudes', () => {
      expect(isCoriolisSignificant(45, 1000, 1.5)).toBe(true);
    });

    it('should return false at equator even for long range', () => {
      // At equator, horizontal Coriolis is zero
      expect(isCoriolisSignificant(0, 1000, 1.5)).toBe(false);
    });

    it('should return true at high latitudes for long range', () => {
      expect(isCoriolisSignificant(60, 1000, 1.5)).toBe(true);
    });
  });

  describe('realistic scenarios', () => {
    it('should calculate realistic values for 1000 yard shot at 45° latitude', () => {
      // .308 Win at 1000 yards: TOF ≈ 1.65s, MV ≈ 2650, V@target ≈ 1500
      const result = calculateCoriolisComplete(
        {
          latitude: 45,
          azimuth: 90, // firing East
          timeOfFlight: 1.65,
          muzzleVelocity: 2650,
          velocityAtTarget: 1500,
        },
        1000
      );

      // At 1000 yards, Coriolis horizontal should be 3-6 inches
      expect(result.horizontalDeflection).toBeGreaterThan(2);
      expect(result.horizontalDeflection).toBeLessThan(10);

      // Horizontal MIL should be 0.05-0.2 MIL
      expect(Math.abs(result.horizontalMIL)).toBeGreaterThan(0.02);
      expect(Math.abs(result.horizontalMIL)).toBeLessThan(0.5);
    });

    it('should calculate realistic values for 500 yard shot', () => {
      // At 500 yards, Coriolis should be minimal (< 3 inches)
      const result = calculateCoriolisComplete(
        {
          latitude: 45,
          timeOfFlight: 0.72,
          muzzleVelocity: 2650,
          velocityAtTarget: 2100,
        },
        500
      );

      // Horizontal deflection should be small at this range
      expect(Math.abs(result.horizontalDeflection)).toBeLessThan(3);
      // MIL should be very small (< 0.2 MIL)
      expect(Math.abs(result.horizontalMIL)).toBeLessThan(0.2);
    });

    it('should show Eötvös effect when firing East vs West', () => {
      const params = {
        latitude: 45,
        timeOfFlight: 1.65,
        muzzleVelocity: 2650,
        velocityAtTarget: 1500,
      };

      const firingEast = calculateCoriolisComplete({ ...params, azimuth: 90 }, 1000);
      const firingWest = calculateCoriolisComplete({ ...params, azimuth: 270 }, 1000);

      // Firing East should have additional drop (positive)
      expect(firingEast.verticalDeflection).toBeGreaterThan(0);

      // Firing West should have reduced drop (negative)
      expect(firingWest.verticalDeflection).toBeLessThan(0);

      // Horizontal should be the same regardless of azimuth
      expect(firingEast.horizontalDeflection).toBeCloseTo(firingWest.horizontalDeflection, 6);
    });
  });
});
