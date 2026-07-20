/**
 * Unit tests for validation utilities
 * Following TDD - write tests first, then implementation
 */

import {
  isValidDistance,
  isValidVelocity,
  isValidBallisticCoefficient,
  isValidBulletWeight,
  isValidTemperature,
  isValidHumidity,
  isValidPressure,
  isValidAltitude,
  isValidWindSpeed,
  isValidWindDirection,
  isValidLatitude,
  isValidLongitude,
  isValidBarrelLength,
  isValidZeroDistance,
  isValidScopeHeight,
  isValidClickValue,
  validate,
} from '../../src/utils/validation';

describe('Distance Validation', () => {
  describe('isValidDistance', () => {
    it('should accept valid distances', () => {
      expect(isValidDistance(100)).toBe(true);
      expect(isValidDistance(500)).toBe(true);
      expect(isValidDistance(1000)).toBe(true);
    });

    it('should reject negative distances', () => {
      expect(isValidDistance(-100)).toBe(false);
    });

    it('should reject zero distance', () => {
      expect(isValidDistance(0)).toBe(false);
    });

    it('should reject excessively large distances', () => {
      expect(isValidDistance(5000)).toBe(false);
    });
  });
});

describe('Velocity Validation', () => {
  describe('isValidVelocity', () => {
    it('should accept valid velocities', () => {
      expect(isValidVelocity(2800)).toBe(true);
      expect(isValidVelocity(3000)).toBe(true);
      expect(isValidVelocity(1000)).toBe(true);
    });

    it('should reject negative velocities', () => {
      expect(isValidVelocity(-100)).toBe(false);
    });

    it('should reject zero velocity', () => {
      expect(isValidVelocity(0)).toBe(false);
    });

    it('should reject excessively high velocities', () => {
      expect(isValidVelocity(6000)).toBe(false);
    });
  });
});

describe('Ballistic Coefficient Validation', () => {
  describe('isValidBallisticCoefficient', () => {
    it('should accept valid BCs', () => {
      expect(isValidBallisticCoefficient(0.5)).toBe(true);
      expect(isValidBallisticCoefficient(0.308)).toBe(true);
      expect(isValidBallisticCoefficient(0.7)).toBe(true);
    });

    it('should reject negative BCs', () => {
      expect(isValidBallisticCoefficient(-0.5)).toBe(false);
    });

    it('should reject zero BC', () => {
      expect(isValidBallisticCoefficient(0)).toBe(false);
    });

    it('should reject BC greater than 1', () => {
      expect(isValidBallisticCoefficient(1.5)).toBe(false);
    });
  });
});

describe('Bullet Weight Validation', () => {
  describe('isValidBulletWeight', () => {
    it('should accept valid bullet weights', () => {
      expect(isValidBulletWeight(150)).toBe(true);
      expect(isValidBulletWeight(168)).toBe(true);
      expect(isValidBulletWeight(180)).toBe(true);
    });

    it('should reject negative weights', () => {
      expect(isValidBulletWeight(-50)).toBe(false);
    });

    it('should reject zero weight', () => {
      expect(isValidBulletWeight(0)).toBe(false);
    });

    it('should reject excessively heavy bullets', () => {
      expect(isValidBulletWeight(1500)).toBe(false);
    });
  });
});

