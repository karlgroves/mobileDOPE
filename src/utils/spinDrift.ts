/**
 * Spin drift calculations for right-hand twist barrels
 *
 * Spin drift is caused by the bullet's rotation (spin) interacting with the air,
 * causing a lateral deflection. For a right-hand twist barrel (most common),
 * the bullet drifts to the right.
 *
 * Uses the Bryan Litz method with Miller stability formula.
 */

/**
 * Bullet diameter lookup table for common calibers (in inches)
 * Maps caliber string patterns to bullet diameters
 */
const CALIBER_DIAMETER_MAP: Record<string, number> = {
  // Common rifle calibers
  '.17 HMR': 0.172,
  '.17 Hornet': 0.172,
  '.204 Ruger': 0.204,
  '.22 LR': 0.224,
  '.22 WMR': 0.224,
  '.223 Rem': 0.224,
  '.223 Remington': 0.224,
  '5.56 NATO': 0.224,
  '5.56x45': 0.224,
  '.22-250': 0.224,
  '.220 Swift': 0.224,
  '.224 Valkyrie': 0.224,
  '6mm Creedmoor': 0.243,
  '6mm BR': 0.243,
  '6mm ARC': 0.243,
  '.243 Win': 0.243,
  '.243 Winchester': 0.243,
  '.240 Weatherby': 0.243,
  '6.5 Grendel': 0.264,
  '6.5 Creedmoor': 0.264,
  '6.5x47 Lapua': 0.264,
  '6.5x55 Swedish': 0.264,
  '6.5 PRC': 0.264,
  '.260 Rem': 0.264,
  '.260 Remington': 0.264,
  '6.8 SPC': 0.277,
  '6.8 Western': 0.277,
  '.270 Win': 0.277,
  '.270 Winchester': 0.277,
  '.270 WSM': 0.277,
  '7mm-08': 0.284,
  '7mm Rem Mag': 0.284,
  '7mm PRC': 0.284,
  '.28 Nosler': 0.284,
  '.280 Ackley': 0.284,
  '.30 Carbine': 0.308,
  '.30-30': 0.308,
  '.300 BLK': 0.308,
  '.300 Blackout': 0.308,
  '.308 Win': 0.308,
  '.308 Winchester': 0.308,
  '7.62 NATO': 0.308,
  '7.62x51': 0.308,
  '.30-06': 0.308,
  '.300 Win Mag': 0.308,
  '.300 WSM': 0.308,
  '.300 PRC': 0.308,
  '.300 Norma Mag': 0.308,
  '.300 RUM': 0.308,
  '7.62x39': 0.311,
  '7.62x54R': 0.311,
  '.303 British': 0.311,
  '.338 Lapua': 0.338,
  '.338 Win Mag': 0.338,
  '.338 Norma': 0.338,
  '.338 Federal': 0.338,
  '.35 Rem': 0.358,
  '.35 Whelen': 0.358,
  '.375 H&H': 0.375,
  '.375 Ruger': 0.375,
  '.416 Rigby': 0.416,
  '.416 Rem Mag': 0.416,
  '.45-70': 0.458,
  '.458 Win Mag': 0.458,
  '.458 Lott': 0.458,
  '.50 BMG': 0.510,
};

/**
 * Parse twist rate string (e.g., "1:10") to get twist distance in inches
 * @param twistRate - Twist rate string in format "1:X"
 * @returns Twist distance in inches, or null if invalid
 */
