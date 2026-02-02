/**
 * Ballistic calculation types and interfaces
 */

import type { DragModel } from '../utils/dragModels';
import type { AtmosphericConditions } from '../utils/atmospheric';

/**
 * Rifle configuration for ballistic calculations
 */
export interface RifleConfig {
  zeroDistance: number; // yards
  sightHeight: number; // inches, height of scope over bore
  twistRate: string; // e.g., "1:10" for 1 turn in 10 inches
  barrelLength: number; // inches
  caliber?: string; // caliber string for spin drift calculation (e.g., ".308 Win")
  isRightHandTwist?: boolean; // default: true
}

/**
 * Ammunition configuration for ballistic calculations
 */
export interface AmmoConfig {
  bulletWeight: number; // grains
  ballisticCoefficient: number; // BC (dimensionless, typically 0.2-0.8)
  dragModel: DragModel; // 'G1' or 'G7'
  muzzleVelocity: number; // feet per second
}

/**
 * Shot parameters
 */
export interface ShotParameters {
  distance: number; // yards
  angle: number; // degrees, positive = uphill, negative = downhill
  windSpeed: number; // mph
  windDirection: number; // degrees, 0 = headwind, 90 = right-to-left, 270 = left-to-right
  latitude?: number; // degrees, for Coriolis calculation (-90 to 90, positive = North)
  azimuth?: number; // degrees, direction of fire (0 = North, 90 = East, etc.) for Eötvös effect
}

/**
 * Point on trajectory
 */
export interface TrajectoryPoint {
  distance: number; // yards
  time: number; // seconds
  velocity: number; // fps
  energy: number; // ft-lbs
  drop: number; // inches
  windage: number; // inches
  elevation: number; // correction in MIL or MOA
  windageCorrection: number; // correction in MIL or MOA
}

/**
 * Complete ballistic solution
 */
export interface BallisticSolution {
  // Input parameters
  rifle: RifleConfig;
  ammo: AmmoConfig;
  shot: ShotParameters;
  atmosphere: AtmosphericConditions;

  // Solution at target distance
  drop: number; // inches
  windage: number; // inches
  elevationMIL: number; // MIL correction
  elevationMOA: number; // MOA correction
  windageMIL: number; // MIL correction
  windageMOA: number; // MOA correction
  velocity: number; // fps at target
  energy: number; // ft-lbs at target
  timeOfFlight: number; // seconds

  // Full trajectory (optional, for charts)
  trajectory?: TrajectoryPoint[];

  // Additional data
  zeroAngle: number; // line of sight angle at zero distance (radians)
  maxOrdinate: number; // maximum height above line of sight (inches)
  maxOrdinateDistance: number; // distance where max ordinate occurs (yards)

  // Advanced corrections (optional)
  spinDrift?: number; // inches (positive = right for right-hand twist)
  spinDriftMIL?: number; // MIL correction for spin drift
  spinDriftMOA?: number; // MOA correction for spin drift
  stabilityFactor?: number; // gyroscopic stability factor (SG)

  // Coriolis effect (optional, requires latitude)
  coriolisHorizontal?: number; // inches (positive = right in Northern Hemisphere)
  coriolisVertical?: number; // inches (positive = additional drop when firing East)
  coriolisHorizontalMIL?: number; // MIL correction for horizontal Coriolis
  coriolisHorizontalMOA?: number; // MOA correction for horizontal Coriolis
  coriolisVerticalMIL?: number; // MIL correction for vertical Coriolis (Eötvös)
  coriolisVerticalMOA?: number; // MOA correction for vertical Coriolis (Eötvös)
}

/**
 * Correction units
 */
export type CorrectionUnit = 'MIL' | 'MOA';

/**
 * Convert drop/windage in inches to angular correction
 * @param inches - Drop or windage in inches
 * @param distance - Distance in yards
 * @param unit - 'MIL' or 'MOA'
 * @returns Correction in specified unit
 */
export function inchesToCorrection(inches: number, distance: number, unit: CorrectionUnit): number {
  // Convert yards to inches
  const distanceInches = distance * 36;

  // Calculate angle in radians
  const angleRadians = Math.atan(inches / distanceInches);

  if (unit === 'MIL') {
    // 1 MIL = 1/1000 radian
    return angleRadians * 1000;
  } else {
    // 1 MOA = 1/60 degree = 1/3438 radian
    const angleDegrees = (angleRadians * 180) / Math.PI;
    return angleDegrees * 60;
  }
}

/**
 * Convert angular correction to inches at distance
 * @param correction - Correction value
 * @param distance - Distance in yards
 * @param unit - 'MIL' or 'MOA'
 * @returns Drop/windage in inches
 */
export function correctionToInches(
  correction: number,
  distance: number,
  unit: CorrectionUnit
): number {
  const distanceInches = distance * 36;

  let angleRadians: number;
  if (unit === 'MIL') {
    angleRadians = correction / 1000;
  } else {
    // Convert MOA to radians
    const angleDegrees = correction / 60;
    angleRadians = (angleDegrees * Math.PI) / 180;
  }

  return Math.tan(angleRadians) * distanceInches;
}
