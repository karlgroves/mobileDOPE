import ammoProfileRepository from '../../../src/services/database/AmmoProfileRepository';
import dopeLogRepository from '../../../src/services/database/DOPELogRepository';
import environmentRepository from '../../../src/services/database/EnvironmentRepository';
import rangeSessionRepository from '../../../src/services/database/RangeSessionRepository';
import rifleProfileRepository from '../../../src/services/database/RifleProfileRepository';
import targetImageRepository from '../../../src/services/database/TargetImageRepository';
import {
  validAmmo,
  validDopeLog,
  validEnvironment,
  validRangeSession,
  validRifle,
  validTargetImage,
} from '../../helpers/fixtures';
import { installTestDatabase, uninstallTestDatabase } from '../../helpers/testDatabase';

import type { TestDatabase } from '../../helpers/testDatabase';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../../helpers/testDatabase').openDatabaseAsync(),
}));

describe('TargetImageRepository', () => {
  let db: TestDatabase;
  let dopeLogId: number;
  let rangeSessionId: number;

  beforeEach(async () => {
    db = await installTestDatabase();
    const rifleId = (await rifleProfileRepository.create(validRifle())).id as number;
    const ammoId = (await ammoProfileRepository.create(validAmmo())).id as number;
    const environmentId = (await environmentRepository.create(validEnvironment())).id as number;
    const ids = { rifleId, ammoId, environmentId };
    dopeLogId = (await dopeLogRepository.create(validDopeLog(ids))).id as number;
    rangeSessionId = (await rangeSessionRepository.create(validRangeSession(ids))).id as number;
  });

  afterEach(async () => {
    await uninstallTestDatabase();
  });

  describe('create', () => {
    it('persists the image and returns the assigned id', async () => {
      const created = await targetImageRepository.create(validTargetImage({ dopeLogId }));

      expect(created.id).toBeGreaterThan(0);
      expect(await targetImageRepository.count()).toBe(1);
    });

    it('serialises POI markers to JSON and reads them back as objects', async () => {
      const markers = [
        { x: 10, y: 20, shotNumber: 1 },
        { x: 12.5, y: 18.25, shotNumber: 2 },
      ];
      const created = await targetImageRepository.create(
        validTargetImage({ dopeLogId, poiMarkers: markers })
      );

      const row = await db.getFirstAsync<{ poi_markers: string }>(
        'SELECT poi_markers FROM target_images WHERE id = ?',
        [created.id]
      );
      expect(typeof row?.poi_markers).toBe('string');
      expect(JSON.parse(row?.poi_markers as string)).toEqual(markers);

      const fetched = await targetImageRepository.getById(created.id as number);
      expect(fetched?.poiMarkers).toEqual(markers);
    });

    it('accepts an empty marker list', async () => {
      const created = await targetImageRepository.create(
        validTargetImage({ dopeLogId, poiMarkers: [] })
      );

      expect((await targetImageRepository.getById(created.id as number))?.poiMarkers).toEqual([]);
    });

    it('can attach to a range session instead of a DOPE log', async () => {
      const created = await targetImageRepository.create(validTargetImage({ rangeSessionId }));

      const found = await targetImageRepository.getByRangeSessionId(rangeSessionId);
      expect(found.map((t) => t.id)).toEqual([created.id]);
    });

    it('rejects an image referencing a DOPE log that does not exist (foreign key)', async () => {
      await expect(
        targetImageRepository.create(validTargetImage({ dopeLogId: 9999 }))
      ).rejects.toThrow();
    });
  });

  describe('foreign key cascade', () => {
    it('deletes a DOPE log’s images when the log is deleted', async () => {
      await targetImageRepository.create(validTargetImage({ dopeLogId }));

      await dopeLogRepository.delete(dopeLogId);

      expect(await targetImageRepository.count()).toBe(0);
    });

    it('deletes a range session’s images when the session is deleted', async () => {
      await targetImageRepository.create(validTargetImage({ rangeSessionId }));

      await rangeSessionRepository.delete(rangeSessionId);

      expect(await targetImageRepository.count()).toBe(0);
    });
  });

  describe('getByDopeLogId', () => {
    it('returns only that log’s images', async () => {
      await targetImageRepository.create(validTargetImage({ dopeLogId }));
      await targetImageRepository.create(validTargetImage({ rangeSessionId }));

      expect(await targetImageRepository.getByDopeLogId(dopeLogId)).toHaveLength(1);
    });

    it('returns an empty array when the log has no images', async () => {
      expect(await targetImageRepository.getByDopeLogId(dopeLogId)).toEqual([]);
    });
  });

  describe('updatePoiMarkers', () => {
    it('replaces the marker list', async () => {
      const created = await targetImageRepository.create(validTargetImage({ dopeLogId }));
      const replacement = [{ x: 1, y: 2 }];

      const updated = await targetImageRepository.updatePoiMarkers(
        created.id as number,
        replacement
      );

      expect(updated?.poiMarkers).toEqual(replacement);
      expect((await targetImageRepository.getById(created.id as number))?.poiMarkers).toEqual(
        replacement
      );
    });
  });

  describe('updateGroupSize', () => {
    it('records the measured group size', async () => {
      const created = await targetImageRepository.create(validTargetImage({ dopeLogId }));

      const updated = await targetImageRepository.updateGroupSize(created.id as number, 0.75);

      expect(updated?.groupSize).toBe(0.75);
      expect((await targetImageRepository.getById(created.id as number))?.groupSize).toBe(0.75);
    });
  });

  describe('getWithGroupSize', () => {
    it('returns only images that have a group size recorded', async () => {
      const measured = await targetImageRepository.create(validTargetImage({ dopeLogId }));
      await targetImageRepository.create(validTargetImage({ dopeLogId }));
      await targetImageRepository.updateGroupSize(measured.id as number, 1.25);

      const results = await targetImageRepository.getWithGroupSize();
      expect(results.map((t) => t.id)).toEqual([measured.id]);
    });
  });

  describe('getAverageGroupSizeByDopeLog', () => {
    it('averages the recorded group sizes for a log', async () => {
      const first = await targetImageRepository.create(validTargetImage({ dopeLogId }));
      const second = await targetImageRepository.create(validTargetImage({ dopeLogId }));
      await targetImageRepository.updateGroupSize(first.id as number, 0.5);
      await targetImageRepository.updateGroupSize(second.id as number, 1.5);

      expect(await targetImageRepository.getAverageGroupSizeByDopeLog(dopeLogId)).toBeCloseTo(
        1.0,
        5
      );
    });

    it('returns null when no image for the log has a group size', async () => {
      await targetImageRepository.create(validTargetImage({ dopeLogId }));

      expect(await targetImageRepository.getAverageGroupSizeByDopeLog(dopeLogId)).toBeNull();
    });
  });

  describe('getByTargetType', () => {
    it('filters by target type', async () => {
      await targetImageRepository.create(validTargetImage({ dopeLogId, targetType: 'paper' }));
      await targetImageRepository.create(validTargetImage({ dopeLogId, targetType: 'steel' }));

      const steel = await targetImageRepository.getByTargetType('steel');
      expect(steel.map((t) => t.targetType)).toEqual(['steel']);
    });
  });

  describe('deleteByDopeLogId / deleteByRangeSessionId', () => {
    it('deletes every image for a DOPE log and reports the count', async () => {
      await targetImageRepository.create(validTargetImage({ dopeLogId }));
      await targetImageRepository.create(validTargetImage({ dopeLogId }));
      await targetImageRepository.create(validTargetImage({ rangeSessionId }));

      expect(await targetImageRepository.deleteByDopeLogId(dopeLogId)).toBe(2);
      expect(await targetImageRepository.count()).toBe(1);
    });

    it('deletes every image for a range session and reports the count', async () => {
      await targetImageRepository.create(validTargetImage({ rangeSessionId }));

      expect(await targetImageRepository.deleteByRangeSessionId(rangeSessionId)).toBe(1);
      expect(await targetImageRepository.count()).toBe(0);
    });
  });

  describe('update', () => {
    it('changes only the supplied fields and persists them', async () => {
      const created = await targetImageRepository.create(
        validTargetImage({ dopeLogId, targetType: 'paper' })
      );

      const updated = await targetImageRepository.update(created.id as number, {
        imageUri: 'file:///targets/updated.jpg',
      });

      expect(updated?.imageUri).toBe('file:///targets/updated.jpg');
      expect(updated?.targetType).toBe('paper');
    });

    it('returns null when the id does not exist', async () => {
      expect(await targetImageRepository.update(4242, { targetType: 'steel' })).toBeNull();
    });
  });

  describe('delete / count / countByDopeLog', () => {
    it('removes an image and keeps the counts consistent', async () => {
      const created = await targetImageRepository.create(validTargetImage({ dopeLogId }));
      await targetImageRepository.create(validTargetImage({ dopeLogId }));

      expect(await targetImageRepository.countByDopeLog(dopeLogId)).toBe(2);
      expect(await targetImageRepository.delete(created.id as number)).toBe(true);
      expect(await targetImageRepository.countByDopeLog(dopeLogId)).toBe(1);
      expect(await targetImageRepository.count()).toBe(1);
    });

    it('reports failure when deleting an id that does not exist', async () => {
      expect(await targetImageRepository.delete(4242)).toBe(false);
    });
  });

  describe('getAll', () => {
    it('returns an empty array when there are no images', async () => {
      expect(await targetImageRepository.getAll()).toEqual([]);
    });
  });
});
