/**
 * Model factories for testing
 * These factory functions create valid model instances with sensible defaults
 * that can be overridden for specific test scenarios.
 */

import { RifleProfile, RifleProfileData } from './RifleProfile';
import { AmmoProfile, AmmoProfileData } from './AmmoProfile';
import { DOPELog, DOPELogData } from './DOPELog';
import { EnvironmentSnapshot, EnvironmentSnapshotData } from './EnvironmentSnapshot';
import { ShotString, ShotStringData } from './ShotString';
import { RangeSession, RangeSessionData } from './RangeSession';
import { TargetImage, TargetImageData, POIMarker } from './TargetImage';

/**
 * Counter for generating unique IDs in factories
 */
let idCounter = 1;

/**
 * Reset the ID counter (useful in beforeEach hooks)
 */
export function resetFactoryIds(): void {
  idCounter = 1;
}

/**
 * Get the next unique ID
 */
function nextId(): number {
  return idCounter++;
}

/**
 * Create a RifleProfile with sensible defaults
 */
export function createRifleProfile(overrides: Partial<RifleProfileData> = {}): RifleProfile {
  const defaults: RifleProfileData = {
    id: nextId(),
    name: `Test Rifle ${idCounter}`,
    caliber: '.308 Winchester',
    barrelLength: 24,
    twistRate: '1:10',
    zeroDistance: 100,
    opticManufacturer: 'Vortex',
    opticModel: 'Viper PST Gen II',
    reticleType: 'EBR-2C MRAD',
    clickValueType: 'MIL',
    clickValue: 0.1,
    scopeHeight: 1.5,
    notes: 'Test rifle profile',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return new RifleProfile({ ...defaults, ...overrides });
}

/**
 * Create an AmmoProfile with sensible defaults
 */
export function createAmmoProfile(overrides: Partial<AmmoProfileData> = {}): AmmoProfile {
  const defaults: AmmoProfileData = {
    id: nextId(),
    name: `Test Ammo ${idCounter}`,
    manufacturer: 'Federal',
    caliber: '.308 Winchester',
    bulletWeight: 175,
    bulletType: 'SMK HPBT',
    ballisticCoefficientG1: 0.505,
    ballisticCoefficientG7: 0.260,
    muzzleVelocity: 2600,
    powderType: 'Varget',
    powderWeight: 44.5,
    lotNumber: 'LOT-2024-001',
    notes: 'Test ammo profile',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return new AmmoProfile({ ...defaults, ...overrides });
}

/**
 * Create an EnvironmentSnapshot with sensible defaults (standard conditions)
 */
export function createEnvironmentSnapshot(
  overrides: Partial<EnvironmentSnapshotData> = {}
): EnvironmentSnapshot {
  const defaults: EnvironmentSnapshotData = {
    id: nextId(),
    temperature: 59, // Standard atmosphere temp (15°C)
    humidity: 50,
    pressure: 29.92, // Standard atmosphere pressure
    altitude: 0,
    densityAltitude: 0,
    windSpeed: 5,
    windDirection: 90, // Crosswind from 3 o'clock
    latitude: 37.7749,
    longitude: -122.4194,
    timestamp: new Date().toISOString(),
  };

  return new EnvironmentSnapshot({ ...defaults, ...overrides });
}

/**
 * Create a DOPELog with sensible defaults
 */
export function createDOPELog(overrides: Partial<DOPELogData> = {}): DOPELog {
  const defaults: DOPELogData = {
    id: nextId(),
    rifleId: 1,
    ammoId: 1,
    environmentId: 1,
    distance: 100,
    distanceUnit: 'yards',
    elevationCorrection: 0,
    windageCorrection: 0,
    correctionUnit: 'MIL',
    targetType: 'paper',
    groupSize: 1.0,
    hitCount: 5,
    shotCount: 5,
    notes: 'Test DOPE log entry',
    timestamp: new Date().toISOString(),
  };

  return new DOPELog({ ...defaults, ...overrides });
}

/**
 * Create a ShotString with sensible defaults
 */
export function createShotString(overrides: Partial<ShotStringData> = {}): ShotString {
  const defaults: ShotStringData = {
    id: nextId(),
    ammoId: 1,
    sessionDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
    shotNumber: 1,
    velocity: 2600,
    temperature: 72,
    notes: 'Test shot',
    createdAt: new Date().toISOString(),
  };

  return new ShotString({ ...defaults, ...overrides });
}

/**
 * Create a RangeSession with sensible defaults
 */
export function createRangeSession(overrides: Partial<RangeSessionData> = {}): RangeSession {
  const defaults: RangeSessionData = {
    id: nextId(),
    rifleId: 1,
    ammoId: 1,
    environmentId: 1,
    sessionName: `Test Session ${idCounter}`,
    startTime: new Date().toISOString(),
    distance: 100,
    shotCount: 0,
    coldBoreShot: true,
    notes: 'Test range session',
    createdAt: new Date().toISOString(),
  };

  return new RangeSession({ ...defaults, ...overrides });
}

/**
 * Create a TargetImage with sensible defaults
 */
export function createTargetImage(overrides: Partial<TargetImageData> = {}): TargetImage {
  const defaults: TargetImageData = {
    id: nextId(),
    dopeLogId: 1,
    imageUri: `/path/to/test-target-${idCounter}.jpg`,
    targetType: 'paper',
    poiMarkers: [],
    groupSize: 1.5,
    createdAt: new Date().toISOString(),
  };

  return new TargetImage({ ...defaults, ...overrides });
}

/**
 * Create a POIMarker with sensible defaults
 */
export function createPOIMarker(overrides: Partial<POIMarker> = {}): POIMarker {
  const defaults: POIMarker = {
    x: Math.floor(Math.random() * 200) + 50,
    y: Math.floor(Math.random() * 200) + 50,
    shotNumber: nextId(),
  };

  return { ...defaults, ...overrides };
}

/**
 * Create multiple POI markers for a group
 */
export function createPOIMarkerGroup(
  count: number,
  centerX: number = 100,
  centerY: number = 100,
  spreadRadius: number = 10
): POIMarker[] {
  const markers: POIMarker[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count;
    const radius = Math.random() * spreadRadius;
    markers.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      shotNumber: i + 1,
    });
  }

  return markers;
}

