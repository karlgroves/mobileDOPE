import {
  calculatePressureAltitude,
  calculateDensityAltitude,
  calculateSpeedOfSound,
  calculateAirDensity,
  standardAtmosphere,
} from '../../src/utils/atmospheric';

describe('Atmospheric Calculations', () => {
  describe('calculatePressureAltitude', () => {
    it('should calculate pressure altitude at sea level with standard pressure', () => {
      const result = calculatePressureAltitude(29.92, 0);
      expect(result).toBeCloseTo(0, 0);
    });

    it('should calculate pressure altitude with non-standard pressure', () => {
      // 1 inHg difference = ~1000 feet
      const result = calculatePressureAltitude(30.92, 0);
      expect(result).toBeCloseTo(-1000, 0);
    });

    it('should calculate pressure altitude at elevation', () => {
      // At 5000 ft elevation with lower pressure (25.84 inHg)
      // Pressure altitude will be higher than station altitude
      const result = calculatePressureAltitude(25.84, 5000);
      expect(result).toBeGreaterThan(8000);
      expect(result).toBeLessThan(10000);
    });

    it('should handle low pressure systems', () => {
      const result = calculatePressureAltitude(28.92, 0);
      expect(result).toBeCloseTo(1000, 0);
    });
  });

  describe('calculateDensityAltitude', () => {
    it('should calculate density altitude at standard conditions', () => {
      // Standard: 59°F, 29.92 inHg at sea level
      const result = calculateDensityAltitude(59, 29.92, 0);
      expect(result).toBeCloseTo(0, 50);
    });

    it('should calculate higher density altitude in hot weather', () => {
      // Hot day at sea level
      const result = calculateDensityAltitude(95, 29.92, 0);
      expect(result).toBeGreaterThan(2000);
    });

    it('should calculate lower density altitude in cold weather', () => {
      // Cold day at sea level
      const result = calculateDensityAltitude(32, 29.92, 0);
      expect(result).toBeLessThan(0);
    });

    it('should handle high altitude with temperature', () => {
      const result = calculateDensityAltitude(50, 25.84, 5000);
      expect(result).toBeGreaterThan(5000);
    });

    it('should calculate extreme conditions', () => {
      // Death Valley: 120°F at -282 ft
      const result = calculateDensityAltitude(120, 30.0, -282);
      expect(result).toBeGreaterThan(3000);
    });
  });

  describe('calculateSpeedOfSound', () => {
    it('should calculate speed of sound at standard temperature', () => {
      // 59°F = standard
      const result = calculateSpeedOfSound(59);
      expect(result).toBeCloseTo(1116, 0);
    });

    it('should calculate speed of sound at freezing', () => {
      // 32°F
      const result = calculateSpeedOfSound(32);
      expect(result).toBeCloseTo(1087, 0);
    });

    it('should calculate speed of sound at 100°F', () => {
      const result = calculateSpeedOfSound(100);
      expect(result).toBeCloseTo(1160, 0);
    });

    it('should handle negative temperatures', () => {
      const result = calculateSpeedOfSound(-40);
      expect(result).toBeGreaterThan(1000);
      expect(result).toBeLessThan(1100);
    });
  });

  describe('calculateAirDensity', () => {
    it('should calculate air density at standard conditions', () => {
      const result = calculateAirDensity(59, 29.92);
      expect(result).toBeCloseTo(0.0765, 4);
    });

    it('should calculate lower density at high temperature', () => {
      const standardDensity = calculateAirDensity(59, 29.92);
      const hotDensity = calculateAirDensity(100, 29.92);
      expect(hotDensity).toBeLessThan(standardDensity);
    });

    it('should calculate higher density at low temperature', () => {
      const standardDensity = calculateAirDensity(59, 29.92);
      const coldDensity = calculateAirDensity(32, 29.92);
      expect(coldDensity).toBeGreaterThan(standardDensity);
    });

    it('should calculate lower density at low pressure', () => {
      const standardDensity = calculateAirDensity(59, 29.92);
      const lowPressureDensity = calculateAirDensity(59, 28.0);
      expect(lowPressureDensity).toBeLessThan(standardDensity);
    });
  });

  describe('standardAtmosphere', () => {
    it('should provide standard sea level conditions', () => {
      const std = standardAtmosphere;
      expect(std.temperature).toBe(59);
      expect(std.pressure).toBe(29.92);
      expect(std.altitude).toBe(0);
    });

    it('should have reasonable density', () => {
      expect(standardAtmosphere.density).toBeCloseTo(0.0765, 4);
    });

    it('should have reasonable speed of sound', () => {
      expect(standardAtmosphere.speedOfSound).toBeCloseTo(1116, 0);
    });
  });
});
