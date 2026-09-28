/**
 * Stored profiles and environment snapshots, mapped to the solver's inputs.
 *
 * The DOPE curve and the input-correction suggestions (#64) both compare logged
 * DOPE with the solver, so they must build its inputs the same way. Before this
 * the curve built them inline; now both come through here.
 */

import { calculateBallisticSolution } from './ballistics';

import type { AtmosphericConditions } from './atmospheric';
import type { AmmoProfileData } from '../models/AmmoProfile';
import type { EnvironmentSnapshotData } from '../models/EnvironmentSnapshot';
import type { RifleProfileData } from '../models/RifleProfile';
import type { AmmoConfig, RifleConfig } from '../types/ballistic.types';

/** The rifle-profile fields the solver reads. */
type RifleFields = Pick<
  RifleProfileData,
  'zeroDistance' | 'scopeHeight' | 'twistRate' | 'barrelLength'
>;
/** The ammo-profile fields the solver reads. */
type AmmoFields = Pick<
  AmmoProfileData,
  'bulletWeight' | 'ballisticCoefficientG1' | 'ballisticCoefficientG7' | 'muzzleVelocity'
>;
/** The snapshot fields that change the solution. */
type ConditionFields = Pick<EnvironmentSnapshotData, 'temperature' | 'pressure' | 'humidity'>;

/** ICAO standard day at sea level, in the solver's units (°F, inHg, %). */
export const STANDARD_ATMOSPHERE: AtmosphericConditions = {
  temperature: 59,
  pressure: 29.92,
  humidity: 50,
  altitude: 0,
};

export const rifleConfigFor = (rifle: RifleFields): RifleConfig => ({
  zeroDistance: rifle.zeroDistance,
  sightHeight: rifle.scopeHeight,
  twistRate: rifle.twistRate,
  barrelLength: rifle.barrelLength,
});

/** G7 when the profile has one -- it models long-range drag better -- else G1. */
export const ammoConfigFor = (ammo: AmmoFields): AmmoConfig => ({
  bulletWeight: ammo.bulletWeight,
  ballisticCoefficient: ammo.ballisticCoefficientG7 || ammo.ballisticCoefficientG1,
  dragModel: ammo.ballisticCoefficientG7 ? 'G7' : 'G1',
  muzzleVelocity: ammo.muzzleVelocity,
});

/**
 * The conditions a snapshot recorded, or the standard atmosphere without one.
 *
 * Altitude is 0 as in the calculator: the solver never reads it, and the
 * elevation is already in the station pressure (#89).
 */
export const atmosphereFor = (env: ConditionFields | undefined): AtmosphericConditions =>
  env
    ? { temperature: env.temperature, pressure: env.pressure, humidity: env.humidity, altitude: 0 }
    : STANDARD_ATMOSPHERE;

/** The solver's elevation correction at `yards`, level and windless. */
export const predictElevation = (
  rifle: RifleFields,
  ammo: AmmoFields,
  yards: number,
  env: ConditionFields | undefined,
  unit: 'MIL' | 'MOA'
): number => {
  const solution = calculateBallisticSolution(
    rifleConfigFor(rifle),
    ammoConfigFor(ammo),
    { distance: yards, angle: 0, windSpeed: 0, windDirection: 0 },
    atmosphereFor(env)
  );
  return unit === 'MIL' ? solution.elevationMIL : solution.elevationMOA;
};
