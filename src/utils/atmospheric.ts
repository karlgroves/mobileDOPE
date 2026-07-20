/**
 * Atmospheric calculations for ballistic modeling
 * Based on ICAO Standard Atmosphere and US Standard Atmosphere 1976
 */

/**
 * Calculate pressure altitude
 * @param pressure - Barometric pressure in inches of mercury (inHg)
 * @param altitude - Station altitude in feet
 * @returns Pressure altitude in feet
 */
export const calculatePressureAltitude = (pressure: number, altitude: number): number => {
  const standardPressure = 29.92; // inHg at sea level
  // 1 inHg change = approximately 1000 feet
  const pressureDifference = standardPressure - pressure;
  const pressureAltitude = altitude + pressureDifference * 1000;
  return pressureAltitude;
};

/**
 * Calculate density altitude
 * @param temperature - Temperature in Fahrenheit
 * @param pressure - Barometric pressure in inches of mercury (inHg)
 * @param altitude - Station altitude in feet
 * @returns Density altitude in feet
 */
export const calculateDensityAltitude = (
  temperature: number,
  pressure: number,
  altitude: number
): number => {
  // Calculate pressure altitude
  const pressureAltitude = calculatePressureAltitude(pressure, altitude);

  // Standard temperature at pressure altitude (lapse rate: 3.56°F per 1000ft)
  const standardTemp = 59 - 0.00356 * pressureAltitude;

  // Temperature difference from standard
  const tempDifference = temperature - standardTemp;

  // Density altitude calculation (120 ft per °F deviation)
  const densityAltitude = pressureAltitude + 120 * tempDifference;

  return Math.round(densityAltitude);
};

/**
 * Calculate speed of sound in air
 * @param temperature - Temperature in Fahrenheit
 * @returns Speed of sound in feet per second
 */
export const calculateSpeedOfSound = (temperature: number): number => {
  // Convert to Rankine (°F + 459.67)
  const tempRankine = temperature + 459.67;

  // Speed of sound = sqrt(gamma * R * T)
  // For air: gamma = 1.4, R = 1716 ft·lbf/(slug·°R)
  // Simplified formula: c = 49.02 * sqrt(T)
  const speedOfSound = 49.02 * Math.sqrt(tempRankine);

  return speedOfSound;
};

/**
 * Calculate air density
 * @param temperature - Temperature in Fahrenheit
 * @param pressure - Barometric pressure in inches of mercury (inHg)
 * @returns Air density in pounds per cubic foot (lb/ft³)
 */
export const calculateAirDensity = (temperature: number, pressure: number): number => {
  // Convert temperature to Rankine
  const tempRankine = temperature + 459.67;

  // Convert pressure to psi (1 inHg = 0.491154 psi)
  const pressurePsi = pressure * 0.491154;

  // Ideal gas law: ρ = P / (R * T)
  // For air: R = 53.352 ft·lbf/(lb·°R) = gas constant for air
  const gasCon = 53.352;

  // Calculate density (in lb/ft³)
  const density = (pressurePsi * 144) / (gasCon * tempRankine);

  return density;
};

/**
 * Standard atmosphere conditions at sea level
 */
export const standardAtmosphere = {
  temperature: 59, // °F
  pressure: 29.92, // inHg
  altitude: 0, // ft
  density: calculateAirDensity(59, 29.92), // lb/ft³
  speedOfSound: calculateSpeedOfSound(59), // ft/s
} as const;

/**
 * Atmospheric conditions interface
 */
export interface AtmosphericConditions {
  temperature: number; // °F
  pressure: number; // inHg
  altitude: number; // ft
  humidity?: number; // percentage (0-100)
  densityAltitude?: number; // ft
  pressureAltitude?: number; // ft
  airDensity?: number; // lb/ft³
  speedOfSound?: number; // ft/s
}

/**
 * Calculate all atmospheric parameters
 * @param conditions - Input atmospheric conditions
 * @returns Complete atmospheric conditions with calculated values
 */
export const calculateAtmosphericConditions = (
  conditions: AtmosphericConditions
): Required<AtmosphericConditions> => {
  const { temperature, pressure, altitude, humidity = 50 } = conditions;

  const pressureAltitude = calculatePressureAltitude(pressure, altitude);
  const densityAltitude = calculateDensityAltitude(temperature, pressure, altitude);
  const airDensity = calculateAirDensity(temperature, pressure);
  const speedOfSound = calculateSpeedOfSound(temperature);

  return {
    temperature,
    pressure,
    altitude,
    humidity,
    pressureAltitude,
    densityAltitude,
    airDensity,
    speedOfSound,
  };
};
