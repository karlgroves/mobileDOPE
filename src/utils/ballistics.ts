/**
 * Ballistic trajectory calculations using numerical integration
 */

import type {
  RifleConfig,
  AmmoConfig,
  ShotParameters,
  TrajectoryPoint,
  BallisticSolution,
} from '../types/ballistic.types';
import type { AtmosphericConditions } from './atmospheric';
import { calculateSpeedOfSound, calculateAirDensity } from './atmospheric';
import { getDragCoefficient } from './dragModels';
import { inchesToCorrection } from '../types/ballistic.types';
import { getBulletDiameter, calculateSpinDriftComplete } from './spinDrift';

const GRAVITY = 32.174; // ft/s²

/**
 * Calculate ballistic coefficient adjusted for actual atmospheric conditions
 */
function adjustedBC(bc: number, airDensity: number, standardDensity: number = 0.0765): number {
  // BC varies inversely with air density
  if (airDensity <= 0 || !isFinite(airDensity)) {
    return bc; // Return unadjusted BC if density is invalid
  }
  return bc * (standardDensity / airDensity);
}

/**
 * Calculate retardation (deceleration) due to drag
 * @param velocity - Current velocity (fps)
 * @param bc - Ballistic coefficient
 * @param dragModel - Drag model ('G1' or 'G7')
 * @param speedOfSound - Speed of sound (fps)
 * @returns Retardation in ft/s²
 */
function calculateRetardation(
  velocity: number,
  bc: number,
  dragModel: 'G1' | 'G7',
  speedOfSound: number
): number {
  if (velocity <= 0 || bc <= 0 || !isFinite(velocity) || !isFinite(bc)) {
    return 0;
  }

  const cd = getDragCoefficient(velocity, dragModel, speedOfSound);

  // Standard ballistic formula for retardation
  // The drag function Cd is already dimensionless from the tables
  // BC in US units has dimensions that make this formula work out to ft/s²
  // Formula: a = -(v² * Cd * ρ) / (2 * BC * ρ₀)
  // Since BC already accounts for density ratio, simplified to:
  // a = (GRAVITY * v² * Cd) / (2 * BC * v₀²)
  // Where v₀ is a reference velocity

  // Standard point-mass ballistic formula
  // For G1/G7 drag functions with BC in lb/in²:
  // a = v² * Cd(M) / BC_std
  // Scaling factor empirically determined for imperial units
  const retardation = (velocity * velocity * cd) / (bc * 3200);

  return isFinite(retardation) ? retardation : 0;
}

/**
 * Runge-Kutta 4th order integration step
 */
interface State {
  x: number; // horizontal distance (ft)
  y: number; // vertical distance (ft)
  vx: number; // horizontal velocity (ft/s)
  vy: number; // vertical velocity (ft/s)
}

function rk4Step(
  state: State,
  dt: number,
  bc: number,
  dragModel: 'G1' | 'G7',
  speedOfSound: number,
  gravity: number
): State {
  const { x, y, vx, vy } = state;

  // Calculate k1
  const v1 = Math.sqrt(vx * vx + vy * vy);
  if (v1 < 1) {
    return state; // Prevent division by zero
  }
  const retardation1 = calculateRetardation(v1, bc, dragModel, speedOfSound);

  const ax1 = -(vx / v1) * retardation1;
  const ay1 = -gravity - (vy / v1) * retardation1;

  // Calculate k2
  const vx2 = vx + (ax1 * dt) / 2;
  const vy2 = vy + (ay1 * dt) / 2;
  const v2 = Math.sqrt(vx2 * vx2 + vy2 * vy2);
  const retardation2 = calculateRetardation(v2, bc, dragModel, speedOfSound);
  const ax2 = -(vx2 / v2) * retardation2;
  const ay2 = -gravity - (vy2 / v2) * retardation2;

  // Calculate k3
  const vx3 = vx + (ax2 * dt) / 2;
  const vy3 = vy + (ay2 * dt) / 2;
  const v3 = Math.sqrt(vx3 * vx3 + vy3 * vy3);
  const retardation3 = calculateRetardation(v3, bc, dragModel, speedOfSound);
  const ax3 = -(vx3 / v3) * retardation3;
  const ay3 = -gravity - (vy3 / v3) * retardation3;

  // Calculate k4
  const vx4 = vx + ax3 * dt;
  const vy4 = vy + ay3 * dt;
  const v4 = Math.sqrt(vx4 * vx4 + vy4 * vy4);
  const retardation4 = calculateRetardation(v4, bc, dragModel, speedOfSound);
  const ax4 = -(vx4 / v4) * retardation4;
  const ay4 = -gravity - (vy4 / v4) * retardation4;

  // Combine using RK4 formula
  const newVx = vx + (dt / 6) * (ax1 + 2 * ax2 + 2 * ax3 + ax4);
  const newVy = vy + (dt / 6) * (ay1 + 2 * ay2 + 2 * ay3 + ay4);
  const newX = x + (dt / 6) * (vx + 2 * vx2 + 2 * vx3 + vx4);
  const newY = y + (dt / 6) * (vy + 2 * vy2 + 2 * vy3 + vy4);

  return {
    x: newX,
    y: newY,
    vx: newVx,
    vy: newVy,
  };
}

