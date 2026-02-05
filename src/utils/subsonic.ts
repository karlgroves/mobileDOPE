/**
 * Subsonic transition detection and modeling
 *
 * Bullets experience significant changes in behavior when they transition
 * from supersonic to subsonic flight. This is known as the "transonic zone"
 * and occurs roughly between Mach 1.2 and Mach 0.8.
 *
 * Key effects during transonic/subsonic transition:
 * 1. Increased instability - bullet may destabilize
 * 2. Changed drag characteristics - drag coefficient changes significantly
 * 3. Potential loss of accuracy - groups may open up
 * 4. Different sound signature - no longer has supersonic "crack"
 *
 * For precision shooting, it's important to know:
 * - Whether the bullet will go subsonic before reaching the target
 * - At what distance the transition occurs
 * - The velocity margin at the target distance
 */

import { calculateSpeedOfSound } from './atmospheric';

/**
 * Mach number boundaries for transonic region
 * The transonic zone is where drag behavior changes significantly
 */
export const TRANSONIC_UPPER = 1.2; // Above this, fully supersonic
export const TRANSONIC_LOWER = 0.8; // Below this, fully subsonic
export const SONIC = 1.0; // Speed of sound (Mach 1)

/**
 * Standard speed of sound at sea level, 59°F
 */
export const STANDARD_SPEED_OF_SOUND = 1125.33; // fps

/**
 * Flight regime classification
 */
export type FlightRegime = 'supersonic' | 'transonic' | 'subsonic';

/**
 * Subsonic transition result
 */
export interface SubsonicTransitionResult {
  /** Whether the bullet goes subsonic before the target */
  goesSubsonic: boolean;

  /** Distance where bullet reaches Mach 1.0 (null if stays supersonic) */
  transonicDistance: number | null;

  /** Distance where bullet drops below Mach 0.8 (null if not reached) */
  subsonicDistance: number | null;

  /** Current flight regime at target distance */
  flightRegime: FlightRegime;

  /** Mach number at target distance */
  machAtTarget: number;

  /** Velocity at target in fps */
  velocityAtTarget: number;

  /** Speed of sound used for calculation (fps) */
  speedOfSound: number;

  /** Warning message if subsonic transition affects shooting */
  warning: string | null;

  /** Recommended maximum distance to stay supersonic (yards) */
  maxSupersonicDistance: number | null;
}

/**
 * Determine flight regime based on Mach number
 */
export function getFlightRegime(mach: number): FlightRegime {
  if (mach >= TRANSONIC_UPPER) {
    return 'supersonic';
  } else if (mach <= TRANSONIC_LOWER) {
    return 'subsonic';
  } else {
    return 'transonic';
  }
}

/**
 * Calculate Mach number from velocity and speed of sound
 *
 * @param velocity - Bullet velocity in fps
 * @param speedOfSound - Speed of sound in fps
 * @returns Mach number
 */
export function calculateMach(velocity: number, speedOfSound: number): number {
  if (speedOfSound <= 0) {
    return velocity / STANDARD_SPEED_OF_SOUND;
  }
  return velocity / speedOfSound;
}

/**
 * Check if a bullet will go subsonic at a given velocity
 *
 * @param velocity - Bullet velocity in fps
 * @param temperature - Temperature in °F (affects speed of sound)
 * @returns Whether the bullet is subsonic
 */
export function isSubsonic(velocity: number, temperature: number = 59): boolean {
  const speedOfSound = calculateSpeedOfSound(temperature);
  const mach = calculateMach(velocity, speedOfSound);
  return mach < SONIC;
}

/**
 * Check if a bullet is in the transonic zone
 *
 * @param velocity - Bullet velocity in fps
 * @param temperature - Temperature in °F
 * @returns Whether the bullet is in transonic flight
 */
export function isTransonic(velocity: number, temperature: number = 59): boolean {
  const speedOfSound = calculateSpeedOfSound(temperature);
  const mach = calculateMach(velocity, speedOfSound);
  return mach < TRANSONIC_UPPER && mach > TRANSONIC_LOWER;
}

/**
 * Interface for trajectory point with velocity
 */
interface TrajectoryPointWithVelocity {
  distance: number; // yards
  velocity: number; // fps
}

/**
 * Detect subsonic transition from trajectory data
 *
 * Analyzes a trajectory to find where the bullet transitions
 * from supersonic to transonic/subsonic flight.
 *
 * @param trajectory - Array of trajectory points with distance and velocity
 * @param temperature - Temperature in °F (affects speed of sound)
 * @param targetDistance - Target distance in yards
 * @returns Subsonic transition analysis result
 */
