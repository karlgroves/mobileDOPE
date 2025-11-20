import { generateWindTable, type WindTableEntry } from '../../src/utils/windTable';
import type { RifleConfig, AmmoConfig } from '../../src/types/ballistic.types';
import { standardAtmosphere } from '../../src/utils/atmospheric';

describe('Wind Table Generation', () => {
  // Common test configuration - .308 Winchester 168gr BTHP
  const rifle: RifleConfig = {
    zeroDistance: 100, // yards
    sightHeight: 1.5, // inches
    twistRate: '1:10',
    barrelLength: 24,
  };

  const ammo: AmmoConfig = {
    bulletWeight: 168, // grains
    ballisticCoefficient: 0.462, // G1 BC for 168gr Sierra MatchKing
    dragModel: 'G1',
    muzzleVelocity: 2650, // fps
  };

  describe('generateWindTable', () => {
    it('should generate wind table for range of speeds', () => {
      const table = generateWindTable(rifle, ammo, 500, standardAtmosphere, {
        windSpeeds: [0, 5, 10, 15, 20],
        windDirection: 90, // Full value crosswind (right to left)
      });

      expect(table.length).toBe(5);
      expect(table[0].windSpeed).toBe(0);
      expect(table[4].windSpeed).toBe(20);
    });

    it('should show zero drift at 0 mph wind', () => {
      const table = generateWindTable(rifle, ammo, 500, standardAtmosphere, {
        windSpeeds: [0],
        windDirection: 90,
      });

      expect(table[0].windDrift).toBe(0);
      expect(table[0].windageCorrection).toBeCloseTo(0, 10); // Handle -0 vs 0
    });

    it('should calculate increasing drift with wind speed', () => {
      const table = generateWindTable(rifle, ammo, 500, standardAtmosphere, {
        windSpeeds: [5, 10, 15],
        windDirection: 90,
      });

      expect(table[0].windDrift).toBeGreaterThan(0);
      expect(table[1].windDrift).toBeGreaterThan(table[0].windDrift);
      expect(table[2].windDrift).toBeGreaterThan(table[1].windDrift);
    });

    it('should calculate wind drift in correct direction for right-to-left wind', () => {
      const table = generateWindTable(rifle, ammo, 500, standardAtmosphere, {
        windSpeeds: [10],
        windDirection: 90, // Right to left (3 o'clock)
      });

      // Right-to-left wind should push bullet left (positive drift)
      expect(table[0].windDrift).toBeGreaterThan(0);
    });

    it('should calculate wind drift in correct direction for left-to-right wind', () => {
      const table = generateWindTable(rifle, ammo, 500, standardAtmosphere, {
        windSpeeds: [10],
        windDirection: 270, // Left to right (9 o'clock)
      });

      // Left-to-right wind should push bullet right (negative drift)
      expect(table[0].windDrift).toBeLessThan(0);
    });

    it('should show minimal drift for headwind', () => {
      const headwindTable = generateWindTable(rifle, ammo, 500, standardAtmosphere, {
        windSpeeds: [10],
        windDirection: 0, // Headwind (12 o'clock)
      });

      const crosswindTable = generateWindTable(rifle, ammo, 500, standardAtmosphere, {
        windSpeeds: [10],
        windDirection: 90, // Crosswind
      });

      // Headwind should cause minimal drift compared to crosswind
      expect(Math.abs(headwindTable[0].windDrift)).toBeLessThan(
        Math.abs(crosswindTable[0].windDrift) * 0.1
      );
    });

    it('should show minimal drift for tailwind', () => {
      const tailwindTable = generateWindTable(rifle, ammo, 500, standardAtmosphere, {
        windSpeeds: [10],
        windDirection: 180, // Tailwind (6 o'clock)
      });

      const crosswindTable = generateWindTable(rifle, ammo, 500, standardAtmosphere, {
        windSpeeds: [10],
        windDirection: 90, // Crosswind
      });

      // Tailwind should cause minimal drift compared to crosswind
      expect(Math.abs(tailwindTable[0].windDrift)).toBeLessThan(
        Math.abs(crosswindTable[0].windDrift) * 0.1
      );
    });

    it("should handle angled winds (1-2 o'clock)", () => {
      const table = generateWindTable(rifle, ammo, 500, standardAtmosphere, {
        windSpeeds: [10],
        windDirection: 45, // 1:30 position
      });

      const fullCrosswind = generateWindTable(rifle, ammo, 500, standardAtmosphere, {
        windSpeeds: [10],
        windDirection: 90,
      });

      // 45-degree wind should be about 70% of full crosswind (sin(45°) ≈ 0.707)
      expect(Math.abs(table[0].windDrift)).toBeGreaterThan(
        Math.abs(fullCrosswind[0].windDrift) * 0.65
      );
      expect(Math.abs(table[0].windDrift)).toBeLessThan(
        Math.abs(fullCrosswind[0].windDrift) * 0.75
      );
    });

    it('should provide windage correction in MIL', () => {
      const table = generateWindTable(rifle, ammo, 500, standardAtmosphere, {
        windSpeeds: [10],
        windDirection: 90,
      });

      expect(table[0].windageCorrection).toBeDefined();
      expect(typeof table[0].windageCorrection).toBe('number');
      expect(Math.abs(table[0].windageCorrection)).toBeGreaterThan(0.5);
    });

    it('should generate table for multiple distances', () => {
      const distances = [100, 300, 500, 700];
      const tables = distances.map((distance) =>
        generateWindTable(rifle, ammo, distance, standardAtmosphere, {
          windSpeeds: [10],
          windDirection: 90,
        })
      );

      // Wind drift should increase with distance
      expect(tables[0][0].windDrift).toBeLessThan(tables[1][0].windDrift);
      expect(tables[1][0].windDrift).toBeLessThan(tables[2][0].windDrift);
      expect(tables[2][0].windDrift).toBeLessThan(tables[3][0].windDrift);
    });

    it('should include distance in each entry', () => {
      const table = generateWindTable(rifle, ammo, 500, standardAtmosphere, {
        windSpeeds: [5, 10],
        windDirection: 90,
      });

      expect(table[0].distance).toBe(500);
      expect(table[1].distance).toBe(500);
    });

    it('should handle default wind speed range', () => {
      const table = generateWindTable(rifle, ammo, 500, standardAtmosphere, {
        windDirection: 90,
      });

      // Should default to reasonable range (e.g., 0-20 mph in 5 mph increments)
      expect(table.length).toBeGreaterThan(0);
      expect(table[0].windSpeed).toBe(0);
    });
  });
});