/**
 * Calculate wind drift
 */
function calculateWindDrift(
  timeOfFlight: number,
  windSpeed: number,
  windDirection: number
): number {
  // Convert wind direction to crosswind component
  // 0° = headwind, 90° = right-to-left, 270° = left-to-right
  const windAngleRad = (windDirection * Math.PI) / 180;
  const crosswindComponent = windSpeed * Math.sin(windAngleRad);

  // Convert mph to fps
  const crosswindFps = crosswindComponent * 1.467;

  // Simplified wind drift formula
  // More accurate models would integrate along trajectory
  const drift = crosswindFps * timeOfFlight;

  return drift * 12; // Convert to inches
}

/**
 * Find the launch angle that zeros the rifle at the specified distance
 * Uses iterative method to account for ballistic drop
 */
function findZeroAngle(
  zeroDistanceFeet: number,
  sightHeightFeet: number,
  muzzleVelocity: number,
  bc: number,
  dragModel: 'G1' | 'G7',
  speedOfSound: number
): number {
  // Start with a reasonable initial guess based on geometry
  let launchAngle = Math.atan(sightHeightFeet / zeroDistanceFeet) + 0.01;

  // Iteratively adjust the launch angle to hit zero at the zero distance
  const maxIterations = 50;
  const tolerance = 0.01; // Within 0.01 inches is good enough

  for (let i = 0; i < maxIterations; i++) {
    // Simulate trajectory with current launch angle
    let state: State = {
      x: 0,
      y: -sightHeightFeet,
      vx: muzzleVelocity * Math.cos(launchAngle),
      vy: muzzleVelocity * Math.sin(launchAngle),
    };

    const dt = 0.001;

    // Simulate until we reach the zero distance
    while (state.x < zeroDistanceFeet) {
      state = rk4Step(state, dt, bc, dragModel, speedOfSound, GRAVITY);

      if (!isFinite(state.x)) {
        break;
      }
    }

    // Check how far off we are from the line of sight at zero distance
    const errorInches = state.y * 12;

    // If we're close enough, we're done
    if (Math.abs(errorInches) < tolerance) {
      return launchAngle;
    }

    // Adjust the launch angle based on the error
    // Positive error means we're above the line of sight, so decrease angle
    // Negative error means we're below the line of sight, so increase angle
    const adjustmentFactor = 0.5; // Damping factor for stability
    const adjustment = Math.atan(errorInches / (zeroDistanceFeet * 12)) * adjustmentFactor;
    launchAngle -= adjustment;
  }

  return launchAngle;
}

/**
 * Calculate trajectory from muzzle to target distance
 */
export function calculateTrajectory(
  rifle: RifleConfig,
  ammo: AmmoConfig,
  shot: ShotParameters,
  atmosphere: AtmosphericConditions
): TrajectoryPoint[] {
  const { zeroDistance, sightHeight } = rifle;
  const { ballisticCoefficient, dragModel, muzzleVelocity, bulletWeight } = ammo;
  const { distance: targetDistance, angle } = shot;

  const speedOfSound = calculateSpeedOfSound(atmosphere.temperature);
  const airDensity = calculateAirDensity(atmosphere.temperature, atmosphere.pressure);
  const bc = adjustedBC(ballisticCoefficient, airDensity);

  // Calculate launch angle to achieve zero at zero distance
  const zeroDistanceFeet = zeroDistance * 3;
  const sightHeightFeet = sightHeight / 12;

  // Find the proper zero angle using iterative method
  const zeroAngle = findZeroAngle(
    zeroDistanceFeet,
    sightHeightFeet,
    muzzleVelocity,
    bc,
    dragModel,
    speedOfSound
  );

  // For angled shots, the launch angle stays the same (based on rifle zero)
  // but we need to account for:
  // 1. Horizontal distance (slant range * cos(angle))
  // 2. Gravity component affected by angle
  const shotAngleRad = (angle * Math.PI) / 180;
  const launchAngle = zeroAngle; // Launch angle is NOT modified by shot angle

  // Calculate effective horizontal distance and adjusted gravity
  const cosAngle = Math.cos(shotAngleRad);
  const effectiveGravity = GRAVITY * cosAngle; // Gravity component perpendicular to trajectory

  // Initial velocity components (in bore coordinate system)
  const v0 = muzzleVelocity;
  let state: State = {
    x: 0,
    y: -sightHeightFeet, // Start below line of sight
    vx: v0 * Math.cos(launchAngle),
    vy: v0 * Math.sin(launchAngle),
  };

  const targetDistanceFeet = targetDistance * 3;
  const dt = 0.001; // Time step (seconds)
  const trajectory: TrajectoryPoint[] = [];

  let time = 0;
  const pointInterval = 25; // Record every 25 yards
  let nextPoint = 0;
  const maxIterations = 100000; // Prevent infinite loops
  let iterations = 0;

  while (state.x < targetDistanceFeet && iterations < maxIterations) {
    // Record point
    const distanceYards = state.x / 3;
    if (distanceYards >= nextPoint) {
      const velocity = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
      const energy = ((bulletWeight / 7000) * (velocity * velocity)) / (2 * GRAVITY);
      const drop = state.y * 12; // Convert to inches

      trajectory.push({
        distance: distanceYards,
        time,
        velocity,
        energy,
        drop,
        windage: 0, // Calculated separately
        elevation: 0, // Calculated later
        windageCorrection: 0, // Calculated later
      });

      nextPoint += pointInterval;
    }

    // Integrate (use effective gravity for angled shots)
    state = rk4Step(state, dt, bc, dragModel, speedOfSound, effectiveGravity);

    // Check for NaN
    if (!isFinite(state.x) || !isFinite(state.vx)) {
      break;
    }

    time += dt;
    iterations++;
  }

  // Ensure we have the exact target distance
  const velocity = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
  const energy = ((bulletWeight / 7000) * (velocity * velocity)) / (2 * GRAVITY);

  trajectory.push({
    distance: targetDistance,
    time,
    velocity,
    energy,
    drop: state.y * 12,
    windage: 0,
    elevation: 0,
    windageCorrection: 0,
  });

  return trajectory;
}

