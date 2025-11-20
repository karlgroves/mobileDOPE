/**
 * Unit tests for formatting utilities
 * Following TDD - write tests first, then implementation
 */

import {
  formatNumber,
  formatDistance,
  formatVelocity,
  formatAngular,
  formatTemperature,
  formatPressure,
  formatHumidity,
  formatWind,
  formatGroupSize,
  formatDate,
  formatTime,
  formatDateTime,
} from '../../src/utils/formatting';

describe('Number Formatting', () => {
  describe('formatNumber', () => {
    it('should format numbers with specified decimals', () => {
      expect(formatNumber(123.456, 2)).toBe('123.46');
      expect(formatNumber(123.456, 1)).toBe('123.5');
      expect(formatNumber(123.456, 0)).toBe('123');
    });

    it('should handle zero', () => {
      expect(formatNumber(0, 2)).toBe('0.00');
    });

    it('should handle negative numbers', () => {
      expect(formatNumber(-123.456, 2)).toBe('-123.46');
    });
  });
});

describe('Distance Formatting', () => {
  describe('formatDistance', () => {
    it('should format yards with abbreviation', () => {
      expect(formatDistance(100, 'yards')).toBe('100.0 yd');
      expect(formatDistance(500, 'yards')).toBe('500.0 yd');
    });

    it('should format meters with abbreviation', () => {
      expect(formatDistance(100, 'meters')).toBe('100.0 m');
      expect(formatDistance(457.2, 'meters')).toBe('457.2 m');
    });

    it('should respect decimal places', () => {
      expect(formatDistance(100.123, 'yards', 2)).toBe('100.12 yd');
      expect(formatDistance(100.123, 'yards', 0)).toBe('100 yd');
    });
  });
});

describe('Velocity Formatting', () => {
  describe('formatVelocity', () => {
    it('should format fps with abbreviation', () => {
      expect(formatVelocity(2800, 'fps')).toBe('2800 fps');
      expect(formatVelocity(3000, 'fps')).toBe('3000 fps');
    });

    it('should format mps with abbreviation', () => {
      expect(formatVelocity(853, 'mps')).toBe('853 mps');
    });

    it('should use no decimals by default', () => {
      expect(formatVelocity(2800.456, 'fps')).toBe('2800 fps');
    });

    it('should respect decimal places when specified', () => {
      expect(formatVelocity(2800.456, 'fps', 2)).toBe('2800.46 fps');
    });
  });
});

describe('Angular Formatting', () => {
  describe('formatAngular', () => {
    it('should format MIL with abbreviation', () => {
      expect(formatAngular(2.5, 'MIL')).toBe('2.50 MIL');
      expect(formatAngular(1.25, 'MIL')).toBe('1.25 MIL');
    });

    it('should format MOA with abbreviation', () => {
      expect(formatAngular(8.6, 'MOA')).toBe('8.60 MOA');
      expect(formatAngular(4.3, 'MOA')).toBe('4.30 MOA');
    });

    it('should default to 2 decimal places', () => {
      expect(formatAngular(2.123456, 'MIL')).toBe('2.12 MIL');
    });

    it('should respect decimal places when specified', () => {
      expect(formatAngular(2.123456, 'MIL', 3)).toBe('2.123 MIL');
      expect(formatAngular(2.123456, 'MIL', 1)).toBe('2.1 MIL');
    });
  });
});

describe('Environmental Formatting', () => {
  describe('formatTemperature', () => {
    it('should format temperature with degree symbol', () => {
      expect(formatTemperature(59)).toBe('59°F');
      expect(formatTemperature(75)).toBe('75°F');
    });

    it('should handle negative temperatures', () => {
      expect(formatTemperature(-10)).toBe('-10°F');
    });

    it('should use no decimals by default', () => {
      expect(formatTemperature(59.6)).toBe('60°F');
    });
  });

  describe('formatPressure', () => {
    it('should format pressure with inHg', () => {
      expect(formatPressure(29.92)).toBe('29.92 inHg');
      expect(formatPressure(30.0)).toBe('30.00 inHg');
    });

    it('should default to 2 decimal places', () => {
      expect(formatPressure(29.925)).toBe('29.93 inHg');
    });
  });

  describe('formatHumidity', () => {
    it('should format humidity as percentage', () => {
      expect(formatHumidity(50)).toBe('50%');
      expect(formatHumidity(75)).toBe('75%');
    });

    it('should use no decimals by default', () => {
      expect(formatHumidity(50.6)).toBe('51%');
    });
  });

  describe('formatWind', () => {
    it('should format wind with speed and direction', () => {
      expect(formatWind(10, 90)).toBe('10 mph @ 90°');
      expect(formatWind(5, 180)).toBe('5 mph @ 180°');
    });

    it('should use no decimals for speed by default', () => {
      expect(formatWind(10.6, 90)).toBe('11 mph @ 90°');
    });

    it('should always use no decimals for direction', () => {
      expect(formatWind(10, 90.6)).toBe('10 mph @ 91°');
    });
  });
});

describe('Group Size Formatting', () => {
  describe('formatGroupSize', () => {
    it('should format group size in inches', () => {
      expect(formatGroupSize(1.5)).toBe('1.50"');
      expect(formatGroupSize(2.25)).toBe('2.25"');
    });

    it('should default to 2 decimal places', () => {
      expect(formatGroupSize(1.234)).toBe('1.23"');
    });

    it('should respect decimal places when specified', () => {
      expect(formatGroupSize(1.234, 3)).toBe('1.234"');
      expect(formatGroupSize(1.234, 1)).toBe('1.2"');
    });
  });
});

describe('Date/Time Formatting', () => {
  describe('formatDate', () => {
    it('should format date as MM/DD/YYYY', () => {
      const date = new Date(2024, 0, 15); // Jan 15, 2024
      expect(formatDate(date)).toBe('01/15/2024');
    });

    it('should handle single-digit months and days', () => {
      const date = new Date(2024, 8, 5); // Sep 5, 2024
      expect(formatDate(date)).toBe('09/05/2024');
    });
  });

  describe('formatTime', () => {
    it('should format time as HH:MM AM/PM', () => {
      const date = new Date(2024, 0, 15, 14, 30); // 2:30 PM
      expect(formatTime(date)).toBe('2:30 PM');
    });

    it('should handle midnight', () => {
      const date = new Date(2024, 0, 15, 0, 0); // 12:00 AM
      expect(formatTime(date)).toBe('12:00 AM');
    });

    it('should handle noon', () => {
      const date = new Date(2024, 0, 15, 12, 0); // 12:00 PM
      expect(formatTime(date)).toBe('12:00 PM');
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time together', () => {
      const date = new Date(2024, 0, 15, 14, 30); // Jan 15, 2024 2:30 PM
      expect(formatDateTime(date)).toBe('01/15/2024 2:30 PM');
    });
  });
});
