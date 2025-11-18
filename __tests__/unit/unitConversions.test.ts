/**
 * Unit tests for unit conversion utilities
 * Following TDD - write tests first, then implementation
 */

import {
  yardsToMeters,
  metersToYards,
  fpsToMps,
  mpsToFps,
  inchesToCm,
  cmToInches,
  milToMoa,
  moaToMil,
  fahrenheitToCelsius,
  celsiusToFahrenheit,
  inHgToMbar,
  mbarToInHg,
  feetToMeters,
  metersToFeet,
  grainsToGrams,
  gramsToGrains,
} from '../../src/utils/unitConversions';

describe('Distance Conversions', () => {
  describe('yardsToMeters', () => {
    it('should convert yards to meters correctly', () => {
      expect(yardsToMeters(100)).toBeCloseTo(91.44, 2);
      expect(yardsToMeters(500)).toBeCloseTo(457.2, 2);
      expect(yardsToMeters(1000)).toBeCloseTo(914.4, 2);
    });

    it('should handle zero', () => {
      expect(yardsToMeters(0)).toBe(0);
    });

    it('should handle decimal values', () => {
      expect(yardsToMeters(100.5)).toBeCloseTo(91.896, 2);
    });
  });

  describe('metersToYards', () => {
    it('should convert meters to yards correctly', () => {
      expect(metersToYards(91.44)).toBeCloseTo(100, 2);
      expect(metersToYards(457.2)).toBeCloseTo(500, 2);
      expect(metersToYards(914.4)).toBeCloseTo(1000, 2);
    });

    it('should handle zero', () => {
      expect(metersToYards(0)).toBe(0);
    });

    it('should be inverse of yardsToMeters', () => {
      const yards = 250;
      expect(metersToYards(yardsToMeters(yards))).toBeCloseTo(yards, 2);
    });
  });

  describe('feetToMeters', () => {
    it('should convert feet to meters correctly', () => {
      expect(feetToMeters(100)).toBeCloseTo(30.48, 2);
      expect(feetToMeters(1000)).toBeCloseTo(304.8, 2);
    });
  });

  describe('metersToFeet', () => {
    it('should convert meters to feet correctly', () => {
      expect(metersToFeet(30.48)).toBeCloseTo(100, 2);
      expect(metersToFeet(304.8)).toBeCloseTo(1000, 2);
    });
  });
});

describe('Velocity Conversions', () => {
  describe('fpsToMps', () => {
    it('should convert feet per second to meters per second', () => {
      expect(fpsToMps(2800)).toBeCloseTo(853.44, 2);
      expect(fpsToMps(3000)).toBeCloseTo(914.4, 2);
    });

    it('should handle zero', () => {
      expect(fpsToMps(0)).toBe(0);
    });
  });

  describe('mpsToFps', () => {
    it('should convert meters per second to feet per second', () => {
      expect(mpsToFps(853.44)).toBeCloseTo(2800, 2);
      expect(mpsToFps(914.4)).toBeCloseTo(3000, 2);
    });

    it('should be inverse of fpsToMps', () => {
      const fps = 2700;
      expect(mpsToFps(fpsToMps(fps))).toBeCloseTo(fps, 2);
    });
  });
});

describe('Length Conversions', () => {
  describe('inchesToCm', () => {
    it('should convert inches to centimeters', () => {
      expect(inchesToCm(10)).toBeCloseTo(25.4, 2);
      expect(inchesToCm(1)).toBeCloseTo(2.54, 2);
    });
  });

  describe('cmToInches', () => {
    it('should convert centimeters to inches', () => {
      expect(cmToInches(25.4)).toBeCloseTo(10, 2);
      expect(cmToInches(2.54)).toBeCloseTo(1, 2);
    });
  });
});

describe('Angular Conversions', () => {
  describe('milToMoa', () => {
    it('should convert milliradians to minutes of angle', () => {
      expect(milToMoa(1)).toBeCloseTo(3.44, 2);
      expect(milToMoa(2)).toBeCloseTo(6.88, 2);
      expect(milToMoa(10)).toBeCloseTo(34.38, 2);
    });

    it('should handle zero', () => {
      expect(milToMoa(0)).toBe(0);
    });

    it('should handle negative values', () => {
      expect(milToMoa(-2)).toBeCloseTo(-6.88, 2);
    });
  });

  describe('moaToMil', () => {
    it('should convert minutes of angle to milliradians', () => {
      expect(moaToMil(3.44)).toBeCloseTo(1, 2);
      expect(moaToMil(6.88)).toBeCloseTo(2, 2);
      expect(moaToMil(34.38)).toBeCloseTo(10, 2);
    });

    it('should be inverse of milToMoa', () => {
      const mil = 5.5;
      expect(moaToMil(milToMoa(mil))).toBeCloseTo(mil, 2);
    });
  });
});

describe('Temperature Conversions', () => {
  describe('fahrenheitToCelsius', () => {
    it('should convert Fahrenheit to Celsius', () => {
      expect(fahrenheitToCelsius(32)).toBeCloseTo(0, 2);
      expect(fahrenheitToCelsius(59)).toBeCloseTo(15, 2);
      expect(fahrenheitToCelsius(212)).toBeCloseTo(100, 2);
    });

    it('should handle negative temperatures', () => {
      expect(fahrenheitToCelsius(-40)).toBeCloseTo(-40, 2);
    });
  });

  describe('celsiusToFahrenheit', () => {
    it('should convert Celsius to Fahrenheit', () => {
      expect(celsiusToFahrenheit(0)).toBeCloseTo(32, 2);
      expect(celsiusToFahrenheit(15)).toBeCloseTo(59, 2);
      expect(celsiusToFahrenheit(100)).toBeCloseTo(212, 2);
    });

    it('should be inverse of fahrenheitToCelsius', () => {
      const fahrenheit = 75;
      expect(celsiusToFahrenheit(fahrenheitToCelsius(fahrenheit))).toBeCloseTo(fahrenheit, 2);
    });
  });
});

describe('Pressure Conversions', () => {
  describe('inHgToMbar', () => {
    it('should convert inches of mercury to millibars', () => {
      expect(inHgToMbar(29.92)).toBeCloseTo(1013.25, 1);
      expect(inHgToMbar(30)).toBeCloseTo(1015.9, 1);
    });
  });

  describe('mbarToInHg', () => {
    it('should convert millibars to inches of mercury', () => {
      expect(mbarToInHg(1013.25)).toBeCloseTo(29.92, 2);
      expect(mbarToInHg(1015.9)).toBeCloseTo(30, 2);
    });

    it('should be inverse of inHgToMbar', () => {
      const inHg = 29.5;
      expect(mbarToInHg(inHgToMbar(inHg))).toBeCloseTo(inHg, 2);
    });
  });
});

describe('Weight Conversions', () => {
  describe('grainsToGrams', () => {
    it('should convert grains to grams', () => {
      expect(grainsToGrams(150)).toBeCloseTo(9.72, 2);
      expect(grainsToGrams(180)).toBeCloseTo(11.66, 2);
    });
  });

  describe('gramsToGrains', () => {
    it('should convert grams to grains', () => {
      expect(gramsToGrains(9.72)).toBeCloseTo(150, 0);
      expect(gramsToGrains(11.66)).toBeCloseTo(180, 0);
    });

    it('should be inverse of grainsToGrams', () => {
      const grains = 168;
      expect(gramsToGrains(grainsToGrams(grains))).toBeCloseTo(grains, 2);
    });
  });
});