export function parseTwistRate(twistRate: string): number | null {
  const match = twistRate.match(/^1:(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  return parseFloat(match[1]);
}

/**
 * Get bullet diameter from caliber string
 * @param caliber - Caliber string (e.g., ".308 Win", "6.5 Creedmoor")
 * @returns Bullet diameter in inches, or null if not found
 */
export function getBulletDiameter(caliber: string): number | null {
  // Try exact match first
  if (CALIBER_DIAMETER_MAP[caliber]) {
    return CALIBER_DIAMETER_MAP[caliber];
  }

  // Try case-insensitive match
  const caliberLower = caliber.toLowerCase();
  for (const [key, diameter] of Object.entries(CALIBER_DIAMETER_MAP)) {
    if (key.toLowerCase() === caliberLower) {
      return diameter;
    }
  }

  // Try partial match
  for (const [key, diameter] of Object.entries(CALIBER_DIAMETER_MAP)) {
    if (caliberLower.includes(key.toLowerCase()) || key.toLowerCase().includes(caliberLower)) {
      return diameter;
    }
  }

  // Try to extract diameter from caliber string (e.g., ".308" from ".308 Win")
  const diameterMatch = caliber.match(/\.?(\d{2,3})/);
  if (diameterMatch) {
    const numericPart = parseInt(diameterMatch[1]);
    if (numericPart >= 17 && numericPart <= 99) {
      // Two-digit caliber like .30, .22
      return numericPart / 100;
    } else if (numericPart >= 170 && numericPart <= 999) {
      // Three-digit caliber like .308, .223
      return numericPart / 1000;
    }
  }

  return null;
}

/**
 * Estimate bullet length from weight and diameter
 * Uses average jacketed bullet density for estimation
 *
 * @param bulletWeight - Bullet weight in grains
 * @param bulletDiameter - Bullet diameter in inches
 * @returns Estimated bullet length in inches
 */
export function estimateBulletLength(bulletWeight: number, bulletDiameter: number): number {
  // Average density of lead-core jacketed bullets is approximately
  // 10.5 g/cm³ accounting for jacket and core
  // This is an approximation; actual lengths vary by design

  // Convert grains to grams (1 grain = 0.0648 grams)
  const weightGrams = bulletWeight * 0.0648;

  // Convert diameter to cm
  const diameterCm = bulletDiameter * 2.54;

  // Assuming roughly cylindrical bullet with ogive factor
  // Volume = weight / density
  // For a cylinder: V = π * r² * L
  // L = V / (π * r²)
  //
  // Modern long-range bullets (VLD, ELD, etc.) have longer ogives
  // making them about 30-40% longer than a pure cylinder
  // Traditional bullets might be 15-20% longer

  const radius = diameterCm / 2;
  const density = 10.5; // g/cm³ average for jacketed bullets
  const volume = weightGrams / density;
  const cylinderLength = volume / (Math.PI * radius * radius);

  // Use 1.35 ogive factor for modern boat-tail bullets
  // This accounts for the ogive (nose) and boat-tail (base) extensions
  const ogiveAdjustedLength = cylinderLength * 1.35;

  // Convert back to inches
  return ogiveAdjustedLength / 2.54;
}

/**
 * Calculate gyroscopic stability factor using Miller's formula
 *
 * SG = 30 * M / (T² * D³ * L * (1 + L²))
 *
 * Where:
 * - M = bullet mass in grains
 * - T = twist rate in calibers per turn
 * - D = bullet diameter in inches
 * - L = bullet length in calibers
 *
 * Note: The twist rate is in calibers per turn (twist_inches / bullet_diameter),
 * and is in the denominator (faster twist = higher SG).
 *
 * @param bulletWeight - Bullet weight in grains
 * @param bulletDiameter - Bullet diameter in inches
 * @param bulletLength - Bullet length in inches
 * @param twistInches - Twist rate in inches per turn
 * @returns Gyroscopic stability factor (SG > 1.0 is stable, SG > 1.5 is ideal)
 */
export function calculateStabilityFactor(
  bulletWeight: number,
  bulletDiameter: number,
  bulletLength: number,
  twistInches: number
): number {
  // Convert twist rate to calibers per turn
  const twistCalibers = twistInches / bulletDiameter;

  // Convert bullet length to calibers
  const lengthCalibers = bulletLength / bulletDiameter;

  // Miller stability formula
  // SG = 30 * M / (T² * D³ * L * (1 + L²))
  const numerator = 30 * bulletWeight;
  const denominator =
    twistCalibers *
    twistCalibers *
    Math.pow(bulletDiameter, 3) *
    lengthCalibers *
    (1 + lengthCalibers * lengthCalibers);

  return numerator / denominator;
}

/**
 * Calculate spin drift using the Litz method
 *
 * Spin drift (inches) = 1.25 * (SG + 1.2) * TOF^1.83
 *
 * This formula has been validated against actual range data by Bryan Litz.
 * Result is positive for right-hand twist (drift to the right).
 *
 * @param stabilityFactor - Gyroscopic stability factor (SG)
 * @param timeOfFlight - Time of flight in seconds
 * @param isRightHandTwist - Whether the barrel has right-hand twist (default: true)
 * @returns Spin drift in inches (positive = right, negative = left)
 */
export function calculateSpinDrift(
  stabilityFactor: number,
  timeOfFlight: number,
  isRightHandTwist: boolean = true
): number {
  // Litz spin drift formula
  const drift = 1.25 * (stabilityFactor + 1.2) * Math.pow(timeOfFlight, 1.83);

  // Right-hand twist drifts right (positive), left-hand twist drifts left (negative)
  return isRightHandTwist ? drift : -drift;
}

/**
 * Parameters for spin drift calculation
 */
export interface SpinDriftParams {
  bulletWeight: number; // grains
  bulletDiameter: number; // inches (can be looked up from caliber)
  bulletLength?: number; // inches (optional, will be estimated if not provided)
  twistRate: string; // e.g., "1:10"
  timeOfFlight: number; // seconds
  isRightHandTwist?: boolean; // default: true
}

/**
 * Spin drift result
 */
export interface SpinDriftResult {
  spinDrift: number; // inches
  stabilityFactor: number;
  bulletLength: number; // inches (estimated if not provided)
  twistInches: number;
  isStable: boolean; // SG > 1.0
  isIdeallyStable: boolean; // SG > 1.5
}

/**
 * Calculate complete spin drift with all intermediate values
 *
 * @param params - Spin drift calculation parameters
 * @returns Spin drift result with all values
 */
export function calculateSpinDriftComplete(params: SpinDriftParams): SpinDriftResult | null {
  const {
    bulletWeight,
    bulletDiameter,
    bulletLength: providedLength,
    twistRate,
    timeOfFlight,
    isRightHandTwist = true,
  } = params;

  // Parse twist rate
  const twistInches = parseTwistRate(twistRate);
  if (!twistInches) {
    return null;
  }

  // Estimate bullet length if not provided
  const bulletLength = providedLength || estimateBulletLength(bulletWeight, bulletDiameter);

  // Calculate stability factor
  const stabilityFactor = calculateStabilityFactor(
    bulletWeight,
    bulletDiameter,
    bulletLength,
    twistInches
  );

  // Calculate spin drift
  const spinDrift = calculateSpinDrift(stabilityFactor, timeOfFlight, isRightHandTwist);

  return {
    spinDrift,
    stabilityFactor,
    bulletLength,
    twistInches,
    isStable: stabilityFactor > 1.0,
    isIdeallyStable: stabilityFactor > 1.5,
  };
}

/**
 * Quick spin drift calculation when you only need the drift value
 *
 * @param caliber - Caliber string (e.g., ".308 Win")
 * @param bulletWeight - Bullet weight in grains
 * @param twistRate - Twist rate string (e.g., "1:10")
 * @param timeOfFlight - Time of flight in seconds
 * @returns Spin drift in inches, or 0 if calculation fails
 */
export function getSpinDrift(
  caliber: string,
  bulletWeight: number,
  twistRate: string,
  timeOfFlight: number
): number {
  const bulletDiameter = getBulletDiameter(caliber);
  if (!bulletDiameter) {
    return 0;
  }

  const result = calculateSpinDriftComplete({
    bulletWeight,
    bulletDiameter,
    twistRate,
    timeOfFlight,
  });

  return result?.spinDrift || 0;
}
