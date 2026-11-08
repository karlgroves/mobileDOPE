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
 * - Firing East: the bullet is pushed UP and strikes high (it is "lighter")
 * - Firing West: the bullet is pushed DOWN and strikes low (it is "heavier")
 *
 * ## The model, and how it is checked (#222)
 *
 * The Coriolis acceleration on a bullet moving at speed v is 2ω·v·sin(lat)
 * sideways and 2ω·v·cos(lat)·sin(azimuth) upward. Integrating an ACCELERATION
 * twice over the time of flight t, with v taken as the average speed, gives a
 * DISTANCE:
 *
 *   deflection = ω · v_avg · t² · trig(lat, azimuth)
 *
 * which is the textbook flat-fire expression ω·X·t·sin(lat) (McCoy, Modern
 * Exterior Ballistics; Litz, Applied Ballistics) with X = v_avg·t. Until #222
 * this file used 2ω·v·t, which is a VELOCITY, not a distance: it overstated the
 * deflection about fivefold at 300 yards and understated it past 2 seconds of
 * flight. `__tests__/unit/advancedCorrectionsValidation.test.ts` pins the
 * closed form and cross-checks it by integrating the acceleration over the
 * solver's own trajectory.
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
 * Formula: deflection = ω * v_avg * t² * sin(latitude)
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

  // Calculate deflection in feet: the integral of 2ω·v·sin(lat) over the flight
  const deflectionFeet =
    EARTH_ANGULAR_VELOCITY * averageVelocity * timeOfFlight * timeOfFlight * Math.sin(latRad);

  // Convert to inches
  return deflectionFeet * 12;
}

/**
 * Calculate vertical Coriolis deflection (Eötvös effect)
 *
 * The vertical Coriolis effect depends on the direction of fire (azimuth):
 * - Firing East (90°): the bullet is pushed up and strikes high
 * - Firing West (270°): the bullet is pushed down and strikes low
 * - Firing North (0°) or South (180°): no effect
 *
 * Formula: deflection = ω * v_avg * t² * cos(latitude) * sin(azimuth)
 *
 * @param latitude - Shooter's latitude in degrees (-90 to 90)
 * @param azimuth - Direction of fire in degrees (0 = North, 90 = East, 180 = South, 270 = West)
 * @param timeOfFlight - Time of flight in seconds
 * @param averageVelocity - Average bullet velocity in feet per second
 * @returns Vertical deflection in inches, same sense as the solver's `drop`
 *   (positive = UP, the bullet strikes high; negative = down, it strikes low)
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

  // Calculate deflection in feet: the integral of 2ω·v·cos(lat)·sin(azimuth)
  const deflectionFeet =
    EARTH_ANGULAR_VELOCITY *
    averageVelocity *
    timeOfFlight *
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
  verticalDeflection: number; // inches (positive = up, strikes high)
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
  const horizontalMOA = ((Math.atan(horizontalDeflection / distanceInches) * 180) / Math.PI) * 60;

  const verticalMIL = Math.atan(verticalDeflection / distanceInches) * 1000;
  const verticalMOA = ((Math.atan(verticalDeflection / distanceInches) * 180) / Math.PI) * 60;

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
    const vDirection = verticalDeflection > 0 ? 'high' : 'low';
    description = `Bullet drifts ${Math.abs(horizontalDeflection).toFixed(2)}" ${hDirection} and strikes ${Math.abs(verticalDeflection).toFixed(2)}" ${vDirection} due to Coriolis effect.`;
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
 * Significant means the horizontal term exceeds 0.1 MIL. Since the deflection
 * is ω·X·t·sin(lat) for a range X, its ANGLE is ω·t·sin(lat) whatever the
 * range or velocity: about 0.08 MIL for 1.5 s of flight at 45°, so it takes
 * roughly 2 s of flight at mid-latitudes, and is never reached at the equator.
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

  const clampedLat = Math.max(-90, Math.min(90, latitude));
  const deflectionMIL =
    EARTH_ANGULAR_VELOCITY * timeOfFlight * Math.sin(degToRad(clampedLat)) * 1000;

  // Significant if > 0.1 MIL
  return Math.abs(deflectionMIL) > 0.1;
}