describe('Environmental Validation', () => {
  describe('isValidTemperature', () => {
    it('should accept valid temperatures', () => {
      expect(isValidTemperature(59)).toBe(true);
      expect(isValidTemperature(75)).toBe(true);
      expect(isValidTemperature(-10)).toBe(true);
    });

    it('should reject extremely low temperatures', () => {
      expect(isValidTemperature(-100)).toBe(false);
    });

    it('should reject extremely high temperatures', () => {
      expect(isValidTemperature(200)).toBe(false);
    });
  });

  describe('isValidHumidity', () => {
    it('should accept valid humidity', () => {
      expect(isValidHumidity(0)).toBe(true);
      expect(isValidHumidity(50)).toBe(true);
      expect(isValidHumidity(100)).toBe(true);
    });

    it('should reject negative humidity', () => {
      expect(isValidHumidity(-10)).toBe(false);
    });

    it('should reject humidity over 100', () => {
      expect(isValidHumidity(110)).toBe(false);
    });
  });

  describe('isValidPressure', () => {
    it('should accept valid pressures', () => {
      expect(isValidPressure(29.92)).toBe(true);
      expect(isValidPressure(30)).toBe(true);
      expect(isValidPressure(25)).toBe(true);
    });

    it('should reject extremely low pressure', () => {
      expect(isValidPressure(15)).toBe(false);
    });

    it('should reject extremely high pressure', () => {
      expect(isValidPressure(36)).toBe(false);
    });
  });

  describe('isValidAltitude', () => {
    it('should accept valid altitudes', () => {
      expect(isValidAltitude(0)).toBe(true);
      expect(isValidAltitude(5000)).toBe(true);
      expect(isValidAltitude(-100)).toBe(true);
    });

    it('should reject extremely low altitudes', () => {
      expect(isValidAltitude(-2000)).toBe(false);
    });

    it('should reject extremely high altitudes', () => {
      expect(isValidAltitude(35000)).toBe(false);
    });
  });

  describe('isValidWindSpeed', () => {
    it('should accept valid wind speeds', () => {
      expect(isValidWindSpeed(0)).toBe(true);
      expect(isValidWindSpeed(10)).toBe(true);
      expect(isValidWindSpeed(50)).toBe(true);
    });

    it('should reject negative wind speeds', () => {
      expect(isValidWindSpeed(-5)).toBe(false);
    });

    it('should reject extremely high wind speeds', () => {
      expect(isValidWindSpeed(150)).toBe(false);
    });
  });

  describe('isValidWindDirection', () => {
    it('should accept valid wind directions', () => {
      expect(isValidWindDirection(0)).toBe(true);
      expect(isValidWindDirection(180)).toBe(true);
      expect(isValidWindDirection(359)).toBe(true);
    });

    it('should reject negative directions', () => {
      expect(isValidWindDirection(-10)).toBe(false);
    });

    it('should reject directions >= 360', () => {
      expect(isValidWindDirection(360)).toBe(false);
      expect(isValidWindDirection(400)).toBe(false);
    });
  });

  describe('isValidLatitude', () => {
    it('should accept valid latitudes', () => {
      expect(isValidLatitude(0)).toBe(true);
      expect(isValidLatitude(45)).toBe(true);
      expect(isValidLatitude(-45)).toBe(true);
      expect(isValidLatitude(90)).toBe(true);
      expect(isValidLatitude(-90)).toBe(true);
    });

    it('should reject latitudes out of range', () => {
      expect(isValidLatitude(91)).toBe(false);
      expect(isValidLatitude(-91)).toBe(false);
    });
  });

  describe('isValidLongitude', () => {
    it('should accept valid longitudes', () => {
      expect(isValidLongitude(0)).toBe(true);
      expect(isValidLongitude(100)).toBe(true);
      expect(isValidLongitude(-100)).toBe(true);
      expect(isValidLongitude(180)).toBe(true);
      expect(isValidLongitude(-180)).toBe(true);
    });

    it('should reject longitudes out of range', () => {
      expect(isValidLongitude(181)).toBe(false);
      expect(isValidLongitude(-181)).toBe(false);
    });
  });
});

describe('Rifle Configuration Validation', () => {
  describe('isValidBarrelLength', () => {
    it('should accept valid barrel lengths', () => {
      expect(isValidBarrelLength(16)).toBe(true);
      expect(isValidBarrelLength(20)).toBe(true);
      expect(isValidBarrelLength(24)).toBe(true);
    });

    it('should reject negative lengths', () => {
      expect(isValidBarrelLength(-10)).toBe(false);
    });

    it('should reject zero length', () => {
      expect(isValidBarrelLength(0)).toBe(false);
    });

    it('should reject excessively long barrels', () => {
      expect(isValidBarrelLength(60)).toBe(false);
    });
  });

  describe('isValidZeroDistance', () => {
    it('should accept valid zero distances', () => {
      expect(isValidZeroDistance(100)).toBe(true);
      expect(isValidZeroDistance(200)).toBe(true);
      expect(isValidZeroDistance(300)).toBe(true);
    });

    it('should reject negative distances', () => {
      expect(isValidZeroDistance(-100)).toBe(false);
    });

    it('should reject zero distance', () => {
      expect(isValidZeroDistance(0)).toBe(false);
    });

    it('should reject excessively long zero distances', () => {
      expect(isValidZeroDistance(1500)).toBe(false);
    });
  });

  describe('isValidScopeHeight', () => {
    it('should accept valid scope heights', () => {
      expect(isValidScopeHeight(1.5)).toBe(true);
      expect(isValidScopeHeight(2)).toBe(true);
      expect(isValidScopeHeight(3)).toBe(true);
    });

    it('should reject negative heights', () => {
      expect(isValidScopeHeight(-1)).toBe(false);
    });

    it('should reject zero height', () => {
      expect(isValidScopeHeight(0)).toBe(false);
    });

    it('should reject excessively high scopes', () => {
      expect(isValidScopeHeight(15)).toBe(false);
    });
  });

  describe('isValidClickValue', () => {
    it('should accept valid click values', () => {
      expect(isValidClickValue(0.1)).toBe(true);
      expect(isValidClickValue(0.25)).toBe(true);
      expect(isValidClickValue(0.5)).toBe(true);
    });

    it('should reject negative click values', () => {
      expect(isValidClickValue(-0.1)).toBe(false);
    });

    it('should reject zero click value', () => {
      expect(isValidClickValue(0)).toBe(false);
    });

    it('should reject excessively large click values', () => {
      expect(isValidClickValue(2)).toBe(false);
    });
  });
});

describe('Validation Helper', () => {
  describe('validate', () => {
    it('should return valid result for valid input', () => {
      const result = validate(100, isValidDistance, 'Distance');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid result with error message', () => {
      const result = validate(-100, isValidDistance, 'Distance');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Distance is invalid');
    });

    it('should use custom error message when provided', () => {
      const result = validate(-100, isValidDistance, 'Distance', 'Must be positive');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Must be positive');
    });
  });
});
