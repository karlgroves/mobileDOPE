import { TargetImage } from '../../../src/models/TargetImage';
import ammoProfileRepository from '../../../src/services/database/AmmoProfileRepository';
import dopeLogRepository from '../../../src/services/database/DOPELogRepository';
import environmentRepository from '../../../src/services/database/EnvironmentRepository';
import rifleProfileRepository from '../../../src/services/database/RifleProfileRepository';
import targetImageRepository from '../../../src/services/database/TargetImageRepository';
import {
  validAmmo,
  validDopeLog,
  validEnvironment,
  validRifle,
  validTargetImage,
} from '../../helpers/fixtures';
import { installTestDatabase, uninstallTestDatabase } from '../../helpers/testDatabase';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../../helpers/testDatabase').openDatabaseAsync(),
}));

/**
 * A saved target keeps the scale it was marked at (#63, migration 008).
 *
 * Against real SQLite: the columns are new, and a model field the INSERT forgot
 * would pass every model test and still come back empty from the database.
 */

describe('TargetImage scale', () => {
  it('rejects a width that cannot be a target', () => {
    for (const targetWidthInches of [0, -1, NaN, Infinity]) {
      expect(() => new TargetImage(validTargetImage({ dopeLogId: 1, targetWidthInches }))).toThrow(
        'Target width must be a positive number of inches'
      );
    }
  });

  it('rejects an aspect ratio that cannot be an image', () => {
    for (const aspectRatio of [0, -1, NaN]) {
      expect(() => new TargetImage(validTargetImage({ dopeLogId: 1, aspectRatio }))).toThrow(
        'Aspect ratio must be a positive number'
      );
    }
  });

  it('allows a target with no scale at all', () => {
    // Marked but not yet measured: the shooter may not know the width at the range.
    expect(() => new TargetImage(validTargetImage({ dopeLogId: 1 }))).not.toThrow();
  });
});

describe('TargetImageRepository with scale', () => {
  let dopeLogId: number;

  beforeEach(async () => {
    await installTestDatabase();
    const rifleId = (await rifleProfileRepository.create(validRifle())).id as number;
    const ammoId = (await ammoProfileRepository.create(validAmmo())).id as number;
    const environmentId = (await environmentRepository.create(validEnvironment())).id as number;
    dopeLogId = (await dopeLogRepository.create(validDopeLog({ rifleId, ammoId, environmentId })))
      .id as number;
  });

  afterEach(async () => {
    await uninstallTestDatabase();
  });

  it('stores and reads back the width and aspect ratio', async () => {
    const created = await targetImageRepository.create(
      validTargetImage({ dopeLogId, targetWidthInches: 8.5, aspectRatio: 11 / 8.5 })
    );

    const fetched = await targetImageRepository.getById(created.id as number);
    expect(fetched?.targetWidthInches).toBe(8.5);
    expect(fetched?.aspectRatio).toBeCloseTo(11 / 8.5, 12);
  });

  it('reads an unscaled target back as unscaled, not as zero', async () => {
    const created = await targetImageRepository.create(validTargetImage({ dopeLogId }));

    const fetched = await targetImageRepository.getById(created.id as number);
    expect(fetched?.targetWidthInches).toBeUndefined();
    expect(fetched?.aspectRatio).toBeUndefined();
  });

  it('updates the scale with the marks', async () => {
    const created = await targetImageRepository.create(validTargetImage({ dopeLogId }));

    await targetImageRepository.update(created.id as number, {
      targetWidthInches: 12,
      aspectRatio: 1,
      poiMarkers: [{ x: 0.5, y: 0.5, shotNumber: 1 }],
    });

    const fetched = await targetImageRepository.getById(created.id as number);
    expect(fetched?.targetWidthInches).toBe(12);
    expect(fetched?.aspectRatio).toBe(1);
  });

  it('keeps a measured group size of zero as zero', async () => {
    // Two shots through one hole is a real, if rare, 0.00-inch group. Stored as
    // `group_size || null` it came back as "no group size recorded".
    const created = await targetImageRepository.create(
      validTargetImage({ dopeLogId, groupSize: 0, targetWidthInches: 10 })
    );

    expect((await targetImageRepository.getById(created.id as number))?.groupSize).toBe(0);
  });
});