export function detectSubsonicTransition(
  trajectory: TrajectoryPointWithVelocity[],
  temperature: number = 59,
  targetDistance: number
): SubsonicTransitionResult {
  const speedOfSound = calculateSpeedOfSound(temperature);

  // Find the target point
  const targetPoint =
    trajectory.find((p) => p.distance >= targetDistance) || trajectory[trajectory.length - 1];

  const velocityAtTarget = targetPoint?.velocity || 0;
  const machAtTarget = calculateMach(velocityAtTarget, speedOfSound);
  const flightRegime = getFlightRegime(machAtTarget);

  // Find transonic transition point (Mach 1.0)
  let transonicDistance: number | null = null;
  let subsonicDistance: number | null = null;
  let maxSupersonicDistance: number | null = null;

  for (let i = 1; i < trajectory.length; i++) {
    const prevPoint = trajectory[i - 1];
    const currPoint = trajectory[i];

    const prevMach = calculateMach(prevPoint.velocity, speedOfSound);
    const currMach = calculateMach(currPoint.velocity, speedOfSound);

    // Check for Mach 1.0 crossing
    if (transonicDistance === null && prevMach >= SONIC && currMach < SONIC) {
      // Linear interpolation to find exact crossing point
      const ratio = (SONIC - currMach) / (prevMach - currMach);
      transonicDistance = currPoint.distance - ratio * (currPoint.distance - prevPoint.distance);
    }

    // Check for Mach 0.8 crossing (fully subsonic)
    if (subsonicDistance === null && prevMach >= TRANSONIC_LOWER && currMach < TRANSONIC_LOWER) {
      const ratio = (TRANSONIC_LOWER - currMach) / (prevMach - currMach);
      subsonicDistance = currPoint.distance - ratio * (currPoint.distance - prevPoint.distance);
    }

    // Track max supersonic distance (Mach 1.2)
    if (
      maxSupersonicDistance === null &&
      prevMach >= TRANSONIC_UPPER &&
      currMach < TRANSONIC_UPPER
    ) {
      const ratio = (TRANSONIC_UPPER - currMach) / (prevMach - currMach);
      maxSupersonicDistance =
        currPoint.distance - ratio * (currPoint.distance - prevPoint.distance);
    }
  }

  // Determine if bullet goes subsonic before target
  const goesSubsonic = transonicDistance !== null && transonicDistance <= targetDistance;

  // Generate warning message
  let warning: string | null = null;

  if (goesSubsonic) {
    if (transonicDistance! < targetDistance * 0.7) {
      warning = `Bullet goes subsonic at ${Math.round(transonicDistance!)} yards, well before the ${targetDistance} yard target. Accuracy may be significantly degraded.`;
    } else {
      warning = `Bullet transitions to subsonic at ${Math.round(transonicDistance!)} yards. Consider using ammunition with higher muzzle velocity for better accuracy at this distance.`;
    }
  } else if (flightRegime === 'transonic') {
    warning = `Bullet is in transonic zone (Mach ${machAtTarget.toFixed(2)}) at ${targetDistance} yards. Some instability possible.`;
  }

  return {
    goesSubsonic,
    transonicDistance,
    subsonicDistance,
    flightRegime,
    machAtTarget,
    velocityAtTarget,
    speedOfSound,
    warning,
    maxSupersonicDistance,
  };
}

/**
 * Quick check if bullet will remain supersonic at target distance
 *
 * Uses a simple velocity decay estimation when full trajectory is not available.
 * This is an approximation and may not be accurate for all bullets.
 *
 * @param muzzleVelocity - Muzzle velocity in fps
 * @param bc - Ballistic coefficient
 * @param distance - Target distance in yards
 * @param temperature - Temperature in °F
 * @returns Whether bullet stays supersonic
 */
export function willRemainSupersonic(
  muzzleVelocity: number,
  bc: number,
  distance: number,
  temperature: number = 59
): boolean {
  const speedOfSound = calculateSpeedOfSound(temperature);

  // Simplified velocity decay estimation
  // This uses an approximate formula based on BC
  // More accurate results require full trajectory calculation
  //
  // v(d) ≈ v0 * e^(-k * d)
  // where k depends on BC (higher BC = lower k)
  //
  // For typical rifle bullets, k ≈ 0.0002 / BC for yards
  const k = 0.0002 / bc;
  const estimatedVelocity = muzzleVelocity * Math.exp(-k * distance);

  const mach = calculateMach(estimatedVelocity, speedOfSound);
  return mach >= SONIC;
}

/**
 * Estimate maximum range where bullet stays supersonic
 *
 * @param muzzleVelocity - Muzzle velocity in fps
 * @param bc - Ballistic coefficient
 * @param temperature - Temperature in °F
 * @returns Estimated maximum supersonic distance in yards
 */
export function estimateMaxSupersonicRange(
  muzzleVelocity: number,
  bc: number,
  temperature: number = 59
): number {
  const speedOfSound = calculateSpeedOfSound(temperature);
  const sonicVelocity = speedOfSound * SONIC;

  // Using inverse of velocity decay formula
  // v(d) = v0 * e^(-k * d)
  // d = -ln(v/v0) / k
  const k = 0.0002 / bc;
  const ratio = sonicVelocity / muzzleVelocity;

  if (ratio >= 1) {
    // Already subsonic at muzzle
    return 0;
  }

  const maxRange = -Math.log(ratio) / k;
  return Math.max(0, maxRange);
}

/**
 * Get velocity margin above speed of sound
 *
 * @param velocity - Current velocity in fps
 * @param temperature - Temperature in °F
 * @returns Velocity margin in fps (positive = supersonic, negative = subsonic)
 */
export function getSupersonicMargin(velocity: number, temperature: number = 59): number {
  const speedOfSound = calculateSpeedOfSound(temperature);
  return velocity - speedOfSound;
}

/**
 * Get Mach margin (how far above/below Mach 1)
 *
 * @param velocity - Current velocity in fps
 * @param temperature - Temperature in °F
 * @returns Mach margin (positive = supersonic, negative = subsonic)
 */
export function getMachMargin(velocity: number, temperature: number = 59): number {
  const speedOfSound = calculateSpeedOfSound(temperature);
  return calculateMach(velocity, speedOfSound) - SONIC;
}
