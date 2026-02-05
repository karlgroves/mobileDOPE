/**
 * Unit tests for aerodynamic jump calculations
 */

import {
  calculateAeroJumpAngle,
  calculateAeroJump,
  getWindCrossComponent,
  getAeroJumpOffset,
  isAeroJumpSignificant,
  compareJumpToDrift,
} from '../../src/utils/aerodynamicJump';

describe('aerodynamicJump', () => {
  describe('calculateAeroJumpAngle', () => {
    it('should return 0 for no crosswind', () => {
      const angle = calculateAeroJumpAngle({
        muzzleVelocity: 2700,
        crosswindFps: 0,
        stabilityFactor: 1.5,
      });
      expect(angle).toBe(0);
    });

    it('should return positive angle for right-hand twist with wind from right', () => {
      const angle = calculateAeroJumpAngle({
        muzzleVelocity: 2700,
        crosswindFps: 14.67, // 10 mph
        stabilityFactor: 1.5,
        isRightHandTwist: true,
      });
      expect(angle).toBeGreaterThan(0);
    });

    it('should return negative angle for right-hand twist with wind from left', () => {
      const angle = calculateAeroJumpAngle({
        muzzleVelocity: 2700,
        crosswindFps: -14.67, // 10 mph from left
        stabilityFactor: 1.5,
        isRightHandTwist: true,
      });
      expect(angle).toBeLessThan(0);
    });

    it('should reverse direction for left-hand twist', () => {
      const rightTwist = calculateAeroJumpAngle({
        muzzleVelocity: 2700,
        crosswindFps: 14.67,
        stabilityFactor: 1.5,
        isRightHandTwist: true,
      });

      const leftTwist = calculateAeroJumpAngle({
        muzzleVelocity: 2700,
        crosswindFps: 14.67,
        stabilityFactor: 1.5,
        isRightHandTwist: false,
      });

      expect(leftTwist).toBeCloseTo(-rightTwist, 6);
    });

    it('should increase with crosswind velocity', () => {
      const lowWind = Math.abs(
        calculateAeroJumpAngle({
          muzzleVelocity: 2700,
          crosswindFps: 7.33, // 5 mph
          stabilityFactor: 1.5,
        })
      );

      const highWind = Math.abs(
        calculateAeroJumpAngle({
          muzzleVelocity: 2700,
          crosswindFps: 14.67, // 10 mph
          stabilityFactor: 1.5,
        })
      );

      expect(highWind).toBeGreaterThan(lowWind);
    });

    it('should decrease with higher muzzle velocity', () => {
      const slowMV = Math.abs(
        calculateAeroJumpAngle({
          muzzleVelocity: 2400,
          crosswindFps: 14.67,
          stabilityFactor: 1.5,
        })
      );

      const fastMV = Math.abs(
        calculateAeroJumpAngle({
          muzzleVelocity: 3000,
          crosswindFps: 14.67,
          stabilityFactor: 1.5,
        })
      );

      expect(fastMV).toBeLessThan(slowMV);
    });

    it('should decrease with higher stability factor', () => {
      const lowSG = Math.abs(
        calculateAeroJumpAngle({
          muzzleVelocity: 2700,
          crosswindFps: 14.67,
          stabilityFactor: 1.2,
        })
      );

      const highSG = Math.abs(
        calculateAeroJumpAngle({
          muzzleVelocity: 2700,
          crosswindFps: 14.67,
          stabilityFactor: 2.0,
        })
      );

      expect(highSG).toBeLessThan(lowSG);
    });

    it('should return 0 for invalid inputs', () => {
      expect(
        calculateAeroJumpAngle({
          muzzleVelocity: 0,
          crosswindFps: 14.67,
          stabilityFactor: 1.5,
        })
      ).toBe(0);

      expect(
        calculateAeroJumpAngle({
          muzzleVelocity: 2700,
          crosswindFps: 14.67,
          stabilityFactor: 0,
        })
      ).toBe(0);
    });
  });

  describe('calculateAeroJump', () => {
    it('should return complete result with all fields', () => {
      const result = calculateAeroJump(
        {
          muzzleVelocity: 2700,
          crosswindFps: 14.67,
          stabilityFactor: 1.5,
        },
        1000
      );

      expect(result.jumpAngleMrad).toBeDefined();
      expect(result.jumpAngleMOA).toBeDefined();
      expect(result.verticalOffset).toBeDefined();
      expect(result.direction).toBeDefined();
      expect(result.description).toBeDefined();
    });

    it('should calculate consistent MOA and mrad values', () => {
      const result = calculateAeroJump(
        {
          muzzleVelocity: 2700,
          crosswindFps: 14.67,
          stabilityFactor: 1.5,
        },
        1000
      );

      // 1 mrad ≈ 3.438 MOA
      expect(result.jumpAngleMOA).toBeCloseTo(result.jumpAngleMrad * 3.438, 1);
    });

    it('should set direction to "up" for positive angle', () => {
      const result = calculateAeroJump(
        {
          muzzleVelocity: 2700,
          crosswindFps: 14.67, // from right
          stabilityFactor: 1.5,
          isRightHandTwist: true,
        },
        1000
      );

      expect(result.direction).toBe('up');
    });

    it('should set direction to "down" for negative angle', () => {
      const result = calculateAeroJump(
        {
          muzzleVelocity: 2700,
          crosswindFps: -14.67, // from left
          stabilityFactor: 1.5,
          isRightHandTwist: true,
        },
        1000
      );

      expect(result.direction).toBe('down');
    });

    it('should set direction to "none" for negligible jump', () => {
      const result = calculateAeroJump(
        {
          muzzleVelocity: 2700,
          crosswindFps: 0,
          stabilityFactor: 1.5,
        },
        1000
      );

      expect(result.direction).toBe('none');
    });

    it('should increase vertical offset with distance', () => {
      const params = {
        muzzleVelocity: 2700,
        crosswindFps: 14.67,
        stabilityFactor: 1.5,
      };

      const short = calculateAeroJump(params, 500);
      const long = calculateAeroJump(params, 1000);

      expect(Math.abs(long.verticalOffset)).toBeGreaterThan(Math.abs(short.verticalOffset));
    });
  });

  describe('getWindCrossComponent', () => {
    it('should return 0 for headwind (0°)', () => {
      const cross = getWindCrossComponent(10, 0);
      expect(Math.abs(cross)).toBeLessThan(0.01);
    });

    it('should return 0 for tailwind (180°)', () => {
      const cross = getWindCrossComponent(10, 180);
      expect(Math.abs(cross)).toBeLessThan(0.01);
    });

    it('should return positive for wind from right (90°)', () => {
      const cross = getWindCrossComponent(10, 90);
      expect(cross).toBeGreaterThan(0);
      // 10 mph = 14.67 fps
      expect(cross).toBeCloseTo(14.67, 1);
    });

    it('should return negative for wind from left (270°)', () => {
      const cross = getWindCrossComponent(10, 270);
      expect(cross).toBeLessThan(0);
      expect(cross).toBeCloseTo(-14.67, 1);
    });

    it('should return partial crosswind for quartering angles', () => {
      const cross45 = getWindCrossComponent(10, 45);
      const cross90 = getWindCrossComponent(10, 90);

      // At 45°, crosswind should be about 70% of full crosswind
      expect(cross45).toBeCloseTo(cross90 * Math.sin(Math.PI / 4), 1);
    });

    it('should scale with wind speed', () => {
      const light = getWindCrossComponent(5, 90);
      const heavy = getWindCrossComponent(20, 90);

      expect(heavy).toBeCloseTo(light * 4, 1);
    });
  });

  describe('getAeroJumpOffset', () => {
    it('should calculate offset for typical scenario', () => {
      const offset = getAeroJumpOffset(
        2700, // MV
        10, // wind speed mph
        90, // from right
        1.5, // SG
        1000 // yards
      );

      // Should be a small but measurable offset
      expect(typeof offset).toBe('number');
      expect(isFinite(offset)).toBe(true);
    });

    it('should return 0 for no crosswind', () => {
      const offset = getAeroJumpOffset(2700, 10, 0, 1.5, 1000); // headwind
      expect(Math.abs(offset)).toBeLessThan(0.1);
    });

    it('should reverse for left-hand twist', () => {
      const rightTwist = getAeroJumpOffset(2700, 10, 90, 1.5, 1000, true);
      const leftTwist = getAeroJumpOffset(2700, 10, 90, 1.5, 1000, false);

      expect(leftTwist).toBeCloseTo(-rightTwist, 6);
    });
  });

  describe('isAeroJumpSignificant', () => {
    it('should return false for no wind', () => {
      expect(isAeroJumpSignificant(0, 1.5, 1000)).toBe(false);
    });

    it('should return false for very stable bullets', () => {
      expect(isAeroJumpSignificant(10, 3.0, 1000)).toBe(false);
    });

    it('should return false for short range', () => {
      expect(isAeroJumpSignificant(10, 1.5, 100)).toBe(false);
    });

    it('should return true for marginal stability with wind at long range', () => {
      expect(isAeroJumpSignificant(15, 1.2, 1000)).toBe(true);
    });

    it('should handle edge cases', () => {
      // Very light wind
      expect(isAeroJumpSignificant(0.5, 1.5, 1000)).toBe(false);
    });
  });

  describe('compareJumpToDrift', () => {
    it('should identify when aero jump dominates', () => {
      const result = compareJumpToDrift(2.0, 0.5);
      expect(result.dominant).toBe('aero_jump');
      expect(result.ratio).toBeGreaterThan(2);
    });

    it('should identify when spin drift dominates', () => {
      const result = compareJumpToDrift(0.5, 3.0);
      expect(result.dominant).toBe('spin_drift');
      expect(result.ratio).toBeLessThan(0.5);
    });

    it('should identify when they are similar', () => {
      const result = compareJumpToDrift(1.5, 1.2);
      expect(result.dominant).toBe('similar');
    });

    it('should handle negligible values', () => {
      const result = compareJumpToDrift(0.05, 0.03);
      expect(result.dominant).toBe('similar');
      expect(result.description).toContain('negligible');
    });

    it('should handle zero spin drift', () => {
      const result = compareJumpToDrift(2.0, 0.05);
      expect(result.dominant).toBe('aero_jump');
    });
  });

  describe('realistic scenarios', () => {
    it('should calculate reasonable values for .308 at 1000 yards with 10 mph crosswind', () => {
      const result = calculateAeroJump(
        {
          muzzleVelocity: 2650,
          crosswindFps: 14.67, // 10 mph from right
          stabilityFactor: 1.8, // Well-stabilized
        },
        1000
      );

      // Should be a small vertical effect (< 1 inch typically)
      expect(Math.abs(result.verticalOffset)).toBeLessThan(2);
      expect(Math.abs(result.verticalOffset)).toBeGreaterThan(0);
    });

    it('should show larger effect for marginally stable bullet', () => {
      const stable = calculateAeroJump(
        {
          muzzleVelocity: 2650,
          crosswindFps: 14.67,
          stabilityFactor: 2.0,
        },
        1000
      );

      const marginal = calculateAeroJump(
        {
          muzzleVelocity: 2650,
          crosswindFps: 14.67,
          stabilityFactor: 1.1,
        },
        1000
      );

      expect(Math.abs(marginal.verticalOffset)).toBeGreaterThan(Math.abs(stable.verticalOffset));
    });

    it('should show that aero jump is typically smaller than spin drift at long range', () => {
      // Typical scenario: 1000 yards, 10 mph crosswind
      // Spin drift might be 8-12 inches
      // Aero jump is typically < 2 inches

      const aeroJump = getAeroJumpOffset(2650, 10, 90, 1.8, 1000);

      // Aero jump should be relatively small
      expect(Math.abs(aeroJump)).toBeLessThan(5);
    });
  });
});