/**
 * Create a complete shot string (multiple shots in a session)
 */
export function createShotStringSession(
  ammoId: number,
  sessionDate: string,
  velocities: number[],
  baseTemperature: number = 72
): ShotString[] {
  return velocities.map((velocity, index) =>
    createShotString({
      ammoId,
      sessionDate,
      shotNumber: index + 1,
      velocity,
      temperature: baseTemperature,
    })
  );
}

/**
 * Create environment data for different scenarios
 */
export const EnvironmentPresets = {
  /**
   * Standard atmosphere conditions (sea level, 59°F)
   */
  standard: (): Partial<EnvironmentSnapshotData> => ({
    temperature: 59,
    humidity: 0,
    pressure: 29.92,
    altitude: 0,
    densityAltitude: 0,
  }),

  /**
   * Hot summer day conditions
   */
  hotDay: (): Partial<EnvironmentSnapshotData> => ({
    temperature: 95,
    humidity: 60,
    pressure: 29.75,
    altitude: 500,
    densityAltitude: 2800,
  }),

  /**
   * Cold winter day conditions
   */
  coldDay: (): Partial<EnvironmentSnapshotData> => ({
    temperature: 25,
    humidity: 30,
    pressure: 30.10,
    altitude: 500,
    densityAltitude: -1500,
  }),

  /**
   * High altitude conditions (e.g., mountain range)
   */
  highAltitude: (): Partial<EnvironmentSnapshotData> => ({
    temperature: 50,
    humidity: 20,
    pressure: 24.89,
    altitude: 6000,
    densityAltitude: 7500,
  }),

  /**
   * No wind conditions
   */
  noWind: (): Partial<EnvironmentSnapshotData> => ({
    windSpeed: 0,
    windDirection: 0,
  }),

  /**
   * Strong crosswind from 3 o'clock
   */
  strongCrosswind: (): Partial<EnvironmentSnapshotData> => ({
    windSpeed: 15,
    windDirection: 90,
  }),

  /**
   * Headwind conditions
   */
  headwind: (): Partial<EnvironmentSnapshotData> => ({
    windSpeed: 10,
    windDirection: 0,
  }),

  /**
   * Tailwind conditions
   */
  tailwind: (): Partial<EnvironmentSnapshotData> => ({
    windSpeed: 10,
    windDirection: 180,
  }),
};

