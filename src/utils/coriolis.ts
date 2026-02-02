/**
 * Coriolis effect calculations for long-range shooting
 *
 * The Coriolis effect is caused by the Earth's rotation and affects bullet
 * trajectory at long ranges. The effect increases with:
 * - Higher latitudes (maximum at poles, zero at equator for horizontal)
 * - Longer time of flight
 * - Higher bullet velocity
 *
 * For horizontal deflection (left/right):
 * - In the Northern Hemisphere, bullets deflect RIGHT (positive)
 * - In the Southern Hemisphere, bullets deflect LEFT (negative)
 *
 * The vertical component (Eötvös effect) depends on direction of fire:
 * - Firing East: bullet drops more (appears lighter)
 * - Firing West: bullet drops less (appears heavier)
 */

/**
 * Earth's angular velocity in radians per second
 * Earth completes one rotation (2π radians) in approximately 86,164 seconds (sidereal day)
 */
const EARTH_ANGULAR_VELOCITY = 7.2921e-5; // rad/s

/**
 * Convert degrees to radians
 */
function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculate horizontal Coriolis deflection
 *
 * The horizontal Coriolis deflection causes bullets to drift right in the
 * Northern Hemisphere and left in the Southern Hemisphere.
 *
 * Formula: deflection = 2 * ω * v_avg * t * sin(latitude)
 *
 * Where:
 * - ω = Earth's angular velocity (7.2921e-5 rad/s)
 * - v_avg = average bullet velocity during flight
 * - t = time of flight
 * - latitude = shooter's latitude in degrees (positive = North, negative = South)
 *
 * @param latitude - Shooter's latitude in degrees (-90 to 90)
 * @param timeOfFlight - Time of flight in seconds
 * @param averageVelocity - Average bullet velocity in feet per second
 * @returns Horizontal deflection in inches (positive = right, negative = left)
 */
export function calculateHorizontalCoriolis(
  latitude: number,
  timeOfFlight: number,
  averageVelocity: number
): number {
  // Clamp latitude to valid range
  const clampedLat = Math.max(-90, Math.min(90, latitude));

  // Convert latitude to radians
  const latRad = degToRad(clampedLat);

  // Calculate deflection in feet
  // deflection = 2 * ω * v * t * sin(lat)
  const deflectionFeet =
    2 * EARTH_ANGULAR_VELOCITY * averageVelocity * timeOfFlight * Math.sin(latRad);

  // Convert to inches
  return deflectionFeet * 12;
}

/**
 * Calculate vertical Coriolis deflection (Eötvös effect)
 *
 * The vertical Coriolis effect depends on the direction of fire (azimuth):
 * - Firing East (90°): bullet experiences additional "weight", drops more
 * - Firing West (270°): bullet experiences reduced "weight", drops less
 * - Firing North (0°) or South (180°): minimal effect
 *
 * Formula: deflection = 2 * ω * v_avg * t * cos(latitude) * sin(azimuth)
 *
 * @param latitude - Shooter's latitude in degrees (-90 to 90)
 * @param azimuth - Direction of fire in degrees (0 = North, 90 = East, 180 = South, 270 = West)
 * @param timeOfFlight - Time of flight in seconds
 * @param averageVelocity - Average bullet velocity in feet per second
 * @returns Vertical deflection in inches (positive = additional drop, negative = reduced drop)
 */
export function calculateVerticalCoriolis(
  latitude: number,
  azimuth: number,
  timeOfFlight: number,
  averageVelocity: number
): number {
  // Clamp latitude to valid range
  const clampedLat = Math.max(-90, Math.min(90, latitude));

  // Normalize azimuth to 0-360
  let normalizedAzimuth = azimuth % 360;
  if (normalizedAzimuth < 0) normalizedAzimuth += 360;

  // Convert to radians
  const latRad = degToRad(clampedLat);
  const azimuthRad = degToRad(normalizedAzimuth);

  // Calculate deflection in feet
  // deflection = 2 * ω * v * t * cos(lat) * sin(azimuth)
  const deflectionFeet =
    2 *
    EARTH_ANGULAR_VELOCITY *
    averageVelocity *
    timeOfFlight *
    Math.cos(latRad) *
    Math.sin(azimuthRad);

  // Convert to inches
  return deflectionFeet * 12;
}

/**
 * Parameters for Coriolis calculation
 */
export interface CoriolisParams {
  latitude: number; // degrees (-90 to 90, positive = North)
  azimuth?: number; // degrees (0 = North, 90 = East, 180 = South, 270 = West)
  timeOfFlight: number; // seconds
  muzzleVelocity: number; // fps
  velocityAtTarget: number; // fps
}

/**
 * Coriolis effect result
 */
export interface CoriolisResult {
  horizontalDeflection: number; // inches (positive = right)
  verticalDeflection: number; // inches (positive = additional drop)
  horizontalMIL: number; // MIL correction
  horizontalMOA: number; // MOA correction
  verticalMIL: number; // MIL correction
  verticalMOA: number; // MOA correction
  hemisphere: 'Northern' | 'Southern' | 'Equator';
  description: string;
}

