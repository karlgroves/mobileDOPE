import ammoProfileRepository from '../../../src/services/database/AmmoProfileRepository';
import dopeLogRepository from '../../../src/services/database/DOPELogRepository';
import environmentRepository from '../../../src/services/database/EnvironmentRepository';
import rifleProfileRepository from '../../../src/services/database/RifleProfileRepository';
import { validAmmo, validDopeLog, validEnvironment, validRifle } from '../../helpers/fixtures';
import { installTestDatabase, uninstallTestDatabase } from '../../helpers/testDatabase';

import type { TestDatabase } from '../../helpers/testDatabase';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../../helpers/testDatabase').openDatabaseAsync(),
}));

describe('DOPELogRepository', () => {
  let db: TestDatabase;
  let rifleId: number;
  let ammoId: number;
  let environmentId: number;

  /** DOPE logs are FK-constrained, so every test needs real parent rows. */
  beforeEach(async () => {
    db = await installTestDatabase();
    rifleId = (await rifleProfileRepository.create(validRifle())).id as number;
    ammoId = (await ammoProfileRepository.create(validAmmo())).id as number;
    environmentId = (await environmentRepository.create(validEnvironment())).id as number;
  });

  afterEach(async () => {
    await uninstallTestDatabase();
  });

  const ids = () => ({ rifleId, ammoId, environmentId });

  describe('create', () => {
    it('persists the log and returns the assigned id', async () => {
      const created = await dopeLogRepository.create(validDopeLog(ids()));

      expect(created.id).toBeGreaterThan(0);
      expect(await dopeLogRepository.count()).toBe(1);
    });

    it('round-trips the correction values', async () => {
      const created = await dopeLogRepository.create(
        validDopeLog(ids(), {
          distance: 800,
          elevationCorrection: 6.7,
          windageCorrection: -1.2,
          correctionUnit: 'MIL',
        })
      );

      const fetched = await dopeLogRepository.getById(created.id as number);
      expect(fetched).toMatchObject({
        distance: 800,
        elevationCorrection: 6.7,
        windageCorrection: -1.2,
        correctionUnit: 'MIL',
      });
    });

    it('rejects a distance unit outside yards/meters (schema CHECK constraint)', async () => {
      await expect(
        dopeLogRepository.create(
          validDopeLog(ids(), { distanceUnit: 'furlongs' as unknown as 'yards' })
        )
      ).rejects.toThrow();
    });

    it('rejects a correction unit outside MIL/MOA (schema CHECK constraint)', async () => {
      await expect(
        dopeLogRepository.create(
          validDopeLog(ids(), { correctionUnit: 'GRADIANS' as unknown as 'MIL' })
        )
      ).rejects.toThrow();
    });

    it('rejects a log referencing a rifle that does not exist (foreign key)', async () => {
      await expect(
        dopeLogRepository.create(validDopeLog({ ...ids(), rifleId: 9999 }))
      ).rejects.toThrow();
    });

    it('rejects a log referencing an environment that does not exist (foreign key)', async () => {
      await expect(
        dopeLogRepository.create(validDopeLog({ ...ids(), environmentId: 9999 }))
      ).rejects.toThrow();
    });
  });

  describe('timestamp handling', () => {
    it('preserves a caller-supplied engagement time', async () => {
      const engaged = '2026-05-20T13:45:00.000Z';

      const created = await dopeLogRepository.create(validDopeLog(ids(), { timestamp: engaged }));

      const row = await db.getFirstAsync<{ timestamp: string }>(
        'SELECT timestamp FROM dope_logs WHERE id = ?',
        [created.id]
      );
      expect(row?.timestamp).toBe(engaged);
      expect((await dopeLogRepository.getById(created.id as number))?.timestamp).toBe(engaged);
    });

    it('falls back to the schema default when no timestamp is given', async () => {
      const created = await dopeLogRepository.create(validDopeLog(ids()));

      const row = await db.getFirstAsync<{ timestamp: string | null }>(
        'SELECT timestamp FROM dope_logs WHERE id = ?',
        [created.id]
      );
      expect(row?.timestamp).toEqual(expect.any(String));
      expect(Number.isNaN(Date.parse(row?.timestamp as string))).toBe(false);
    });

    it('orders history by the supplied timestamps, newest first', async () => {
      await dopeLogRepository.create(
        validDopeLog(ids(), { distance: 100, timestamp: '2026-01-01T00:00:00.000Z' })
      );
      await dopeLogRepository.create(
        validDopeLog(ids(), { distance: 900, timestamp: '2026-06-01T00:00:00.000Z' })
      );
      await dopeLogRepository.create(
        validDopeLog(ids(), { distance: 500, timestamp: '2026-03-01T00:00:00.000Z' })
      );

      expect((await dopeLogRepository.getAll()).map((l) => l.distance)).toEqual([900, 500, 100]);
    });
  });

  describe('foreign key cascade', () => {
    it('deletes a rifle’s logs when the rifle is deleted (ON DELETE CASCADE)', async () => {
      await dopeLogRepository.create(validDopeLog(ids()));
      expect(await dopeLogRepository.count()).toBe(1);

      await rifleProfileRepository.delete(rifleId);

      expect(await dopeLogRepository.count()).toBe(0);
    });

    it('deletes an ammo profile’s logs when the ammo is deleted (ON DELETE CASCADE)', async () => {
      await dopeLogRepository.create(validDopeLog(ids()));

      await ammoProfileRepository.delete(ammoId);

      expect(await dopeLogRepository.count()).toBe(0);
    });
  });

  describe('getByRifleId / getByAmmoId', () => {
    it('returns only the logs for the given rifle', async () => {
      const otherRifleId = (await rifleProfileRepository.create(validRifle({ name: 'Other' })))
        .id as number;

      await dopeLogRepository.create(validDopeLog(ids(), { distance: 300 }));
      await dopeLogRepository.create(
        validDopeLog({ ...ids(), rifleId: otherRifleId }, { distance: 400 })
      );

      const mine = await dopeLogRepository.getByRifleId(rifleId);
      expect(mine.map((l) => l.distance)).toEqual([300]);
    });

    it('returns only the logs for the given ammo', async () => {
      const otherAmmoId = (await ammoProfileRepository.create(validAmmo({ name: 'Other' })))
        .id as number;

      await dopeLogRepository.create(validDopeLog(ids(), { distance: 300 }));
      await dopeLogRepository.create(
        validDopeLog({ ...ids(), ammoId: otherAmmoId }, { distance: 400 })
      );

      const mine = await dopeLogRepository.getByAmmoId(ammoId);
      expect(mine.map((l) => l.distance)).toEqual([300]);
    });

    it('returns an empty array when the rifle has no logs', async () => {
      expect(await dopeLogRepository.getByRifleId(rifleId)).toEqual([]);
    });
  });

  describe('getAll', () => {
    it('applies the limit when one is given', async () => {
      for (const distance of [100, 200, 300, 400]) {
        await dopeLogRepository.create(validDopeLog(ids(), { distance }));
      }

      expect(await dopeLogRepository.getAll()).toHaveLength(4);
      expect(await dopeLogRepository.getAll(2)).toHaveLength(2);
    });
  });

  describe('getByRifleAndAmmo', () => {
    it('requires both ids to match', async () => {
      const otherAmmoId = (await ammoProfileRepository.create(validAmmo({ name: 'Other' })))
        .id as number;

      await dopeLogRepository.create(validDopeLog(ids(), { distance: 500 }));
      await dopeLogRepository.create(
        validDopeLog({ ...ids(), ammoId: otherAmmoId }, { distance: 600 })
      );

      const results = await dopeLogRepository.getByRifleAndAmmo(rifleId, ammoId);
      expect(results.map((l) => l.distance)).toEqual([500]);
    });
  });

  describe('getByDistanceRange', () => {
    beforeEach(async () => {
      for (const distance of [100, 300, 500, 700]) {
        await dopeLogRepository.create(validDopeLog(ids(), { distance }));
      }
    });

    it('is inclusive of both bounds and ordered by distance ascending', async () => {
      const results = await dopeLogRepository.getByDistanceRange(rifleId, ammoId, 300, 700);
      expect(results.map((l) => l.distance)).toEqual([300, 500, 700]);
    });

    it('returns an empty array when no log falls in the range', async () => {
      expect(await dopeLogRepository.getByDistanceRange(rifleId, ammoId, 800, 900)).toEqual([]);
    });
  });

  describe('update', () => {
    it('changes only the supplied fields and persists them', async () => {
      const created = await dopeLogRepository.create(validDopeLog(ids(), { notes: 'first group' }));

      const updated = await dopeLogRepository.update(created.id as number, {
        elevationCorrection: 4.1,
      });

      expect(updated?.elevationCorrection).toBe(4.1);
      expect(updated?.notes).toBe('first group');

      const reloaded = await dopeLogRepository.getById(created.id as number);
      expect(reloaded?.elevationCorrection).toBe(4.1);
    });

    it('returns null when the id does not exist', async () => {
      expect(await dopeLogRepository.update(4242, { elevationCorrection: 1 })).toBeNull();
    });
  });

  describe('delete', () => {
    it('removes the log and reports success', async () => {
      const created = await dopeLogRepository.create(validDopeLog(ids()));

      expect(await dopeLogRepository.delete(created.id as number)).toBe(true);
      expect(await dopeLogRepository.getById(created.id as number)).toBeNull();
    });

    it('reports failure when the id does not exist', async () => {
      expect(await dopeLogRepository.delete(4242)).toBe(false);
    });
  });

  describe('count', () => {
    it('filters by rifle and by ammo independently', async () => {
      const otherRifleId = (await rifleProfileRepository.create(validRifle({ name: 'Other' })))
        .id as number;

      await dopeLogRepository.create(validDopeLog(ids()));
      await dopeLogRepository.create(validDopeLog(ids()));
      await dopeLogRepository.create(validDopeLog({ ...ids(), rifleId: otherRifleId }));

      expect(await dopeLogRepository.count()).toBe(3);
      expect(await dopeLogRepository.count(rifleId)).toBe(2);
      expect(await dopeLogRepository.count(otherRifleId)).toBe(1);
      expect(await dopeLogRepository.count(rifleId, ammoId)).toBe(2);
    });
  });

  describe('getDOPECurve', () => {
    it('averages corrections per distance and counts the samples', async () => {
      await dopeLogRepository.create(
        validDopeLog(ids(), { distance: 500, elevationCorrection: 3.0, windageCorrection: 0.4 })
      );
      await dopeLogRepository.create(
        validDopeLog(ids(), { distance: 500, elevationCorrection: 3.4, windageCorrection: 0.6 })
      );
      await dopeLogRepository.create(
        validDopeLog(ids(), { distance: 300, elevationCorrection: 1.5, windageCorrection: 0.2 })
      );

      const curve = await dopeLogRepository.getDOPECurve(rifleId, ammoId);

      // Ordered by distance ascending, one entry per distinct distance.
      expect(curve.map((p) => p.distance)).toEqual([300, 500]);

      const at500 = curve.find((p) => p.distance === 500);
      expect(at500?.count).toBe(2);
      expect(at500?.avgElevation).toBeCloseTo(3.2, 5);
      expect(at500?.avgWindage).toBeCloseTo(0.5, 5);
    });

    it('returns an empty curve when the pairing has no logs', async () => {
      expect(await dopeLogRepository.getDOPECurve(rifleId, ammoId)).toEqual([]);
    });
  });

  it('keeps rows isolated between tests', async () => {
    expect(await dopeLogRepository.count()).toBe(0);
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM dope_logs'
    );
    expect(row?.count).toBe(0);
  });
});
