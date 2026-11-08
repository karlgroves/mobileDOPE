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
 * The Coriolis acceleration on a bullet moving downrange at speed v is
 * 2ω·v·sin(lat) sideways and 2ω·v·cos(lat)·sin(azimuth) upward. Drag slows the
 * sideways velocity this builds up in the same proportion as it slows the
 * bullet, so the sideways speed at time t is 2ω·trig·t·v(t), and the deflection
 * over a flight of range X and time T is a DISTANCE:
 *
 *   deflection = 2ω · trig(lat, azimuth) · ∫₀^X t(x) dx
 *
 * At constant speed v this is ω·v·T²·trig, the textbook flat-fire
 * ω·X·T·sin(lat) (McCoy, Modern Exterior Ballistics). Under drag it is smaller:
 * `calculateCoriolisComplete` evaluates the integral from the muzzle and target
 * speeds (see `dragLaggedVelocity`), which puts a .308 at 1000 yards and 45° N
 * at about 2.8", inside Litz's published 2.5-3.0" for a typical 1000 yard
 * small-arms trajectory (Applied Ballistics, "Gyroscopic (spin) Drift and
 * Coriolis Effect"). Until #222 this file used 2ω·v·t, which is a VELOCITY, not
 * a distance: it overstated the deflection about fivefold at 300 yards and
 * understated it past 2 seconds of flight.
 * `__tests__/unit/advancedCorrectionsValidation.test.ts` pins the closed forms,
 * the published band, and the integral over the solver's own trajectory.
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
 * - v_avg = the constant speed with the same deflection; exact at constant
 *   speed, and `dragLaggedVelocity` gives it for a drag-slowed flight
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
 * The constant speed that gives the same Coriolis deflection as the real,
 * slowing flight: v such that ω·v·T² = 2ω·∫₀^X t(x) dx.
 *
 * t(x) is convex, starting at slope 1/V₀ and ending at slope 1/V_target, so a
 * cubic Hermite fit gives ∫₀^X t dx = X·T/2 + X²·(1/V₀ − 1/V_target)/12, within
 * 0.3% of the integral over the solver's trajectory to 1000 yards and within
 * about 2% through the transonic range. The arithmetic mean of muzzle and
 * target speed, used before, overstates the deflection by about 30% at 1000
 * yards for a .308, because it ignores the drag that slows the sideways speed.
 *
 * Falls back to that mean when the inputs cannot describe a flight.
 *
 * @param distanceFeet - Range in feet
 * @param timeOfFlight - Time of flight in seconds
 * @param muzzleVelocity - Muzzle velocity in fps
 * @param velocityAtTarget - Velocity at the target in fps
 * @returns Effective velocity in fps
 */
export function dragLaggedVelocity(
  distanceFeet: number,
  timeOfFlight: number,
  muzzleVelocity: number,
  velocityAtTarget: number
): number {
  const mean = (muzzleVelocity + velocityAtTarget) / 2;
  if (!(distanceFeet > 0 && timeOfFlight > 0 && muzzleVelocity > 0 && velocityAtTarget > 0)) {
    return mean;
  }

  const integral =
    (distanceFeet * timeOfFlight) / 2 +
    (distanceFeet * distanceFeet * (1 / muzzleVelocity - 1 / velocityAtTarget)) / 12;

  return Math.max(0, (2 * integral) / (timeOfFlight * timeOfFlight));
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

  // The constant speed with the same deflection as the drag-slowed flight
  const averageVelocity = dragLaggedVelocity(
    distance * 3,
    timeOfFlight,
    muzzleVelocity,
    velocityAtTarget
  );

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
 * Without the range it cannot account for drag (see `dragLaggedVelocity`), so
 * it uses the mean of muzzle and target speed and overstates the deflection
 * at long range; `calculateCoriolisComplete` is the accurate form.
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
 * Significant means the horizontal term may exceed 0.1 MIL. The flat-fire
 * deflection ω·X·t·sin(lat) subtends ω·t·sin(lat) whatever the range, and drag
 * only makes the real angle smaller, so this is a conservative upper bound:
 * about 0.08 MIL for 1.5 s of flight at 45°, so it takes roughly 2 s of flight
 * at mid-latitudes, and is never reached at the equator.
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