/**
 * Calculate complete Coriolis effect
 *
 * @param params - Coriolis calculation parameters
 * @param distance - Target distance in yards (for angular conversion)
 * @returns Complete Coriolis effect result
 */
export function calculateCoriolisComplete(
  params: CoriolisParams,
  distance: number
): CoriolisResult {
  const { latitude, azimuth = 0, timeOfFlight, muzzleVelocity, velocityAtTarget } = params;

  // Calculate average velocity (simple average, more accurate methods exist)
  const averageVelocity = (muzzleVelocity + velocityAtTarget) / 2;

  // Calculate deflections
  const horizontalDeflection = calculateHorizontalCoriolis(latitude, timeOfFlight, averageVelocity);

  const verticalDeflection = calculateVerticalCoriolis(
    latitude,
    azimuth,
    timeOfFlight,
    averageVelocity
  );

  // Convert to angular measurements
  const distanceInches = distance * 36;

  // MIL = atan(deflection/distance) * 1000
  const horizontalMIL = Math.atan(horizontalDeflection / distanceInches) * 1000;
  const horizontalMOA = (Math.atan(horizontalDeflection / distanceInches) * 180) / Math.PI * 60;

  const verticalMIL = Math.atan(verticalDeflection / distanceInches) * 1000;
  const verticalMOA = (Math.atan(verticalDeflection / distanceInches) * 180) / Math.PI * 60;

  // Determine hemisphere
  let hemisphere: 'Northern' | 'Southern' | 'Equator';
  if (Math.abs(latitude) < 0.1) {
    hemisphere = 'Equator';
  } else if (latitude > 0) {
    hemisphere = 'Northern';
  } else {
    hemisphere = 'Southern';
  }

  // Generate description
  let description = '';
  if (Math.abs(horizontalDeflection) < 0.1 && Math.abs(verticalDeflection) < 0.1) {
    description = 'Coriolis effect is negligible at this range and latitude.';
  } else {
    const hDirection = horizontalDeflection > 0 ? 'right' : 'left';
    const vDirection = verticalDeflection > 0 ? 'additional drop' : 'reduced drop';
    description = `Bullet drifts ${Math.abs(horizontalDeflection).toFixed(2)}" ${hDirection} and ${Math.abs(verticalDeflection).toFixed(2)}" ${vDirection} due to Coriolis effect.`;
  }

  return {
    horizontalDeflection,
    verticalDeflection,
    horizontalMIL,
    horizontalMOA,
    verticalMIL,
    verticalMOA,
    hemisphere,
    description,
  };
}

/**
 * Quick calculation for horizontal Coriolis deflection only
 *
 * @param latitude - Shooter's latitude in degrees
 * @param timeOfFlight - Time of flight in seconds
 * @param muzzleVelocity - Muzzle velocity in fps
 * @param velocityAtTarget - Velocity at target in fps
 * @returns Horizontal deflection in inches
 */
export function getHorizontalCoriolis(
  latitude: number,
  timeOfFlight: number,
  muzzleVelocity: number,
  velocityAtTarget: number
): number {
  const averageVelocity = (muzzleVelocity + velocityAtTarget) / 2;
  return calculateHorizontalCoriolis(latitude, timeOfFlight, averageVelocity);
}

/**
 * Determine if Coriolis correction is significant at given parameters
 *
 * Generally, Coriolis effect becomes significant (>0.1 MIL) when:
 * - Distance > 600 yards
 * - Time of flight > 0.7 seconds
 * - Latitude > 30°
 *
 * @param latitude - Shooter's latitude in degrees
 * @param distance - Target distance in yards
 * @param timeOfFlight - Time of flight in seconds
 * @returns Whether Coriolis correction is significant
 */
export function isCoriolisSignificant(
  latitude: number,
  distance: number,
  timeOfFlight: number
): boolean {
  // Quick heuristic check
  if (distance < 500 || timeOfFlight < 0.5) {
    return false;
  }

  // At typical mid-latitudes (40°), 2500 fps average velocity
  // 0.1 MIL threshold at 1000 yards is about 3.6 inches
  // deflection = 2 * 7.2921e-5 * 2500 * TOF * sin(40°)
  // For TOF = 1.5s: deflection ≈ 2 * 7.2921e-5 * 2500 * 1.5 * 0.643 ≈ 0.35 feet ≈ 4.2 inches

  // Check if potentially significant
  const potentialDeflection = Math.abs(
    2 * EARTH_ANGULAR_VELOCITY * 2500 * timeOfFlight * Math.sin(degToRad(latitude))
  );

  // Convert to MIL at given distance
  const deflectionInches = potentialDeflection * 12;
  const distanceInches = distance * 36;
  const deflectionMIL = Math.atan(deflectionInches / distanceInches) * 1000;

  // Significant if > 0.1 MIL
  return Math.abs(deflectionMIL) > 0.1;
}
