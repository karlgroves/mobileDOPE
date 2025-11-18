/**
 * Validation utilities for Mobile DOPE App
 * All validation functions return boolean indicating if value is valid
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate distance (yards or meters)
 * Valid range: 1 - 3000
 */
export const isValidDistance = (distance: number): boolean => {
  return distance > 0 && distance <= 3000;
};

/**
 * Validate velocity (fps or mps)
 * Valid range: 1 - 5000 fps
 */
export const isValidVelocity = (velocity: number): boolean => {
  return velocity > 0 && velocity <= 5000;
};

/**
 * Validate ballistic coefficient
 * Valid range: > 0 and <= 1
 */
export const isValidBallisticCoefficient = (bc: number): boolean => {
  return bc > 0 && bc <= 1;
};

/**
 * Validate bullet weight (grains)
 * Valid range: 1 - 1000 grains
 */
export const isValidBulletWeight = (weight: number): boolean => {
  return weight > 0 && weight <= 1000;
};

/**
 * Validate temperature (Fahrenheit)
 * Valid range: -50°F to 150°F
 */
export const isValidTemperature = (temp: number): boolean => {
  return temp >= -50 && temp <= 150;
};

/**
 * Validate humidity (percentage)
 * Valid range: 0% to 100%
 */
export const isValidHumidity = (humidity: number): boolean => {
  return humidity >= 0 && humidity <= 100;
};

/**
 * Validate barometric pressure (inHg)
 * Valid range: 20 - 35 inHg
 */
export const isValidPressure = (pressure: number): boolean => {
  return pressure >= 20 && pressure <= 35;
};

/**
 * Validate altitude (feet)
 * Valid range: -1000 to 30000 feet
 */
export const isValidAltitude = (altitude: number): boolean => {
  return altitude >= -1000 && altitude <= 30000;
};

/**
 * Validate wind speed (mph)
 * Valid range: 0 - 100 mph
 */
export const isValidWindSpeed = (windSpeed: number): boolean => {
  return windSpeed >= 0 && windSpeed <= 100;
};

/**
 * Validate wind direction (degrees)
 * Valid range: 0 - 359 degrees
 */
export const isValidWindDirection = (direction: number): boolean => {
  return direction >= 0 && direction < 360;
};

/**
 * Validate latitude
 * Valid range: -90 to 90 degrees
 */
export const isValidLatitude = (latitude: number): boolean => {
  return latitude >= -90 && latitude <= 90;
};

/**
 * Validate longitude
 * Valid range: -180 to 180 degrees
 */
export const isValidLongitude = (longitude: number): boolean => {
  return longitude >= -180 && longitude <= 180;
};

/**
 * Validate barrel length (inches)
 * Valid range: > 0 and <= 50 inches
 */
export const isValidBarrelLength = (length: number): boolean => {
  return length > 0 && length <= 50;
};

/**
 * Validate zero distance (yards)
 * Valid range: 1 - 1000 yards
 */
export const isValidZeroDistance = (distance: number): boolean => {
  return distance > 0 && distance <= 1000;
};

/**
 * Validate scope height over bore (inches)
 * Valid range: > 0 and <= 10 inches
 */
export const isValidScopeHeight = (height: number): boolean => {
  return height > 0 && height <= 10;
};

/**
 * Validate click value (MIL or MOA per click)
 * Valid range: > 0 and <= 1
 */
export const isValidClickValue = (clickValue: number): boolean => {
  return clickValue > 0 && clickValue <= 1;
};

/**
 * Generic validation helper
 * Returns ValidationResult with error message if invalid
 */
export const validate = (
  value: number,
  validator: (value: number) => boolean,
  fieldName: string,
  customError?: string
): ValidationResult => {
  const isValid = validator(value);
  return {
    isValid,
    error: isValid ? undefined : customError || `${fieldName} is invalid`,
  };
};

/**
 * Validate multiple fields and return all errors
 */
export const validateAll = (
  validations: Array<{ value: number; validator: (v: number) => boolean; fieldName: string }>
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  for (const { value, validator, fieldName } of validations) {
    const result = validate(value, validator, fieldName);
    if (!result.isValid && result.error) {
      errors.push(result.error);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