/**
 * Create rifle profiles for common calibers
 */
export const RiflePresets = {
  /**
   * .308 Winchester precision rifle
   */
  precision308: (): Partial<RifleProfileData> => ({
    name: 'Precision .308',
    caliber: '.308 Winchester',
    barrelLength: 24,
    twistRate: '1:10',
    zeroDistance: 100,
    clickValueType: 'MIL',
    clickValue: 0.1,
    scopeHeight: 1.75,
  }),

  /**
   * 6.5 Creedmoor long range rifle
   */
  longRange65CM: (): Partial<RifleProfileData> => ({
    name: 'Long Range 6.5 CM',
    caliber: '6.5 Creedmoor',
    barrelLength: 26,
    twistRate: '1:8',
    zeroDistance: 100,
    clickValueType: 'MIL',
    clickValue: 0.1,
    scopeHeight: 2.0,
  }),

  /**
   * .223 Remington AR platform
   */
  ar223: (): Partial<RifleProfileData> => ({
    name: 'AR-15 .223',
    caliber: '.223 Remington',
    barrelLength: 16,
    twistRate: '1:7',
    zeroDistance: 50,
    clickValueType: 'MOA',
    clickValue: 0.25,
    scopeHeight: 2.5,
  }),

  /**
   * .45-70 lever action
   */
  leverAction4570: (): Partial<RifleProfileData> => ({
    name: 'Lever Action .45-70',
    caliber: '.45-70 Government',
    barrelLength: 22,
    twistRate: '1:20',
    zeroDistance: 100,
    clickValueType: 'MOA',
    clickValue: 0.5,
    scopeHeight: 1.5,
  }),
};

/**
 * Create ammo profiles for common loads
 */
export const AmmoPresets = {
  /**
   * Federal Gold Medal Match 175gr .308
   */
  federalGMM175: (): Partial<AmmoProfileData> => ({
    name: 'Federal GMM 175gr SMK',
    manufacturer: 'Federal',
    caliber: '.308 Winchester',
    bulletWeight: 175,
    bulletType: 'Sierra MatchKing HPBT',
    ballisticCoefficientG1: 0.505,
    ballisticCoefficientG7: 0.260,
    muzzleVelocity: 2600,
  }),

  /**
   * Hornady ELD Match 140gr 6.5 CM
   */
  hornady140ELDMatch: (): Partial<AmmoProfileData> => ({
    name: 'Hornady 140gr ELD Match',
    manufacturer: 'Hornady',
    caliber: '6.5 Creedmoor',
    bulletWeight: 140,
    bulletType: 'ELD Match',
    ballisticCoefficientG1: 0.610,
    ballisticCoefficientG7: 0.315,
    muzzleVelocity: 2710,
  }),

  /**
   * M855 Ball 62gr .223
   */
  m855Ball: (): Partial<AmmoProfileData> => ({
    name: 'M855 Ball',
    manufacturer: 'Military Surplus',
    caliber: '.223 Remington',
    bulletWeight: 62,
    bulletType: 'FMJ Steel Core',
    ballisticCoefficientG1: 0.304,
    ballisticCoefficientG7: 0.151,
    muzzleVelocity: 3020,
  }),

  /**
   * Subsonic .300 Blackout
   */
  subsonic300BLK: (): Partial<AmmoProfileData> => ({
    name: 'Subsonic 220gr .300 BLK',
    manufacturer: 'Hornady',
    caliber: '.300 AAC Blackout',
    bulletWeight: 220,
    bulletType: 'A-MAX',
    ballisticCoefficientG1: 0.340,
    ballisticCoefficientG7: 0.175,
    muzzleVelocity: 1020,
  }),
};
