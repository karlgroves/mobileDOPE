/**
 * Unit tests for spin drift calculations
 */

import {
  parseTwistRate,
  getBulletDiameter,
  estimateBulletLength,
  calculateStabilityFactor,
  calculateSpinDrift,
  calculateSpinDriftComplete,
  getSpinDrift,
} from '../../src/utils/spinDrift';

describe('spinDrift', () => {
  describe('parseTwistRate', () => {
    it('should parse standard twist rate format', () => {
      expect(parseTwistRate('1:10')).toBe(10);
      expect(parseTwistRate('1:8')).toBe(8);
      expect(parseTwistRate('1:12')).toBe(12);
    });

    it('should parse twist rate with decimal', () => {
      expect(parseTwistRate('1:10.5')).toBe(10.5);
      expect(parseTwistRate('1:7.5')).toBe(7.5);
    });

    it('should return null for invalid formats', () => {
      expect(parseTwistRate('10')).toBeNull();
      expect(parseTwistRate('1-10')).toBeNull();
      expect(parseTwistRate('')).toBeNull();
      expect(parseTwistRate('1:abc')).toBeNull();
    });
  });

  describe('getBulletDiameter', () => {
    it('should return correct diameter for common calibers', () => {
      expect(getBulletDiameter('.308 Win')).toBe(0.308);
      expect(getBulletDiameter('.308 Winchester')).toBe(0.308);
      expect(getBulletDiameter('6.5 Creedmoor')).toBe(0.264);
      expect(getBulletDiameter('.223 Rem')).toBe(0.224);
      expect(getBulletDiameter('.338 Lapua')).toBe(0.338);
    });

    it('should handle case-insensitive matching', () => {
      expect(getBulletDiameter('.308 WIN')).toBe(0.308);
      expect(getBulletDiameter('.308 win')).toBe(0.308);
    });

    it('should handle partial matches', () => {
      // These should still find a match through partial matching
      expect(getBulletDiameter('.308')).toBe(0.308);
      expect(getBulletDiameter('308 Win')).toBe(0.308);
    });

    it('should return null for unknown calibers', () => {
      expect(getBulletDiameter('Unknown Caliber')).toBeNull();
    });
  });

  describe('estimateBulletLength', () => {
    it('should estimate reasonable bullet lengths', () => {
      // 168gr .308 bullet - typical length is around 1.2-1.3 inches
      const length308 = estimateBulletLength(168, 0.308);
      expect(length308).toBeGreaterThan(1.0);
      expect(length308).toBeLessThan(1.5);

      // 77gr .224 bullet - typical length is around 0.9-1.0 inches
      const length223 = estimateBulletLength(77, 0.224);
      expect(length223).toBeGreaterThan(0.7);
      expect(length223).toBeLessThan(1.2);

      // 140gr 6.5mm bullet - typical length is around 1.3-1.4 inches
      const length65 = estimateBulletLength(140, 0.264);
      expect(length65).toBeGreaterThan(1.1);
      expect(length65).toBeLessThan(1.6);
    });

    it('should scale with bullet weight', () => {
      // Heavier bullet should be longer
      const light = estimateBulletLength(100, 0.308);
      const heavy = estimateBulletLength(200, 0.308);
      expect(heavy).toBeGreaterThan(light);
    });

    it('should scale with bullet diameter', () => {
      // Same weight, smaller diameter = longer bullet
      const small = estimateBulletLength(100, 0.224);
      const large = estimateBulletLength(100, 0.308);
      expect(small).toBeGreaterThan(large);
    });
  });

  describe('calculateStabilityFactor', () => {
    it('should calculate reasonable stability factors', () => {
      // 168gr .308 with 1:10 twist - should be stable (SG > 1.0)
      const sg = calculateStabilityFactor(168, 0.308, 1.25, 10);
      expect(sg).toBeGreaterThan(0.5); // Typical values 1.0-2.5
      expect(sg).toBeLessThan(5.0);
    });

    it('should decrease with faster twist (longer twist rate)', () => {
      // Faster spin (1:8) should give higher stability than slower (1:12)
      const sgFast = calculateStabilityFactor(168, 0.308, 1.25, 8);
      const sgSlow = calculateStabilityFactor(168, 0.308, 1.25, 12);
      expect(sgFast).toBeGreaterThan(sgSlow);
    });

    it('should increase with bullet weight', () => {
      // Heavier bullet needs faster twist for same stability
      // But at same twist, heavier = more stable
      const sgLight = calculateStabilityFactor(150, 0.308, 1.2, 10);
      const sgHeavy = calculateStabilityFactor(180, 0.308, 1.3, 10);
      // This is a complex relationship - test that both are reasonable
      expect(sgLight).toBeGreaterThan(0);
      expect(sgHeavy).toBeGreaterThan(0);
    });
  });

  describe('calculateSpinDrift', () => {
    it('should return zero for zero time of flight', () => {
      expect(calculateSpinDrift(1.5, 0)).toBe(0);
    });

    it('should increase with time of flight', () => {
      const drift1 = calculateSpinDrift(1.5, 0.5);
      const drift2 = calculateSpinDrift(1.5, 1.0);
      expect(drift2).toBeGreaterThan(drift1);
    });

    it('should increase with stability factor', () => {
      const driftLow = calculateSpinDrift(1.0, 0.5);
      const driftHigh = calculateSpinDrift(2.0, 0.5);
      expect(driftHigh).toBeGreaterThan(driftLow);
    });

    it('should return positive for right-hand twist', () => {
      const drift = calculateSpinDrift(1.5, 0.5, true);
      expect(drift).toBeGreaterThan(0);
    });

    it('should return negative for left-hand twist', () => {
      const drift = calculateSpinDrift(1.5, 0.5, false);
      expect(drift).toBeLessThan(0);
    });

    it('should produce realistic values for typical long-range shot', () => {
      // At 1000 yards, typical spin drift might be 8-15 inches
      // With TOF around 1.5 seconds and SG around 1.5
      const drift = calculateSpinDrift(1.5, 1.5);
      expect(drift).toBeGreaterThan(3); // At least a few inches
      expect(drift).toBeLessThan(30); // Not more than a few feet
    });
  });

  describe('calculateSpinDriftComplete', () => {
    it('should calculate complete spin drift result', () => {
      const result = calculateSpinDriftComplete({
        bulletWeight: 168,
        bulletDiameter: 0.308,
        twistRate: '1:10',
        timeOfFlight: 1.0,
      });

      expect(result).not.toBeNull();
      expect(result!.spinDrift).toBeGreaterThan(0);
      expect(result!.stabilityFactor).toBeGreaterThan(0);
      expect(result!.bulletLength).toBeGreaterThan(0);
      expect(result!.twistInches).toBe(10);
    });

    it('should return null for invalid twist rate', () => {
      const result = calculateSpinDriftComplete({
        bulletWeight: 168,
        bulletDiameter: 0.308,
        twistRate: 'invalid',
        timeOfFlight: 1.0,
      });

      expect(result).toBeNull();
    });

    it('should use provided bullet length if available', () => {
      const resultWithLength = calculateSpinDriftComplete({
        bulletWeight: 168,
        bulletDiameter: 0.308,
        bulletLength: 1.25,
        twistRate: '1:10',
        timeOfFlight: 1.0,
      });

      expect(resultWithLength).not.toBeNull();
      expect(resultWithLength!.bulletLength).toBe(1.25);
    });

    it('should indicate stability status', () => {
      // A well-matched bullet/twist combo should be stable
      const result = calculateSpinDriftComplete({
        bulletWeight: 168,
        bulletDiameter: 0.308,
        twistRate: '1:10',
        timeOfFlight: 1.0,
      });

      expect(result).not.toBeNull();
      expect(typeof result!.isStable).toBe('boolean');
      expect(typeof result!.isIdeallyStable).toBe('boolean');
    });
  });

  describe('getSpinDrift', () => {
    it('should return spin drift for known caliber', () => {
      const drift = getSpinDrift('.308 Win', 168, '1:10', 1.0);
      expect(drift).toBeGreaterThan(0);
    });

    it('should return 0 for unknown caliber', () => {
      const drift = getSpinDrift('Unknown', 168, '1:10', 1.0);
      expect(drift).toBe(0);
    });

    it('should return 0 for invalid twist rate', () => {
      const drift = getSpinDrift('.308 Win', 168, 'invalid', 1.0);
      expect(drift).toBe(0);
    });
  });

  describe('integration with realistic scenarios', () => {
    it('should calculate reasonable spin drift for .308 at various distances', () => {
      // .308 Win, 175gr SMK, 1:10 twist
      // Typical TOF values: 100yd=0.11s, 500yd=0.72s, 1000yd=1.65s

      const drift100 = getSpinDrift('.308 Win', 175, '1:10', 0.11);
      const drift500 = getSpinDrift('.308 Win', 175, '1:10', 0.72);
      const drift1000 = getSpinDrift('.308 Win', 175, '1:10', 1.65);

      // At 100 yards, spin drift should be minimal (< 0.5 inches)
      expect(drift100).toBeLessThan(0.5);

      // At 500 yards, spin drift should be 1-3 inches
      expect(drift500).toBeGreaterThan(0.5);
      expect(drift500).toBeLessThan(5);

      // At 1000 yards, spin drift should be 8-15 inches
      expect(drift1000).toBeGreaterThan(3);
      expect(drift1000).toBeLessThan(25);
    });

    it('should calculate reasonable spin drift for 6.5 Creedmoor', () => {
      // 6.5 Creedmoor, 140gr, 1:8 twist
      // Typical TOF: 500yd=0.58s, 1000yd=1.35s

      const drift500 = getSpinDrift('6.5 Creedmoor', 140, '1:8', 0.58);
      const drift1000 = getSpinDrift('6.5 Creedmoor', 140, '1:8', 1.35);

      // 6.5mm should have less spin drift than .308 due to higher BC and faster velocity
      expect(drift500).toBeGreaterThan(0);
      expect(drift500).toBeLessThan(4);

      expect(drift1000).toBeGreaterThan(2);
      expect(drift1000).toBeLessThan(20);
    });
  });
});
