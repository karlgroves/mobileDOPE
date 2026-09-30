import ammoProfileRepository from '../../../src/services/database/AmmoProfileRepository';
import environmentRepository from '../../../src/services/database/EnvironmentRepository';
import rangeSessionRepository from '../../../src/services/database/RangeSessionRepository';
import rifleProfileRepository from '../../../src/services/database/RifleProfileRepository';
import { validAmmo, validEnvironment, validRangeSession, validRifle } from '../../helpers/fixtures';
import { installTestDatabase, uninstallTestDatabase } from '../../helpers/testDatabase';

import type { TestDatabase } from '../../helpers/testDatabase';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../../helpers/testDatabase').openDatabaseAsync(),
}));

describe('RangeSessionRepository', () => {
  let db: TestDatabase;
  let rifleId: number;
  let ammoId: number;
  let environmentId: number;

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
    it('persists the session and returns the assigned id', async () => {
      const created = await rangeSessionRepository.create(validRangeSession(ids()));

      expect(created.id).toBeGreaterThan(0);
      expect(await rangeSessionRepository.count()).toBe(1);
    });

    it('stores coldBoreShot as an integer 0/1 and reads it back as a boolean', async () => {
      const cold = await rangeSessionRepository.create(
        validRangeSession(ids(), { coldBoreShot: true })
      );
      const warm = await rangeSessionRepository.create(
        validRangeSession(ids(), { coldBoreShot: false })
      );

      const rows = await db.getAllAsync<{ id: number; cold_bore_shot: number }>(
        'SELECT id, cold_bore_shot FROM range_sessions ORDER BY id'
      );
      expect(rows.map((r) => r.cold_bore_shot)).toEqual([1, 0]);

      expect((await rangeSessionRepository.getById(cold.id as number))?.coldBoreShot).toBe(true);
      expect((await rangeSessionRepository.getById(warm.id as number))?.coldBoreShot).toBe(false);
    });

    it('leaves a new session open (no end time)', async () => {
      const created = await rangeSessionRepository.create(validRangeSession(ids()));

      const row = await db.getFirstAsync<{ end_time: string | null }>(
        'SELECT end_time FROM range_sessions WHERE id = ?',
        [created.id]
      );
      expect(row?.end_time).toBeNull();
    });

    it('rejects a session referencing a rifle that does not exist (foreign key)', async () => {
      await expect(
        rangeSessionRepository.create(validRangeSession({ ...ids(), rifleId: 9999 }))
      ).rejects.toThrow();
    });
  });

  describe('foreign key cascade', () => {
    it('deletes a rifle’s sessions when the rifle is deleted', async () => {
      await rangeSessionRepository.create(validRangeSession(ids()));

      await rifleProfileRepository.delete(rifleId);

      expect(await rangeSessionRepository.count()).toBe(0);
    });
  });

  describe('getActive', () => {
    it('returns only sessions with no end time', async () => {
      const open = await rangeSessionRepository.create(
        validRangeSession(ids(), { sessionName: 'open' })
      );
      const closed = await rangeSessionRepository.create(
        validRangeSession(ids(), { sessionName: 'closed' })
      );
      await rangeSessionRepository.endSession(closed.id as number);

      const active = await rangeSessionRepository.getActive();
      expect(active.map((s) => s.id)).toEqual([open.id]);
    });

    it('returns an empty array when every session has ended', async () => {
      const created = await rangeSessionRepository.create(validRangeSession(ids()));
      await rangeSessionRepository.endSession(created.id as number);

      expect(await rangeSessionRepository.getActive()).toEqual([]);
    });
  });

  describe('endSession', () => {
    it('records the supplied end time', async () => {
      const created = await rangeSessionRepository.create(validRangeSession(ids()));

      const ended = await rangeSessionRepository.endSession(
        created.id as number,
        '2026-08-01T17:30:00.000Z'
      );

      expect(ended?.endTime).toBe('2026-08-01T17:30:00.000Z');
    });

    it('defaults to now when no end time is given', async () => {
      const created = await rangeSessionRepository.create(validRangeSession(ids()));

      const ended = await rangeSessionRepository.endSession(created.id as number);

      expect(ended?.endTime).toEqual(expect.any(String));
      expect(Number.isNaN(Date.parse(ended?.endTime as string))).toBe(false);
    });

    it('returns null when the id does not exist', async () => {
      expect(await rangeSessionRepository.endSession(4242)).toBeNull();
    });
  });

  describe('incrementShotCount', () => {
    it('increases the count by one each call and persists it', async () => {
      const created = await rangeSessionRepository.create(
        validRangeSession(ids(), { shotCount: 0 })
      );

      expect(
        (await rangeSessionRepository.incrementShotCount(created.id as number))?.shotCount
      ).toBe(1);
      expect(
        (await rangeSessionRepository.incrementShotCount(created.id as number))?.shotCount
      ).toBe(2);
      expect((await rangeSessionRepository.getById(created.id as number))?.shotCount).toBe(2);
    });

    it('returns null when the id does not exist', async () => {
      expect(await rangeSessionRepository.incrementShotCount(4242)).toBeNull();
    });
  });

  describe('getByRifleId / getByAmmoId', () => {
    it('filters by rifle and orders newest first', async () => {
      const otherRifleId = (await rifleProfileRepository.create(validRifle({ name: 'Other' })))
        .id as number;

      await rangeSessionRepository.create(
        validRangeSession(ids(), { startTime: '2026-08-01T09:00:00.000Z', distance: 300 })
      );
      await rangeSessionRepository.create(
        validRangeSession(ids(), { startTime: '2026-08-02T09:00:00.000Z', distance: 600 })
      );
      await rangeSessionRepository.create(
        validRangeSession({ ...ids(), rifleId: otherRifleId }, { distance: 900 })
      );

      const mine = await rangeSessionRepository.getByRifleId(rifleId);
      expect(mine.map((s) => s.distance)).toEqual([600, 300]);
    });

    it('filters by ammo', async () => {
      const otherAmmoId = (await ammoProfileRepository.create(validAmmo({ name: 'Other' })))
        .id as number;

      await rangeSessionRepository.create(validRangeSession(ids(), { distance: 300 }));
      await rangeSessionRepository.create(
        validRangeSession({ ...ids(), ammoId: otherAmmoId }, { distance: 900 })
      );

      expect((await rangeSessionRepository.getByAmmoId(ammoId)).map((s) => s.distance)).toEqual([
        300,
      ]);
    });
  });

  describe('getByDateRange', () => {
    it('returns only sessions starting within the range', async () => {
      await rangeSessionRepository.create(
        validRangeSession(ids(), { startTime: '2026-07-01T09:00:00.000Z', distance: 100 })
      );
      await rangeSessionRepository.create(
        validRangeSession(ids(), { startTime: '2026-08-15T09:00:00.000Z', distance: 500 })
      );

      const results = await rangeSessionRepository.getByDateRange(
        '2026-08-01T00:00:00.000Z',
        '2026-08-31T23:59:59.000Z'
      );
      expect(results.map((s) => s.distance)).toEqual([500]);
    });
  });

  describe('getColdBoreSessions', () => {
    it('returns only cold-bore sessions', async () => {
      await rangeSessionRepository.create(
        validRangeSession(ids(), { coldBoreShot: true, distance: 100 })
      );
      await rangeSessionRepository.create(
        validRangeSession(ids(), { coldBoreShot: false, distance: 500 })
      );

      const results = await rangeSessionRepository.getColdBoreSessions();
      expect(results.map((s) => s.distance)).toEqual([100]);
    });
  });

  describe('search', () => {
    it('matches on session name', async () => {
      await rangeSessionRepository.create(
        validRangeSession(ids(), { sessionName: 'Prone practice' })
      );
      await rangeSessionRepository.create(validRangeSession(ids(), { sessionName: 'Load dev' }));

      const results = await rangeSessionRepository.search('Prone');
      expect(results.map((s) => s.sessionName)).toEqual(['Prone practice']);
    });

    it('returns an empty array when nothing matches', async () => {
      await rangeSessionRepository.create(validRangeSession(ids(), { sessionName: 'Load dev' }));

      expect(await rangeSessionRepository.search('Nothing')).toEqual([]);
    });
  });

  describe('count / countByRifle / getTotalShotCountByRifle', () => {
    it('counts sessions globally and per rifle', async () => {
      const otherRifleId = (await rifleProfileRepository.create(validRifle({ name: 'Other' })))
        .id as number;

      await rangeSessionRepository.create(validRangeSession(ids(), { shotCount: 10 }));
      await rangeSessionRepository.create(validRangeSession(ids(), { shotCount: 15 }));
      await rangeSessionRepository.create(
        validRangeSession({ ...ids(), rifleId: otherRifleId }, { shotCount: 7 })
      );

      expect(await rangeSessionRepository.count()).toBe(3);
      expect(await rangeSessionRepository.countByRifle(rifleId)).toBe(2);
      expect(await rangeSessionRepository.getTotalShotCountByRifle(rifleId)).toBe(25);
    });

    it('reports a zero total for a rifle with no sessions', async () => {
      expect(await rangeSessionRepository.getTotalShotCountByRifle(rifleId)).toBe(0);
    });
  });

  describe('update', () => {
    it('changes only the supplied fields and persists them', async () => {
      const created = await rangeSessionRepository.create(
        validRangeSession(ids(), { notes: 'keep me', distance: 500 })
      );

      const updated = await rangeSessionRepository.update(created.id as number, { distance: 800 });

      expect(updated?.distance).toBe(800);
      expect(updated?.notes).toBe('keep me');
      expect((await rangeSessionRepository.getById(created.id as number))?.distance).toBe(800);
    });

    it('returns null when the id does not exist', async () => {
      expect(await rangeSessionRepository.update(4242, { distance: 1 })).toBeNull();
    });
  });

  describe('delete', () => {
    it('removes the session and reports success', async () => {
      const created = await rangeSessionRepository.create(validRangeSession(ids()));

      expect(await rangeSessionRepository.delete(created.id as number)).toBe(true);
      expect(await rangeSessionRepository.getById(created.id as number)).toBeNull();
    });

    it('reports failure when the id does not exist', async () => {
      expect(await rangeSessionRepository.delete(4242)).toBe(false);
    });
  });

  describe('getAll', () => {
    it('returns an empty array when there are no sessions', async () => {
      expect(await rangeSessionRepository.getAll()).toEqual([]);
    });
  });
});