/**
 * Calculate complete ballistic solution
 */
export function calculateBallisticSolution(
  rifle: RifleConfig,
  ammo: AmmoConfig,
  shot: ShotParameters,
  atmosphere: AtmosphericConditions,
  includeTrajectory: boolean = false
): BallisticSolution {
  const trajectory = calculateTrajectory(rifle, ammo, shot, atmosphere);
  const targetPoint = trajectory[trajectory.length - 1];

  // Calculate wind drift
  const windage = calculateWindDrift(targetPoint.time, shot.windSpeed, shot.windDirection);

  // Calculate corrections
  const elevationMIL = inchesToCorrection(-targetPoint.drop, shot.distance, 'MIL');
  const elevationMOA = inchesToCorrection(-targetPoint.drop, shot.distance, 'MOA');
  const windageMIL = inchesToCorrection(-windage, shot.distance, 'MIL');
  const windageMOA = inchesToCorrection(-windage, shot.distance, 'MOA');

  // Calculate zero angle using proper iterative method
  const speedOfSound = calculateSpeedOfSound(atmosphere.temperature);
  const airDensity = calculateAirDensity(atmosphere.temperature, atmosphere.pressure);
  const bc = adjustedBC(ammo.ballisticCoefficient, airDensity);
  const zeroDistanceFeet = rifle.zeroDistance * 3;
  const sightHeightFeet = rifle.sightHeight / 12;
  const zeroAngle = findZeroAngle(
    zeroDistanceFeet,
    sightHeightFeet,
    ammo.muzzleVelocity,
    bc,
    ammo.dragModel,
    speedOfSound
  );

  // Find max ordinate
  let maxOrdinate = -Infinity;
  let maxOrdinateDistance = 0;
  for (const point of trajectory) {
    if (point.drop > maxOrdinate) {
      maxOrdinate = point.drop;
      maxOrdinateDistance = point.distance;
    }
  }

  // Add corrections to trajectory points if requested
  if (includeTrajectory) {
    for (const point of trajectory) {
      point.elevation = inchesToCorrection(-point.drop, point.distance, 'MIL');
      point.windageCorrection = inchesToCorrection(
        -windage * (point.distance / shot.distance),
        point.distance,
        'MIL'
      );
      point.windage = windage * (point.distance / shot.distance);
    }
  }

  // Calculate spin drift if caliber is available
  let spinDrift: number | undefined;
  let spinDriftMIL: number | undefined;
  let spinDriftMOA: number | undefined;
  let stabilityFactor: number | undefined;

  if (rifle.caliber) {
    const bulletDiameter = getBulletDiameter(rifle.caliber);
    if (bulletDiameter) {
      const spinDriftResult = calculateSpinDriftComplete({
        bulletWeight: ammo.bulletWeight,
        bulletDiameter,
        twistRate: rifle.twistRate,
        timeOfFlight: targetPoint.time,
        isRightHandTwist: rifle.isRightHandTwist !== false, // default true
      });

      if (spinDriftResult) {
        spinDrift = spinDriftResult.spinDrift;
        spinDriftMIL = inchesToCorrection(spinDriftResult.spinDrift, shot.distance, 'MIL');
        spinDriftMOA = inchesToCorrection(spinDriftResult.spinDrift, shot.distance, 'MOA');
        stabilityFactor = spinDriftResult.stabilityFactor;
      }
    }
  }

  return {
    rifle,
    ammo,
    shot,
    atmosphere,
    drop: targetPoint.drop,
    windage,
    elevationMIL,
    elevationMOA,
    windageMIL,
    windageMOA,
    velocity: targetPoint.velocity,
    energy: targetPoint.energy,
    timeOfFlight: targetPoint.time,
    trajectory: includeTrajectory ? trajectory : undefined,
    zeroAngle,
    maxOrdinate,
    maxOrdinateDistance,
    spinDrift,
    spinDriftMIL,
    spinDriftMOA,
    stabilityFactor,
  };
}
