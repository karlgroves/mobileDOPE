import {
  createRifleProfile,
  createAmmoProfile,
  createEnvironmentSnapshot,
  createDOPELog,
  createShotString,
  createRangeSession,
  createTargetImage,
  createPOIMarker,
  createPOIMarkerGroup,
  createShotStringSession,
  resetFactoryIds,
  EnvironmentPresets,
  RiflePresets,
  AmmoPresets,
} from '../../../src/models/factories';
import { RifleProfile } from '../../../src/models/RifleProfile';
import { AmmoProfile } from '../../../src/models/AmmoProfile';
import { EnvironmentSnapshot } from '../../../src/models/EnvironmentSnapshot';
import { DOPELog } from '../../../src/models/DOPELog';
import { ShotString } from '../../../src/models/ShotString';
import { RangeSession } from '../../../src/models/RangeSession';
import { TargetImage, POIMarker } from '../../../src/models/TargetImage';

describe('Model Factories', () => {
  beforeEach(() => {
    resetFactoryIds();
  });

  describe('createRifleProfile', () => {
    it('should create a valid RifleProfile with defaults', () => {
      const profile = createRifleProfile();

      expect(profile).toBeInstanceOf(RifleProfile);
      expect(profile.name).toContain('Test Rifle');
      expect(profile.caliber).toBe('.308 Winchester');
      expect(profile.barrelLength).toBe(24);
      expect(profile.twistRate).toBe('1:10');
      expect(profile.zeroDistance).toBe(100);
      expect(profile.clickValueType).toBe('MIL');
      expect(profile.clickValue).toBe(0.1);
    });

    it('should allow overriding defaults', () => {
      const profile = createRifleProfile({
        name: 'Custom Rifle',
        caliber: '6.5 Creedmoor',
        barrelLength: 26,
      });

      expect(profile.name).toBe('Custom Rifle');
      expect(profile.caliber).toBe('6.5 Creedmoor');
      expect(profile.barrelLength).toBe(26);
    });

    it('should generate unique IDs', () => {
      const profile1 = createRifleProfile();
      const profile2 = createRifleProfile();

      expect(profile1.id).not.toBe(profile2.id);
    });
  });

  describe('createAmmoProfile', () => {
    it('should create a valid AmmoProfile with defaults', () => {
      const profile = createAmmoProfile();

      expect(profile).toBeInstanceOf(AmmoProfile);
      expect(profile.name).toContain('Test Ammo');
      expect(profile.manufacturer).toBe('Federal');
      expect(profile.bulletWeight).toBe(175);
      expect(profile.ballisticCoefficientG1).toBe(0.505);
      expect(profile.muzzleVelocity).toBe(2600);
    });

    it('should allow overriding defaults', () => {
      const profile = createAmmoProfile({
        name: 'Custom Load',
        muzzleVelocity: 2800,
      });

      expect(profile.name).toBe('Custom Load');
      expect(profile.muzzleVelocity).toBe(2800);
    });
  });

  describe('createEnvironmentSnapshot', () => {
    it('should create a valid EnvironmentSnapshot with defaults', () => {
      const snapshot = createEnvironmentSnapshot();

      expect(snapshot).toBeInstanceOf(EnvironmentSnapshot);
      expect(snapshot.temperature).toBe(59);
      expect(snapshot.pressure).toBe(29.92);
      expect(snapshot.humidity).toBe(50);
    });

    it('should allow overriding defaults', () => {
      const snapshot = createEnvironmentSnapshot({
        temperature: 85,
        windSpeed: 15,
      });

      expect(snapshot.temperature).toBe(85);
      expect(snapshot.windSpeed).toBe(15);
    });
  });

  describe('createDOPELog', () => {
    it('should create a valid DOPELog with defaults', () => {
      const log = createDOPELog();

      expect(log).toBeInstanceOf(DOPELog);
      expect(log.distance).toBe(100);
      expect(log.distanceUnit).toBe('yards');
      expect(log.correctionUnit).toBe('MIL');
      expect(log.targetType).toBe('paper');
    });

    it('should allow overriding defaults', () => {
      const log = createDOPELog({
        distance: 500,
        elevationCorrection: 4.5,
        targetType: 'steel',
      });

      expect(log.distance).toBe(500);
      expect(log.elevationCorrection).toBe(4.5);
      expect(log.targetType).toBe('steel');
    });
  });

  describe('createShotString', () => {
    it('should create a valid ShotString with defaults', () => {
      const shot = createShotString();

      expect(shot).toBeInstanceOf(ShotString);
      expect(shot.velocity).toBe(2600);
      expect(shot.temperature).toBe(72);
      expect(shot.shotNumber).toBe(1);
    });

    it('should allow overriding defaults', () => {
      const shot = createShotString({
        velocity: 2650,
        shotNumber: 5,
      });

      expect(shot.velocity).toBe(2650);
      expect(shot.shotNumber).toBe(5);
    });
  });

  describe('createRangeSession', () => {
    it('should create a valid RangeSession with defaults', () => {
      const session = createRangeSession();

      expect(session).toBeInstanceOf(RangeSession);
      expect(session.sessionName).toContain('Test Session');
      expect(session.distance).toBe(100);
      expect(session.shotCount).toBe(0);
      expect(session.coldBoreShot).toBe(true);
    });

    it('should allow overriding defaults', () => {
      const session = createRangeSession({
        distance: 600,
        shotCount: 10,
        coldBoreShot: false,
      });

      expect(session.distance).toBe(600);
      expect(session.shotCount).toBe(10);
      expect(session.coldBoreShot).toBe(false);
    });
  });

  describe('createTargetImage', () => {
    it('should create a valid TargetImage with defaults', () => {
      const image = createTargetImage();

      expect(image).toBeInstanceOf(TargetImage);
      expect(image.imageUri).toContain('/path/to/test-target');
      expect(image.targetType).toBe('paper');
      expect(image.poiMarkers).toEqual([]);
      expect(image.groupSize).toBe(1.5);
    });

    it('should allow overriding defaults', () => {
      const markers: POIMarker[] = [{ x: 50, y: 75 }];
      const image = createTargetImage({
        targetType: 'steel',
        poiMarkers: markers,
        groupSize: 2.0,
      });

      expect(image.targetType).toBe('steel');
      expect(image.poiMarkers).toEqual(markers);
      expect(image.groupSize).toBe(2.0);
    });
  });

  describe('createPOIMarker', () => {
    it('should create a valid POIMarker with x and y coordinates', () => {
      const marker = createPOIMarker();

      expect(typeof marker.x).toBe('number');
      expect(typeof marker.y).toBe('number');
      expect(marker.x).toBeGreaterThanOrEqual(50);
      expect(marker.y).toBeGreaterThanOrEqual(50);
    });

    it('should allow overriding coordinates', () => {
      const marker = createPOIMarker({ x: 100, y: 150, shotNumber: 5 });

      expect(marker.x).toBe(100);
      expect(marker.y).toBe(150);
      expect(marker.shotNumber).toBe(5);
    });
  });

  describe('createPOIMarkerGroup', () => {
    it('should create specified number of markers', () => {
      const markers = createPOIMarkerGroup(5);

      expect(markers).toHaveLength(5);
      markers.forEach((marker, index) => {
        expect(marker.shotNumber).toBe(index + 1);
      });
    });

    it('should create markers around center point', () => {
      const centerX = 200;
      const centerY = 200;
      const spread = 10;
      const markers = createPOIMarkerGroup(5, centerX, centerY, spread);

      markers.forEach((marker) => {
        const distanceFromCenter = Math.sqrt(
          Math.pow(marker.x - centerX, 2) + Math.pow(marker.y - centerY, 2)
        );
        expect(distanceFromCenter).toBeLessThanOrEqual(spread);
      });
    });
  });

  describe('createShotStringSession', () => {
    it('should create multiple shot strings for a session', () => {
      const velocities = [2600, 2610, 2595, 2608, 2602];
      const shots = createShotStringSession(1, '2024-01-15', velocities);

      expect(shots).toHaveLength(5);
      shots.forEach((shot, index) => {
        expect(shot.velocity).toBe(velocities[index]);
        expect(shot.shotNumber).toBe(index + 1);
        expect(shot.ammoId).toBe(1);
        expect(shot.sessionDate).toBe('2024-01-15');
      });
    });

    it('should use provided base temperature', () => {
      const velocities = [2600, 2610];
      const shots = createShotStringSession(1, '2024-01-15', velocities, 85);

      shots.forEach((shot) => {
        expect(shot.temperature).toBe(85);
      });
    });
  });

  describe('EnvironmentPresets', () => {
    it('standard() should return standard atmosphere conditions', () => {
      const preset = EnvironmentPresets.standard();

      expect(preset.temperature).toBe(59);
      expect(preset.pressure).toBe(29.92);
      expect(preset.altitude).toBe(0);
    });

    it('hotDay() should return hot conditions with high density altitude', () => {
      const preset = EnvironmentPresets.hotDay();

      expect(preset.temperature).toBe(95);
      expect(preset.densityAltitude).toBeGreaterThan(0);
    });

    it('coldDay() should return cold conditions with negative density altitude', () => {
      const preset = EnvironmentPresets.coldDay();

      expect(preset.temperature).toBe(25);
      expect(preset.densityAltitude).toBeLessThan(0);
    });

    it('highAltitude() should return mountain conditions', () => {
      const preset = EnvironmentPresets.highAltitude();

      expect(preset.altitude).toBe(6000);
      expect(preset.pressure).toBeLessThan(29.92);
    });

    it('noWind() should return zero wind conditions', () => {
      const preset = EnvironmentPresets.noWind();

      expect(preset.windSpeed).toBe(0);
    });

    it('strongCrosswind() should return crosswind from 3 oclock', () => {
      const preset = EnvironmentPresets.strongCrosswind();

      expect(preset.windSpeed).toBe(15);
      expect(preset.windDirection).toBe(90);
    });

    it('should create valid environment with preset', () => {
      const env = createEnvironmentSnapshot(EnvironmentPresets.hotDay());

      expect(env).toBeInstanceOf(EnvironmentSnapshot);
      expect(env.temperature).toBe(95);
    });
  });

  describe('RiflePresets', () => {
    it('precision308() should return .308 precision rifle config', () => {
      const preset = RiflePresets.precision308();

      expect(preset.caliber).toBe('.308 Winchester');
      expect(preset.barrelLength).toBe(24);
      expect(preset.clickValueType).toBe('MIL');
    });

    it('longRange65CM() should return 6.5 Creedmoor config', () => {
      const preset = RiflePresets.longRange65CM();

      expect(preset.caliber).toBe('6.5 Creedmoor');
      expect(preset.barrelLength).toBe(26);
    });

    it('ar223() should return AR-15 config', () => {
      const preset = RiflePresets.ar223();

      expect(preset.caliber).toBe('.223 Remington');
      expect(preset.clickValueType).toBe('MOA');
    });

    it('should create valid rifle with preset', () => {
      const rifle = createRifleProfile(RiflePresets.precision308());

      expect(rifle).toBeInstanceOf(RifleProfile);
      expect(rifle.caliber).toBe('.308 Winchester');
    });
  });

  describe('AmmoPresets', () => {
    it('federalGMM175() should return Federal Gold Medal Match config', () => {
      const preset = AmmoPresets.federalGMM175();

      expect(preset.manufacturer).toBe('Federal');
      expect(preset.bulletWeight).toBe(175);
      expect(preset.muzzleVelocity).toBe(2600);
    });

    it('hornady140ELDMatch() should return Hornady ELD Match config', () => {
      const preset = AmmoPresets.hornady140ELDMatch();

      expect(preset.manufacturer).toBe('Hornady');
      expect(preset.caliber).toBe('6.5 Creedmoor');
      expect(preset.bulletWeight).toBe(140);
    });

    it('subsonic300BLK() should return subsonic .300 BLK config', () => {
      const preset = AmmoPresets.subsonic300BLK();

      expect(preset.muzzleVelocity).toBeLessThan(1100); // Subsonic
      expect(preset.bulletWeight).toBe(220);
    });

    it('should create valid ammo with preset', () => {
      const ammo = createAmmoProfile(AmmoPresets.federalGMM175());

      expect(ammo).toBeInstanceOf(AmmoProfile);
      expect(ammo.manufacturer).toBe('Federal');
    });
  });

  describe('resetFactoryIds', () => {
    it('should reset ID counter', () => {
      createRifleProfile();
      createRifleProfile();
      createRifleProfile();

      resetFactoryIds();

      const profile = createRifleProfile();
      expect(profile.id).toBe(1);
    });
  });
});
