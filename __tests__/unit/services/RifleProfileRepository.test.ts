import rifleProfileRepository from '../../../src/services/database/RifleProfileRepository';
import { validRifle } from '../../helpers/fixtures';
import { installTestDatabase, uninstallTestDatabase } from '../../helpers/testDatabase';

import type { TestDatabase } from '../../helpers/testDatabase';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../../helpers/testDatabase').openDatabaseAsync(),
}));

describe('RifleProfileRepository', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await installTestDatabase();
  });

  afterEach(async () => {
    await uninstallTestDatabase();
  });

  describe('create', () => {
    it('persists the row and returns the assigned id', async () => {
      const created = await rifleProfileRepository.create(validRifle());

      expect(created.id).toBeGreaterThan(0);

      const row = await db.getFirstAsync<{ name: string; caliber: string }>(
        'SELECT name, caliber FROM rifle_profiles WHERE id = ?',
        [created.id]
      );
      expect(row).toEqual({ name: 'Tikka T3x', caliber: '.308 Win' });
    });

    it('round-trips every field through the database', async () => {
      const data = validRifle({ notes: 'Match rifle' });
      const created = await rifleProfileRepository.create(data);

      const fetched = await rifleProfileRepository.getById(created.id as number);

      expect(fetched).not.toBeNull();
      expect(fetched).toMatchObject({
        name: data.name,
        caliber: data.caliber,
        barrelLength: data.barrelLength,
        twistRate: data.twistRate,
        zeroDistance: data.zeroDistance,
        opticManufacturer: data.opticManufacturer,
        opticModel: data.opticModel,
        reticleType: data.reticleType,
        clickValueType: data.clickValueType,
        clickValue: data.clickValue,
        scopeHeight: data.scopeHeight,
        notes: 'Match rifle',
      });
    });

    it('stores omitted notes as NULL rather than the string "undefined"', async () => {
      const created = await rifleProfileRepository.create(validRifle());

      const row = await db.getFirstAsync<{ notes: string | null }>(
        'SELECT notes FROM rifle_profiles WHERE id = ?',
        [created.id]
      );
      expect(row?.notes).toBeNull();
    });

    it('assigns distinct ids to successive rifles', async () => {
      const first = await rifleProfileRepository.create(validRifle({ name: 'A' }));
      const second = await rifleProfileRepository.create(validRifle({ name: 'B' }));

      expect(second.id).not.toBe(first.id);
      expect(await rifleProfileRepository.count()).toBe(2);
    });

    it('rejects a click value type outside MIL/MOA (schema CHECK constraint)', async () => {
      await expect(
        rifleProfileRepository.create(
          validRifle({ clickValueType: 'GRADIANS' as unknown as 'MIL' })
        )
      ).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('returns null for an id that does not exist', async () => {
      expect(await rifleProfileRepository.getById(4242)).toBeNull();
    });
  });

  describe('getAll', () => {
    it('returns an empty array when there are no rifles', async () => {
      expect(await rifleProfileRepository.getAll()).toEqual([]);
    });

    it('orders results by name ascending', async () => {
      await rifleProfileRepository.create(validRifle({ name: 'Zephyr' }));
      await rifleProfileRepository.create(validRifle({ name: 'Alpha' }));
      await rifleProfileRepository.create(validRifle({ name: 'Mike' }));

      const names = (await rifleProfileRepository.getAll()).map((r) => r.name);
      expect(names).toEqual(['Alpha', 'Mike', 'Zephyr']);
    });
  });

  describe('update', () => {
    it('changes only the supplied fields', async () => {
      const created = await rifleProfileRepository.create(validRifle({ notes: 'original' }));

      const updated = await rifleProfileRepository.update(created.id as number, {
        zeroDistance: 200,
      });

      expect(updated?.zeroDistance).toBe(200);
      expect(updated?.name).toBe('Tikka T3x');
      expect(updated?.notes).toBe('original');
    });

    it('persists the change rather than only mutating the returned object', async () => {
      const created = await rifleProfileRepository.create(validRifle());

      await rifleProfileRepository.update(created.id as number, { barrelLength: 26 });

      const reloaded = await rifleProfileRepository.getById(created.id as number);
      expect(reloaded?.barrelLength).toBe(26);
    });

    it('returns null when the id does not exist', async () => {
      expect(await rifleProfileRepository.update(4242, { zeroDistance: 300 })).toBeNull();
    });
  });

  describe('delete', () => {
    it('removes the row and reports success', async () => {
      const created = await rifleProfileRepository.create(validRifle());

      expect(await rifleProfileRepository.delete(created.id as number)).toBe(true);
      expect(await rifleProfileRepository.getById(created.id as number)).toBeNull();
      expect(await rifleProfileRepository.count()).toBe(0);
    });

    it('reports failure when the id does not exist', async () => {
      expect(await rifleProfileRepository.delete(4242)).toBe(false);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await rifleProfileRepository.create(validRifle({ name: 'Tikka T3x', caliber: '.308 Win' }));
      await rifleProfileRepository.create(
        validRifle({ name: 'Bergara HMR', caliber: '6.5 Creedmoor' })
      );
    });

    it('matches on a partial name', async () => {
      const results = await rifleProfileRepository.search('Tikka');
      expect(results.map((r) => r.name)).toEqual(['Tikka T3x']);
    });

    it('matches on a partial caliber', async () => {
      const results = await rifleProfileRepository.search('Creedmoor');
      expect(results.map((r) => r.name)).toEqual(['Bergara HMR']);
    });

    it('returns an empty array when nothing matches', async () => {
      expect(await rifleProfileRepository.search('Remington')).toEqual([]);
    });
  });

  describe('count', () => {
    it('returns 0 for an empty table', async () => {
      expect(await rifleProfileRepository.count()).toBe(0);
    });
  });
});
