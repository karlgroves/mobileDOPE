import ammoProfileRepository from '../../../src/services/database/AmmoProfileRepository';
import shotStringRepository from '../../../src/services/database/ShotStringRepository';
import { validAmmo, validShotString } from '../../helpers/fixtures';
import { installTestDatabase, uninstallTestDatabase } from '../../helpers/testDatabase';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../../helpers/testDatabase').openDatabaseAsync(),
}));

describe('ShotStringRepository', () => {
  let ammoId: number;

  beforeEach(async () => {
    await installTestDatabase();
    ammoId = (await ammoProfileRepository.create(validAmmo())).id as number;
  });

  afterEach(async () => {
    await uninstallTestDatabase();
  });

  /** Records a full string of shots for one session date. */
  const recordString = async (sessionDate: string, velocities: number[]): Promise<void> => {
    for (const [index, velocity] of velocities.entries()) {
      await shotStringRepository.create(
        validShotString(ammoId, { sessionDate, shotNumber: index + 1, velocity })
      );
    }
  };

  describe('create', () => {
    it('persists the shot and returns the assigned id', async () => {
      const created = await shotStringRepository.create(validShotString(ammoId));

      expect(created.id).toBeGreaterThan(0);
      expect(await shotStringRepository.count()).toBe(1);
    });

    it('rejects a shot referencing an ammo profile that does not exist (foreign key)', async () => {
      await expect(shotStringRepository.create(validShotString(9999))).rejects.toThrow();
    });
  });

  describe('foreign key cascade', () => {
    it('deletes an ammo profile’s shots when the ammo is deleted', async () => {
      await recordString('2026-08-01', [2600, 2610]);

      await ammoProfileRepository.delete(ammoId);

      expect(await shotStringRepository.count()).toBe(0);
    });
  });

  describe('getByAmmoId', () => {
    it('orders by session date descending then shot number ascending', async () => {
      await recordString('2026-07-01', [2500, 2510]);
      await recordString('2026-08-01', [2600, 2610]);

      const shots = await shotStringRepository.getByAmmoId(ammoId);
      expect(shots.map((s) => `${s.sessionDate}#${s.shotNumber}`)).toEqual([
        '2026-08-01#1',
        '2026-08-01#2',
        '2026-07-01#1',
        '2026-07-01#2',
      ]);
    });

    it('returns an empty array when the ammo has no shots', async () => {
      expect(await shotStringRepository.getByAmmoId(ammoId)).toEqual([]);
    });
  });

  describe('getBySession', () => {
    it('returns only that session’s shots, in shot order', async () => {
      await recordString('2026-07-01', [2500]);
      await recordString('2026-08-01', [2600, 2610, 2620]);

      const shots = await shotStringRepository.getBySession(ammoId, '2026-08-01');
      expect(shots.map((s) => s.velocity)).toEqual([2600, 2610, 2620]);
    });
  });

  describe('getSessionStatistics', () => {
    it('computes count, average, extreme spread and standard deviation', async () => {
      // mean 2600; ES = 2620-2580 = 40; population SD of [2580,2600,2620] = 16.33
      await recordString('2026-08-01', [2580, 2600, 2620]);

      const stats = await shotStringRepository.getSessionStatistics(ammoId, '2026-08-01');

      expect(stats).toEqual({
        count: 3,
        averageVelocity: 2600,
        extremeSpread: 40,
        standardDeviation: 16.3,
        minVelocity: 2580,
        maxVelocity: 2620,
      });
    });

    it('reports zero spread and deviation for a single shot', async () => {
      await recordString('2026-08-01', [2600]);

      expect(await shotStringRepository.getSessionStatistics(ammoId, '2026-08-01')).toMatchObject({
        count: 1,
        averageVelocity: 2600,
        extremeSpread: 0,
        standardDeviation: 0,
      });
    });

    it('returns null for a session with no shots', async () => {
      expect(await shotStringRepository.getSessionStatistics(ammoId, '2026-01-01')).toBeNull();
    });
  });

  describe('getSessionDates', () => {
    it('returns distinct dates, newest first', async () => {
      await recordString('2026-07-01', [2500, 2510]);
      await recordString('2026-08-01', [2600]);

      expect(await shotStringRepository.getSessionDates(ammoId)).toEqual([
        '2026-08-01',
        '2026-07-01',
      ]);
    });

    it('returns an empty array when the ammo has no sessions', async () => {
      expect(await shotStringRepository.getSessionDates(ammoId)).toEqual([]);
    });
  });

  describe('getNextShotNumber', () => {
    it('starts at 1 for an empty session', async () => {
      expect(await shotStringRepository.getNextShotNumber(ammoId, '2026-08-01')).toBe(1);
    });

    it('continues from the highest shot number in that session', async () => {
      await recordString('2026-08-01', [2600, 2610, 2620]);

      expect(await shotStringRepository.getNextShotNumber(ammoId, '2026-08-01')).toBe(4);
    });

    it('numbers each session independently', async () => {
      await recordString('2026-07-01', [2500, 2510]);

      expect(await shotStringRepository.getNextShotNumber(ammoId, '2026-08-01')).toBe(1);
    });
  });

  describe('update', () => {
    it('changes only the supplied fields and persists them', async () => {
      const created = await shotStringRepository.create(
        validShotString(ammoId, { notes: 'chrono warm-up' })
      );

      const updated = await shotStringRepository.update(created.id as number, { velocity: 2650 });

      expect(updated?.velocity).toBe(2650);
      expect(updated?.notes).toBe('chrono warm-up');
      expect((await shotStringRepository.getById(created.id as number))?.velocity).toBe(2650);
    });

    it('returns null when the id does not exist', async () => {
      expect(await shotStringRepository.update(4242, { velocity: 1 })).toBeNull();
    });
  });

  describe('delete', () => {
    it('removes the shot and reports success', async () => {
      const created = await shotStringRepository.create(validShotString(ammoId));

      expect(await shotStringRepository.delete(created.id as number)).toBe(true);
      expect(await shotStringRepository.getById(created.id as number)).toBeNull();
    });

    it('reports failure when the id does not exist', async () => {
      expect(await shotStringRepository.delete(4242)).toBe(false);
    });
  });

  describe('deleteBySession', () => {
    it('deletes only that session’s shots and reports the count', async () => {
      await recordString('2026-07-01', [2500, 2510]);
      await recordString('2026-08-01', [2600, 2610, 2620]);

      expect(await shotStringRepository.deleteBySession(ammoId, '2026-08-01')).toBe(3);
      expect(await shotStringRepository.countByAmmo(ammoId)).toBe(2);
    });
  });

  describe('count / countByAmmo', () => {
    it('counts globally and per ammo profile', async () => {
      const otherAmmoId = (await ammoProfileRepository.create(validAmmo({ name: 'Other' })))
        .id as number;

      await recordString('2026-08-01', [2600, 2610]);
      await shotStringRepository.create(validShotString(otherAmmoId));

      expect(await shotStringRepository.count()).toBe(3);
      expect(await shotStringRepository.countByAmmo(ammoId)).toBe(2);
      expect(await shotStringRepository.countByAmmo(otherAmmoId)).toBe(1);
    });
  });

  describe('getAll', () => {
    it('returns every shot across ammo profiles', async () => {
      await recordString('2026-08-01', [2600, 2610]);
      expect(await shotStringRepository.getAll()).toHaveLength(2);
    });
  });
});
