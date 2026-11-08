/**
 * Wind table generation for ballistic calculations
 */

import { inchesToCorrection } from '../types/ballistic.types';

import { calculateBallisticSolution } from './ballistics';

import type { AtmosphericConditions } from './atmospheric';
import type { RifleConfig, AmmoConfig } from '../types/ballistic.types';

/**
 * Wind table entry representing drift at a specific wind speed and direction
 */
export interface WindTableEntry {
  distance: number; // yards
  windSpeed: number; // mph
  windDirection: number; // degrees (0 = headwind, 90 = right-to-left, 180 = tailwind, 270 = left-to-right)
  windDrift: number; // inches (positive = left, negative = right)
  windageCorrection: number; // MIL
}

/**
 * Options for wind table generation
 */
export interface WindTableOptions {
  windSpeeds?: number[]; // mph values to generate table for
  windDirection: number; // degrees
}

/**
 * Generate wind table for a rifle/ammo combination at a specific distance
 *
 * @param rifle - Rifle configuration
 * @param ammo - Ammunition configuration
 * @param distance - Target distance in yards
 * @param atmosphere - Atmospheric conditions
 * @param options - Wind table generation options
 * @returns Array of wind table entries
 */
export function generateWindTable(
  rifle: RifleConfig,
  ammo: AmmoConfig,
  distance: number,
  atmosphere: AtmosphericConditions,
  options: WindTableOptions
): WindTableEntry[] {
  // Default wind speeds: 0, 5, 10, 15, 20 mph
  const windSpeeds = options.windSpeeds || [0, 5, 10, 15, 20];
  const windDirection = options.windDirection;

  // Wind does not change the trajectory here: drift is worked out afterwards
  // from the time of flight, and it is linear in wind speed. So one solve per
  // distance, at 1 mph, gives every column by scaling. Solving once per cell
  // made the screen's 10 x 5 table fifty full solves, which took about 15 s in
  // a debug build on the Simulator (#232).
  const solution = calculateBallisticSolution(
    rifle,
    ammo,
    {
      distance,
      angle: 0,
      windSpeed: 1,
      windDirection,
    },
    atmosphere,
    false // Don't need trajectory data
  );
  const driftPerMph = solution.windage;

  return windSpeeds.map((windSpeed) => {
    const windDrift = driftPerMph * windSpeed;
    return {
      distance,
      windSpeed,
      windDirection,
      windDrift,
      windageCorrection: inchesToCorrection(-windDrift, distance, 'MIL'),
    };
  });
}

/**
 * Calculate crosswind component from wind speed and direction
 *
 * @param windSpeed - Wind speed in mph
 * @param windDirection - Wind direction in degrees (0 = headwind, 90 = right-to-left)
 * @returns Crosswind component in mph
 */
export function calculateCrosswindComponent(windSpeed: number, windDirection: number): number {
  // Convert wind direction to radians
  const windAngleRad = (windDirection * Math.PI) / 180;

  // Crosswind component is the sine of the wind angle
  const crosswindComponent = windSpeed * Math.sin(windAngleRad);

  return crosswindComponent;
}

/**
 * Calculate headwind/tailwind component from wind speed and direction
 *
 * @param windSpeed - Wind speed in mph
 * @param windDirection - Wind direction in degrees (0 = headwind, 180 = tailwind)
 * @returns Headwind component in mph (positive = headwind, negative = tailwind)
 */
export function calculateHeadwindComponent(windSpeed: number, windDirection: number): number {
  // Convert wind direction to radians
  const windAngleRad = (windDirection * Math.PI) / 180;

  // Headwind component is the cosine of the wind angle
  const headwindComponent = windSpeed * Math.cos(windAngleRad);

  return headwindComponent;
}

/**
 * Generate comprehensive wind table with multiple distances and wind speeds
 *
 * @param rifle - Rifle configuration
 * @param ammo - Ammunition configuration
 * @param distances - Array of distances in yards
 * @param atmosphere - Atmospheric conditions
 * @param windSpeeds - Array of wind speeds in mph
 * @param windDirection - Wind direction in degrees
 * @returns Array of wind table entries
 */
export function generateComprehensiveWindTable(
  rifle: RifleConfig,
  ammo: AmmoConfig,
  distances: number[],
  atmosphere: AtmosphericConditions,
  windSpeeds: number[],
  windDirection: number
): WindTableEntry[] {
  const table: WindTableEntry[] = [];

  for (const distance of distances) {
    const distanceTable = generateWindTable(rifle, ammo, distance, atmosphere, {
      windSpeeds,
      windDirection,
    });
    table.push(...distanceTable);
  }

  return table;
}
