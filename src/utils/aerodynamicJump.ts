/**
 * Aerodynamic Jump Calculation
 *
 * Aerodynamic jump is an instantaneous angular deflection that occurs at the muzzle
 * when a spinning bullet encounters a crosswind. Unlike spin drift which accumulates
 * over the trajectory, aerodynamic jump happens immediately and then the bullet
 * maintains that offset angle throughout flight.
 *
 * Key factors:
 * - Occurs due to interaction between bullet spin and crosswind
 * - For right-hand twist: crosswind from right causes UPWARD jump
 * - For right-hand twist: crosswind from left causes DOWNWARD jump
 * - Effect is proportional to crosswind velocity and inversely related to muzzle velocity
 * - More pronounced with longer, less stable bullets
 *
 * This is often confused with spin drift but is a completely different phenomenon.
 * Aerodynamic jump is vertical while spin drift is horizontal.
 */

/**
 * Aerodynamic jump parameters
 */
export interface AeroJumpParams {
  /** Muzzle velocity in fps */
  muzzleVelocity: number;
  /** Crosswind component in fps (positive = from right, negative = from left) */
  crosswindFps: number;
  /** Gyroscopic stability factor (SG) - higher = more stable = less jump */
  stabilityFactor: number;
  /** Whether the barrel has right-hand twist (default: true) */
  isRightHandTwist?: boolean;
}

/**
 * Aerodynamic jump result
 */
export interface AeroJumpResult {
  /** Jump angle in milliradians (positive = up, negative = down) */
  jumpAngleMrad: number;
  /** Jump angle in MOA */
  jumpAngleMOA: number;
  /** Vertical offset at target distance in inches */
  verticalOffset: number;
  /** Whether jump is upward or downward */
  direction: 'up' | 'down' | 'none';
  /** Description of the effect */
  description: string;
}

/**
 * Calculate aerodynamic jump angle
 *
 * The aerodynamic jump angle can be estimated using:
 * θ_jump ≈ k * (V_crosswind / V_muzzle) * (1 / SG)
 *
 * Where k is an empirical constant (approximately 1.0-2.0 depending on bullet design)
 *
 * For a right-hand twist barrel:
 * - Crosswind from right (positive) → bullet jumps UP (positive angle)
 * - Crosswind from left (negative) → bullet jumps DOWN (negative angle)
 *
 * For a left-hand twist barrel, the effects are reversed.
 *
 * @param params - Aerodynamic jump parameters
 * @returns Jump angle in milliradians
 */
export function calculateAeroJumpAngle(params: AeroJumpParams): number {
  const { muzzleVelocity, crosswindFps, stabilityFactor, isRightHandTwist = true } = params;

  // Validate inputs
  if (muzzleVelocity <= 0 || stabilityFactor <= 0) {
    return 0;
  }

  // Empirical constant for aerodynamic jump
  // Aerodynamic jump is typically a very small effect.
  // Based on McCoy and other ballistic references, the constant k
  // should produce micro-radian level angles for typical inputs.
  // k ≈ 0.015 produces realistic values (sub-MOA for most scenarios)
  const k = 0.015;

  // Calculate jump angle in radians
  // θ = k * (Vcw / Vm) * (1 / SG)
  const jumpAngleRad = (k * crosswindFps) / (muzzleVelocity * stabilityFactor);

  // Convert to milliradians
  let jumpAngleMrad = jumpAngleRad * 1000;

  // For left-hand twist, reverse the direction
  if (!isRightHandTwist) {
    jumpAngleMrad = -jumpAngleMrad;
  }

  return jumpAngleMrad;
}

/**
 * Calculate complete aerodynamic jump effect
 *
 * @param params - Aerodynamic jump parameters
 * @param targetDistance - Target distance in yards
 * @returns Complete aerodynamic jump result
 */
export function calculateAeroJump(params: AeroJumpParams, targetDistance: number): AeroJumpResult {
  const jumpAngleMrad = calculateAeroJumpAngle(params);

  // Convert to MOA (1 mrad ≈ 3.438 MOA)
  const jumpAngleMOA = jumpAngleMrad * 3.438;

  // Calculate vertical offset at target distance
  // offset = tan(angle) * distance
  // For small angles, tan(θ) ≈ θ in radians
  const jumpAngleRad = jumpAngleMrad / 1000;
  const distanceInches = targetDistance * 36;
  const verticalOffset = Math.tan(jumpAngleRad) * distanceInches;

  // Determine direction
  let direction: 'up' | 'down' | 'none';
  if (Math.abs(jumpAngleMrad) < 0.01) {
    direction = 'none';
  } else if (jumpAngleMrad > 0) {
    direction = 'up';
  } else {
    direction = 'down';
  }

  // Generate description
  let description: string;
  if (direction === 'none') {
    description = 'No significant aerodynamic jump (no crosswind or very stable bullet).';
  } else {
    const absOffset = Math.abs(verticalOffset);
    const absMrad = Math.abs(jumpAngleMrad);
    description = `Aerodynamic jump: ${absOffset.toFixed(2)}" ${direction} (${absMrad.toFixed(2)} mrad) due to crosswind interaction with bullet spin.`;
  }

  return {
    jumpAngleMrad,
    jumpAngleMOA,
    verticalOffset,
    direction,
    description,
  };
}

