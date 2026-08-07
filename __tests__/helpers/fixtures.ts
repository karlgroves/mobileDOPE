import type { AmmoProfileData } from '../../src/models/AmmoProfile';
import type { DOPELogData } from '../../src/models/DOPELog';
import type { EnvironmentSnapshotData } from '../../src/models/EnvironmentSnapshot';
import type { RangeSessionData } from '../../src/models/RangeSession';
import type { RifleProfileData } from '../../src/models/RifleProfile';
import type { ShotStringData } from '../../src/models/ShotString';
import type { TargetImageData } from '../../src/models/TargetImage';

/**
 * Valid-by-default entity builders for service-layer tests.
 *
 * Each returns data that satisfies every NOT NULL and CHECK constraint in `DB_SCHEMA`, so a
 * test only has to state the fields it actually cares about. See issue #28 phase 2.
 */

export const validRifle = (overrides: Partial<RifleProfileData> = {}): RifleProfileData => ({
  name: 'Tikka T3x',
  caliber: '.308 Win',
  barrelLength: 24,
  twistRate: '1:11',
  zeroDistance: 100,
  opticManufacturer: 'Vortex',
  opticModel: 'Razor HD Gen III',
  reticleType: 'EBR-7C',
  clickValueType: 'MIL',
  clickValue: 0.1,
  scopeHeight: 1.75,
  ...overrides,
});

export const validAmmo = (overrides: Partial<AmmoProfileData> = {}): AmmoProfileData => ({
  name: '175gr SMK',
  manufacturer: 'Federal',
  caliber: '.308 Win',
  bulletWeight: 175,
  bulletType: 'Sierra MatchKing',
  ballisticCoefficientG1: 0.505,
  ballisticCoefficientG7: 0.258,
  muzzleVelocity: 2600,
  ...overrides,
});

export const validEnvironment = (
  overrides: Partial<EnvironmentSnapshotData> = {}
): EnvironmentSnapshotData => ({
  temperature: 59,
  humidity: 50,
  pressure: 29.92,
  altitude: 1000,
  windSpeed: 5,
  windDirection: 90,
  ...overrides,
});

/**
 * DOPE logs are FK-constrained to a rifle, ammo and environment row, so callers must pass
 * ids that already exist -- the schema enforces this and foreign keys are ON.
 */
export const validDopeLog = (
  ids: { rifleId: number; ammoId: number; environmentId: number },
  overrides: Partial<DOPELogData> = {}
): DOPELogData => ({
  ...ids,
  distance: 500,
  distanceUnit: 'yards',
  elevationCorrection: 3.4,
  windageCorrection: 0.5,
  correctionUnit: 'MIL',
  targetType: 'steel',
  ...overrides,
});

/** Shot strings are FK-constrained to an ammo profile. */
export const validShotString = (
  ammoId: number,
  overrides: Partial<ShotStringData> = {}
): ShotStringData => ({
  ammoId,
  sessionDate: '2026-08-01',
  shotNumber: 1,
  velocity: 2600,
  temperature: 59,
  ...overrides,
});

/** Range sessions are FK-constrained to a rifle, ammo and environment row. */
export const validRangeSession = (
  ids: { rifleId: number; ammoId: number; environmentId: number },
  overrides: Partial<RangeSessionData> = {}
): RangeSessionData => ({
  ...ids,
  startTime: '2026-08-01T09:00:00.000Z',
  distance: 500,
  shotCount: 0,
  coldBoreShot: false,
  ...overrides,
});

/**
 * Target images attach to a DOPE log and/or a range session; both columns are nullable, so
 * callers pass whichever linkage the test needs.
 */
export const validTargetImage = (overrides: Partial<TargetImageData> = {}): TargetImageData => ({
  imageUri: 'file:///targets/group-1.jpg',
  targetType: 'paper',
  poiMarkers: [{ x: 10, y: 20, shotNumber: 1 }],
  ...overrides,
});
