/**
 * Unit conversion utilities for Mobile DOPE App
 * All conversion functions are pure and stateless
 */

// Distance conversions
const YARDS_TO_METERS = 0.9144;
const FEET_TO_METERS = 0.3048;
const INCHES_TO_CM = 2.54;

// Velocity conversions
const FPS_TO_MPS = 0.3048;

// Angular conversions
const MIL_TO_MOA = 3.4377467707849396; // 1 mil = ~3.438 MOA

// Temperature conversions
const FAHRENHEIT_OFFSET = 32;
const FAHRENHEIT_RATIO = 5 / 9;

// Pressure conversions
const INHG_TO_MBAR = 33.8639;

// Weight conversions
const GRAINS_TO_GRAMS = 0.06479891;

/**
 * Convert yards to meters
 */
export const yardsToMeters = (yards: number): number => {
  return yards * YARDS_TO_METERS;
};

/**
 * Convert meters to yards
 */
export const metersToYards = (meters: number): number => {
  return meters / YARDS_TO_METERS;
};

/**
 * Convert feet to meters
 */
export const feetToMeters = (feet: number): number => {
  return feet * FEET_TO_METERS;
};

/**
 * Convert meters to feet
 */
export const metersToFeet = (meters: number): number => {
  return meters / FEET_TO_METERS;
};

/**
 * Convert feet per second to meters per second
 */
export const fpsToMps = (fps: number): number => {
  return fps * FPS_TO_MPS;
};

/**
 * Convert meters per second to feet per second
 */
export const mpsToFps = (mps: number): number => {
  return mps / FPS_TO_MPS;
};

/**
 * Convert inches to centimeters
 */
export const inchesToCm = (inches: number): number => {
  return inches * INCHES_TO_CM;
};

/**
 * Convert centimeters to inches
 */
export const cmToInches = (cm: number): number => {
  return cm / INCHES_TO_CM;
};

/**
 * Convert milliradians to minutes of angle
 */
export const milToMoa = (mil: number): number => {
  return mil * MIL_TO_MOA;
};

/**
 * Convert minutes of angle to milliradians
 */
export const moaToMil = (moa: number): number => {
  return moa / MIL_TO_MOA;
};

/**
 * Convert Fahrenheit to Celsius
 */
export const fahrenheitToCelsius = (fahrenheit: number): number => {
  return (fahrenheit - FAHRENHEIT_OFFSET) * FAHRENHEIT_RATIO;
};

/**
 * Convert Celsius to Fahrenheit
 */
export const celsiusToFahrenheit = (celsius: number): number => {
  return celsius / FAHRENHEIT_RATIO + FAHRENHEIT_OFFSET;
};

/**
 * Convert inches of mercury to millibars
 */
export const inHgToMbar = (inHg: number): number => {
  return inHg * INHG_TO_MBAR;
};

/**
 * Convert millibars to inches of mercury
 */
export const mbarToInHg = (mbar: number): number => {
  return mbar / INHG_TO_MBAR;
};

/**
 * Convert grains to grams
 */
export const grainsToGrams = (grains: number): number => {
  return grains * GRAINS_TO_GRAMS;
};

/**
 * Convert grams to grains
 */
export const gramsToGrains = (grams: number): number => {
  return grams / GRAINS_TO_GRAMS;
};

/**
 * Convert distance based on unit preference
 */
export const convertDistance = (
  value: number,
  from: 'yards' | 'meters',
  to: 'yards' | 'meters'
): number => {
  if (from === to) return value;
  return from === 'yards' ? yardsToMeters(value) : metersToYards(value);
};

/**
 * Convert angular measurement based on unit preference
 */
export const convertAngular = (
  value: number,
  from: 'MIL' | 'MOA',
  to: 'MIL' | 'MOA'
): number => {
  if (from === to) return value;
  return from === 'MIL' ? milToMoa(value) : moaToMil(value);
};

/**
 * Format distance with unit label
 */
export const formatDistance = (
  value: number,
  unit: 'yards' | 'meters',
  decimals: number = 1
): string => {
  return `${value.toFixed(decimals)} ${unit === 'yards' ? 'yd' : 'm'}`;
};

/**
 * Format angular measurement with unit label
 */
export const formatAngular = (
  value: number,
  unit: 'MIL' | 'MOA',
  decimals: number = 2
): string => {
  return `${value.toFixed(decimals)} ${unit}`;
};

/**
 * Format velocity with unit label
 */
export const formatVelocity = (value: number, unit: 'fps' | 'mps', decimals: number = 0): string => {
  return `${value.toFixed(decimals)} ${unit}`;
};