/**
 * Convert wind speed and direction to crosswind component in fps
 *
 * @param windSpeed - Wind speed in mph
 * @param windDirection - Wind direction in degrees (0 = headwind, 90 = from right, 270 = from left)
 * @returns Crosswind component in fps (positive = from right)
 */
export function getWindCrossComponent(windSpeed: number, windDirection: number): number {
  // Convert wind direction to radians
  const windAngleRad = (windDirection * Math.PI) / 180;

  // Calculate crosswind component (positive when wind is from the right)
  // At 90° (from right), sin = 1
  // At 270° (from left), sin = -1
  const crosswindMph = windSpeed * Math.sin(windAngleRad);

  // Convert mph to fps (1 mph = 1.467 fps)
  return crosswindMph * 1.467;
}

/**
 * Quick aerodynamic jump calculation
 *
 * @param muzzleVelocity - Muzzle velocity in fps
 * @param windSpeed - Wind speed in mph
 * @param windDirection - Wind direction in degrees
 * @param stabilityFactor - Gyroscopic stability factor
 * @param targetDistance - Target distance in yards
 * @param isRightHandTwist - Whether barrel has right-hand twist
 * @returns Vertical offset in inches
 */
export function getAeroJumpOffset(
  muzzleVelocity: number,
  windSpeed: number,
  windDirection: number,
  stabilityFactor: number,
  targetDistance: number,
  isRightHandTwist: boolean = true
): number {
  const crosswindFps = getWindCrossComponent(windSpeed, windDirection);

  const result = calculateAeroJump(
    {
      muzzleVelocity,
      crosswindFps,
      stabilityFactor,
      isRightHandTwist,
    },
    targetDistance
  );

  return result.verticalOffset;
}

/**
 * Determine if aerodynamic jump is significant at given parameters
 *
 * Generally, aerodynamic jump becomes significant when:
 * - There's meaningful crosswind (> 5 mph)
 * - Stability factor is marginal (< 1.5)
 * - Distance is long enough for small angles to matter
 *
 * @param windSpeed - Wind speed in mph
 * @param stabilityFactor - Gyroscopic stability factor
 * @param targetDistance - Target distance in yards
 * @returns Whether aerodynamic jump correction is significant
 */
export function isAeroJumpSignificant(
  windSpeed: number,
  stabilityFactor: number,
  targetDistance: number
): boolean {
  // No crosswind = no aero jump
  if (windSpeed < 1) {
    return false;
  }

  // Very stable bullets have minimal aero jump
  if (stabilityFactor > 2.5) {
    return false;
  }

  // Short range = minimal effect
  if (targetDistance < 300) {
    return false;
  }

  // Estimate rough offset for 10 mph crosswind, 2700 fps MV
  const testCrosswind = Math.min(windSpeed, 10) * 1.467; // fps
  const testJumpAngle = (0.015 * testCrosswind) / (2700 * stabilityFactor);
  const testOffset = Math.abs(testJumpAngle * targetDistance * 36); // inches

  // Significant if > 0.1 inches (aerodynamic jump is typically small)
  return testOffset > 0.1;
}

/**
 * Compare aerodynamic jump to spin drift to understand relative magnitudes
 *
 * @param aeroJumpInches - Aerodynamic jump in inches (vertical)
 * @param spinDriftInches - Spin drift in inches (horizontal)
 * @returns Description of relative effects
 */
export function compareJumpToDrift(
  aeroJumpInches: number,
  spinDriftInches: number
): {
  dominant: 'aero_jump' | 'spin_drift' | 'similar';
  ratio: number;
  description: string;
} {
  const absJump = Math.abs(aeroJumpInches);
  const absDrift = Math.abs(spinDriftInches);

  if (absJump < 0.1 && absDrift < 0.1) {
    return {
      dominant: 'similar',
      ratio: 1,
      description: 'Both aerodynamic jump and spin drift are negligible.',
    };
  }

  if (absDrift < 0.1) {
    return {
      dominant: 'aero_jump',
      ratio: Infinity,
      description: `Aerodynamic jump (${absJump.toFixed(2)}") dominates; spin drift is negligible.`,
    };
  }

  const ratio = absJump / absDrift;

  if (ratio > 2) {
    return {
      dominant: 'aero_jump',
      ratio,
      description: `Aerodynamic jump (${absJump.toFixed(2)}") is ${ratio.toFixed(1)}x larger than spin drift (${absDrift.toFixed(2)}").`,
    };
  } else if (ratio < 0.5) {
    return {
      dominant: 'spin_drift',
      ratio,
      description: `Spin drift (${absDrift.toFixed(2)}") dominates aerodynamic jump (${absJump.toFixed(2)}").`,
    };
  } else {
    return {
      dominant: 'similar',
      ratio,
      description: `Aerodynamic jump (${absJump.toFixed(2)}") and spin drift (${absDrift.toFixed(2)}") are of similar magnitude.`,
    };
  }
}
