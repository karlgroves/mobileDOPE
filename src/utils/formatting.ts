/**
 * Formatting utilities for Mobile DOPE App
 * All formatting functions return formatted strings
 */

/**
 * Format a number with specified decimal places
 */
export const formatNumber = (value: number, decimals: number = 2): string => {
  return value.toFixed(decimals);
};

/**
 * Format distance with unit label
 */
export const formatDistance = (
  value: number,
  unit: 'yards' | 'meters',
  decimals: number = 1
): string => {
  const abbrev = unit === 'yards' ? 'yd' : 'm';
  return `${value.toFixed(decimals)} ${abbrev}`;
};

/**
 * Format velocity with unit label
 */
export const formatVelocity = (
  value: number,
  unit: 'fps' | 'mps',
  decimals: number = 0
): string => {
  return `${value.toFixed(decimals)} ${unit}`;
};

/**
 * Format angular measurement with unit label
 */
export const formatAngular = (value: number, unit: 'MIL' | 'MOA', decimals: number = 2): string => {
  return `${value.toFixed(decimals)} ${unit}`;
};

/**
 * Format temperature with degree symbol
 */
export const formatTemperature = (value: number, decimals: number = 0): string => {
  return `${value.toFixed(decimals)}°F`;
};

/**
 * Format barometric pressure
 */
export const formatPressure = (value: number, decimals: number = 2): string => {
  return `${value.toFixed(decimals)} inHg`;
};

/**
 * Format humidity as percentage
 */
export const formatHumidity = (value: number, decimals: number = 0): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format wind speed and direction
 */
export const formatWind = (speed: number, direction: number, speedDecimals: number = 0): string => {
  const formattedSpeed = speed.toFixed(speedDecimals);
  const formattedDirection = Math.round(direction);
  return `${formattedSpeed} mph @ ${formattedDirection}°`;
};

/**
 * Format group size in inches
 */
export const formatGroupSize = (value: number, decimals: number = 2): string => {
  return `${value.toFixed(decimals)}"`;
};

/**
 * Format date as MM/DD/YYYY
 */
export const formatDate = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

/**
 * Format time as H:MM AM/PM
 */
export const formatTime = (date: Date): string => {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'

  return `${hours}:${minutes} ${ampm}`;
};

/**
 * Format date and time together
 */
export const formatDateTime = (date: Date): string => {
  return `${formatDate(date)} ${formatTime(date)}`;
};

/**
 * Format weight in grains
 */
export const formatWeight = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)} gr`;
};

/**
 * Format energy in foot-pounds
 */
export const formatEnergy = (value: number, decimals: number = 0): string => {
  return `${value.toFixed(decimals)} ft-lbs`;
};

/**
 * Format time of flight in seconds
 */
export const formatTimeOfFlight = (value: number, decimals: number = 2): string => {
  return `${value.toFixed(decimals)} s`;
};
