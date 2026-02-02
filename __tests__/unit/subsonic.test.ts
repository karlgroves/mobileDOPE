/**
 * Unit tests for subsonic transition detection
 */

import {
  getFlightRegime,
  calculateMach,
  isSubsonic,
  isTransonic,
  detectSubsonicTransition,
  willRemainSupersonic,
  estimateMaxSupersonicRange,
  getSupersonicMargin,
  getMachMargin,
  TRANSONIC_UPPER,
  TRANSONIC_LOWER,
  SONIC,
  STANDARD_SPEED_OF_SOUND,
} from '../../src/utils/subsonic';

describe('subsonic', () => {
  describe('getFlightRegime', () => {
    it('should return supersonic for Mach > 1.2', () => {
      expect(getFlightRegime(1.5)).toBe('supersonic');
      expect(getFlightRegime(2.0)).toBe('supersonic');
      expect(getFlightRegime(1.21)).toBe('supersonic');
    });

    it('should return transonic for Mach between 0.8 and 1.2', () => {
      expect(getFlightRegime(1.0)).toBe('transonic');
      expect(getFlightRegime(0.9)).toBe('transonic');
      expect(getFlightRegime(1.1)).toBe('transonic');
      expect(getFlightRegime(0.81)).toBe('transonic');
      expect(getFlightRegime(1.19)).toBe('transonic');
    });

    it('should return subsonic for Mach < 0.8', () => {
      expect(getFlightRegime(0.7)).toBe('subsonic');
      expect(getFlightRegime(0.5)).toBe('subsonic');
      expect(getFlightRegime(0.79)).toBe('subsonic');
    });

    it('should handle boundary values correctly', () => {
      expect(getFlightRegime(TRANSONIC_UPPER)).toBe('supersonic');
      expect(getFlightRegime(TRANSONIC_LOWER)).toBe('subsonic');
    });
  });

  describe('calculateMach', () => {
    it('should calculate Mach number correctly', () => {
      expect(calculateMach(1125.33, 1125.33)).toBeCloseTo(1.0, 4);
      expect(calculateMach(2250.66, 1125.33)).toBeCloseTo(2.0, 4);
      expect(calculateMach(562.67, 1125.33)).toBeCloseTo(0.5, 4);
    });

    it('should use standard speed of sound if given zero', () => {
      const mach = calculateMach(1125.33, 0);
      expect(mach).toBeCloseTo(1.0, 4);
    });

    it('should handle different temperatures via speed of sound', () => {
      // At higher temps, speed of sound is higher
      const machCold = calculateMach(2000, 1050); // Lower speed of sound (cold)
      const machWarm = calculateMach(2000, 1150); // Higher speed of sound (warm)
      expect(machCold).toBeGreaterThan(machWarm);
    });
  });

  describe('isSubsonic', () => {
    it('should return true for subsonic velocities', () => {
      expect(isSubsonic(900, 59)).toBe(true);
      expect(isSubsonic(1000, 59)).toBe(true);
    });

    it('should return false for supersonic velocities', () => {
      expect(isSubsonic(1500, 59)).toBe(false);
      expect(isSubsonic(2000, 59)).toBe(false);
    });

    it('should account for temperature effects', () => {
      // Cold air has lower speed of sound
      const coldResult = isSubsonic(1100, 0); // Speed of sound ~1050 fps
      const warmResult = isSubsonic(1100, 100); // Speed of sound ~1160 fps

      // 1100 fps is supersonic in cold air but may be subsonic in warm air
      expect(coldResult).toBe(false); // supersonic
      expect(warmResult).toBe(true); // subsonic
    });
  });

  describe('isTransonic', () => {
    it('should return true for transonic velocities', () => {
      // At 59°F, speed of sound ≈ 1125 fps
      // Transonic: Mach 0.8-1.2 = 900-1350 fps
      expect(isTransonic(1000, 59)).toBe(true);
      expect(isTransonic(1125, 59)).toBe(true);
      expect(isTransonic(1200, 59)).toBe(true);
    });

    it('should return false for supersonic velocities', () => {
      expect(isTransonic(2000, 59)).toBe(false);
      expect(isTransonic(1500, 59)).toBe(false);
    });

    it('should return false for subsonic velocities', () => {
      expect(isTransonic(800, 59)).toBe(false);
      expect(isTransonic(700, 59)).toBe(false);
    });
  });

  describe('detectSubsonicTransition', () => {
    const createTrajectory = (velocities: number[]): { distance: number; velocity: number }[] => {
      return velocities.map((v, i) => ({
        distance: i * 100,
        velocity: v,
      }));
    };

    it('should detect bullet staying supersonic', () => {
      const trajectory = createTrajectory([2800, 2600, 2400, 2200, 2000, 1800, 1600, 1400]);

      const result = detectSubsonicTransition(trajectory, 59, 500);

      expect(result.goesSubsonic).toBe(false);
      expect(result.flightRegime).toBe('supersonic');
      expect(result.machAtTarget).toBeGreaterThan(TRANSONIC_UPPER);
      expect(result.warning).toBeNull();
    });

    it('should detect bullet going subsonic', () => {
      const trajectory = createTrajectory([2800, 2400, 2000, 1600, 1200, 1000, 900, 850]);

      const result = detectSubsonicTransition(trajectory, 59, 700);

      expect(result.goesSubsonic).toBe(true);
      expect(result.transonicDistance).not.toBeNull();
      expect(result.transonicDistance).toBeLessThan(700);
      expect(result.warning).not.toBeNull();
    });

    it('should identify transonic flight at target', () => {
      // Create trajectory that ends in transonic range
      const trajectory = createTrajectory([2800, 2400, 2000, 1600, 1300, 1150, 1050, 1000]);

      const result = detectSubsonicTransition(trajectory, 59, 600);

      expect(result.flightRegime).toBe('transonic');
      expect(result.machAtTarget).toBeLessThan(TRANSONIC_UPPER);
      expect(result.machAtTarget).toBeGreaterThan(TRANSONIC_LOWER);
    });

    it('should calculate transonic distance accurately', () => {
      // Speed of sound at 59°F ≈ 1125 fps
      // Create trajectory crossing Mach 1.0 between 500 and 600 yards
      const trajectory = createTrajectory([2800, 2400, 2000, 1600, 1300, 1200, 1050, 900]);

      const result = detectSubsonicTransition(trajectory, 59, 700);

      // Should detect transition around 500-600 yards
      expect(result.transonicDistance).not.toBeNull();
      expect(result.transonicDistance).toBeGreaterThan(400);
      expect(result.transonicDistance).toBeLessThan(700);
    });

    it('should handle empty trajectory', () => {
      const result = detectSubsonicTransition([], 59, 500);

      expect(result.goesSubsonic).toBe(false);
      expect(result.velocityAtTarget).toBe(0);
    });

    it('should provide warning for early subsonic transition', () => {
      // Bullet goes subsonic way before target
      const trajectory = createTrajectory([1500, 1300, 1100, 950, 850, 800, 780, 760]);

      const result = detectSubsonicTransition(trajectory, 59, 700);

      expect(result.warning).not.toBeNull();
      expect(result.warning).toContain('well before');
    });
  });

  describe('willRemainSupersonic', () => {
    it('should return true for high BC bullets at moderate distance', () => {
      // .308 175gr SMK at 500 yards with high BC
      expect(willRemainSupersonic(2650, 0.505, 500, 59)).toBe(true);
    });

    it('should return false for very long distance', () => {
      // Most bullets will go subsonic by 2500+ yards with this model
      expect(willRemainSupersonic(2650, 0.400, 2500, 59)).toBe(false);
    });

    it('should account for muzzle velocity', () => {
      // Higher MV = stays supersonic longer
      const highMV = willRemainSupersonic(3000, 0.400, 1000, 59);
      const lowMV = willRemainSupersonic(2400, 0.400, 1000, 59);

      // Higher MV should stay supersonic at same distance more often
      // (though both might be true or false, highMV should not be false when lowMV is true)
      if (lowMV) expect(highMV).toBe(true);
    });

    it('should account for ballistic coefficient', () => {
      // Higher BC = stays supersonic longer
      const highBC = willRemainSupersonic(2650, 0.600, 2000, 59);
      const lowBC = willRemainSupersonic(2650, 0.200, 2000, 59);

      // High BC should stay supersonic when low BC doesn't
      expect(highBC).toBe(true);
      expect(lowBC).toBe(false);
    });
  });

  describe('estimateMaxSupersonicRange', () => {
    it('should return reasonable range for typical bullets', () => {
      // .308 175gr SMK: MV 2650, BC 0.505
      // Note: This is a simplified estimate, actual range depends on many factors
      const range = estimateMaxSupersonicRange(2650, 0.505, 59);

      // Should be somewhere between 1000-3000 yards with simplified model
      expect(range).toBeGreaterThan(1000);
      expect(range).toBeLessThan(3000);
    });

    it('should increase with higher BC', () => {
      const lowBC = estimateMaxSupersonicRange(2650, 0.300, 59);
      const highBC = estimateMaxSupersonicRange(2650, 0.600, 59);

      expect(highBC).toBeGreaterThan(lowBC);
    });

    it('should increase with higher muzzle velocity', () => {
      const lowMV = estimateMaxSupersonicRange(2400, 0.450, 59);
      const highMV = estimateMaxSupersonicRange(3000, 0.450, 59);

      expect(highMV).toBeGreaterThan(lowMV);
    });

    it('should return 0 if already subsonic at muzzle', () => {
      const range = estimateMaxSupersonicRange(900, 0.450, 59);
      expect(range).toBe(0);
    });

    it('should account for temperature', () => {
      // Cold air: lower speed of sound = bullet stays supersonic longer
      // Warm air: higher speed of sound = bullet goes subsonic sooner
      const cold = estimateMaxSupersonicRange(2650, 0.450, 20);
      const warm = estimateMaxSupersonicRange(2650, 0.450, 100);

      expect(cold).toBeGreaterThan(warm);
    });
  });

  describe('getSupersonicMargin', () => {
    it('should return positive for supersonic', () => {
      const margin = getSupersonicMargin(1500, 59);
      expect(margin).toBeGreaterThan(0);
    });

    it('should return negative for subsonic', () => {
      const margin = getSupersonicMargin(900, 59);
      expect(margin).toBeLessThan(0);
    });

    it('should return approximately zero at speed of sound', () => {
      // Speed of sound at 59°F is calculated by atmospheric module
      // Just verify that velocity equal to speed of sound gives margin near zero
      const speedOfSound = 1116; // Approximate value used internally
      const margin = getSupersonicMargin(speedOfSound, 59);
      // Margin should be relatively small (within 50 fps) at this velocity
      expect(Math.abs(margin)).toBeLessThan(50);
    });
  });

  describe('getMachMargin', () => {
    it('should return positive for supersonic', () => {
      const margin = getMachMargin(1500, 59);
      expect(margin).toBeGreaterThan(0);
    });

    it('should return negative for subsonic', () => {
      const margin = getMachMargin(900, 59);
      expect(margin).toBeLessThan(0);
    });

    it('should return approximately zero at Mach 1', () => {
      // At 59°F, Mach 1 ≈ 1125 fps
      const margin = getMachMargin(1125, 59);
      expect(Math.abs(margin)).toBeLessThan(0.01);
    });
  });

  describe('realistic scenarios', () => {
    it('should detect .308 175gr going subsonic around 1600+ yards', () => {
      // Realistic .308 175gr SMK trajectory
      // Speed of sound at 59°F is about 1133 fps
      const trajectory = [
        { distance: 0, velocity: 2650 },
        { distance: 100, velocity: 2541 },
        { distance: 200, velocity: 2434 },
        { distance: 300, velocity: 2330 },
        { distance: 400, velocity: 2228 },
        { distance: 500, velocity: 2129 },
        { distance: 600, velocity: 2032 },
        { distance: 700, velocity: 1938 },
        { distance: 800, velocity: 1846 },
        { distance: 900, velocity: 1756 },
        { distance: 1000, velocity: 1668 },
        { distance: 1100, velocity: 1581 },
        { distance: 1200, velocity: 1495 },
        { distance: 1300, velocity: 1409 },
        { distance: 1400, velocity: 1321 },
        { distance: 1500, velocity: 1228 },
        { distance: 1600, velocity: 1120 }, // Below Mach 1 (~1133 fps at 59°F)
        { distance: 1700, velocity: 1020 },
      ];

      const result = detectSubsonicTransition(trajectory, 59, 1000);

      // At 1000 yards, .308 175gr should still be supersonic
      expect(result.goesSubsonic).toBe(false);
      expect(result.flightRegime).toBe('supersonic');
      expect(result.machAtTarget).toBeGreaterThan(1.2);

      // Test at 1700 yards where it should have crossed Mach 1
      const result1700 = detectSubsonicTransition(trajectory, 59, 1700);
      expect(result1700.goesSubsonic).toBe(true);
      expect(result1700.transonicDistance).toBeGreaterThan(1500);
      expect(result1700.transonicDistance).toBeLessThan(1700);
    });

    it('should show subsonic 300 Blackout is transonic/subsonic from start', () => {
      // .300 Blackout subsonic load
      // Speed of sound at 59°F ≈ 1133 fps, Mach 0.8 ≈ 907 fps
      const trajectory = [
        { distance: 0, velocity: 1050 },
        { distance: 50, velocity: 1020 },
        { distance: 100, velocity: 990 },
        { distance: 150, velocity: 920 },
        { distance: 200, velocity: 880 },
      ];

      const result = detectSubsonicTransition(trajectory, 59, 200);

      // At 200 yards with velocity 880 fps, should be subsonic (below Mach 0.8 = 907)
      expect(result.flightRegime).toBe('subsonic');
      expect(result.machAtTarget).toBeLessThan(TRANSONIC_LOWER);
    });
  });
});
