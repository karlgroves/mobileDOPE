import ammoProfileRepository from '../../../src/services/database/AmmoProfileRepository';
import { validAmmo } from '../../helpers/fixtures';
import { installTestDatabase, uninstallTestDatabase } from '../../helpers/testDatabase';

import type { TestDatabase } from '../../helpers/testDatabase';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../../helpers/testDatabase').openDatabaseAsync(),
}));

describe('AmmoProfileRepository', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await installTestDatabase();
  });

  afterEach(async () => {
    await uninstallTestDatabase();
  });

  describe('create', () => {
    it('persists the row and returns the assigned id', async () => {
      const created = await ammoProfileRepository.create(validAmmo());

      expect(created.id).toBeGreaterThan(0);

      const row = await db.getFirstAsync<{ name: string; caliber: string }>(
        'SELECT name, caliber FROM ammo_profiles WHERE id = ?',
        [created.id]
      );
      expect(row).toEqual({ name: '175gr SMK', caliber: '.308 Win' });
    });

    it('round-trips the ballistic fields without precision loss', async () => {
      const data = validAmmo({
        ballisticCoefficientG1: 0.505,
        ballisticCoefficientG7: 0.258,
        muzzleVelocity: 2637,
        bulletWeight: 175,
      });
      const created = await ammoProfileRepository.create(data);

      const fetched = await ammoProfileRepository.getById(created.id as number);

      expect(fetched).toMatchObject({
        ballisticCoefficientG1: 0.505,
        ballisticCoefficientG7: 0.258,
        muzzleVelocity: 2637,
        bulletWeight: 175,
      });
    });

    it('stores omitted optional fields as NULL', async () => {
      const created = await ammoProfileRepository.create(validAmmo());

      const row = await db.getFirstAsync<{
        powder_type: string | null;
        powder_weight: number | null;
        lot_number: string | null;
        notes: string | null;
      }>('SELECT powder_type, powder_weight, lot_number, notes FROM ammo_profiles WHERE id = ?', [
        created.id,
      ]);

      expect(row).toEqual({
        powder_type: null,
        powder_weight: null,
        lot_number: null,
        notes: null,
      });
    });

    it('persists supplied optional fields', async () => {
      const created = await ammoProfileRepository.create(
        validAmmo({ powderType: 'Varget', powderWeight: 44.5, lotNumber: 'LOT-9' })
      );

      const fetched = await ammoProfileRepository.getById(created.id as number);
      expect(fetched).toMatchObject({
        powderType: 'Varget',
        powderWeight: 44.5,
        lotNumber: 'LOT-9',
      });
    });
  });

  describe('getByCaliber', () => {
    beforeEach(async () => {
      await ammoProfileRepository.create(validAmmo({ name: 'B 175gr', caliber: '.308 Win' }));
      await ammoProfileRepository.create(validAmmo({ name: 'A 168gr', caliber: '.308 Win' }));
      await ammoProfileRepository.create(
        validAmmo({ name: '140gr ELD', caliber: '6.5 Creedmoor' })
      );
    });

    it('returns only the matching caliber, ordered by name', async () => {
      const results = await ammoProfileRepository.getByCaliber('.308 Win');
      expect(results.map((a) => a.name)).toEqual(['A 168gr', 'B 175gr']);
    });

    it('returns an empty array for a caliber with no ammo', async () => {
      expect(await ammoProfileRepository.getByCaliber('.338 Lapua')).toEqual([]);
    });

    it('does not match on a partial caliber string', async () => {
      expect(await ammoProfileRepository.getByCaliber('.308')).toEqual([]);
    });
  });

  describe('getAll', () => {
    it('orders by caliber then name', async () => {
      await ammoProfileRepository.create(validAmmo({ name: 'Zeta', caliber: '6.5 Creedmoor' }));
      await ammoProfileRepository.create(validAmmo({ name: 'Beta', caliber: '.308 Win' }));
      await ammoProfileRepository.create(validAmmo({ name: 'Alpha', caliber: '6.5 Creedmoor' }));

      const results = await ammoProfileRepository.getAll();
      expect(results.map((a) => `${a.caliber}/${a.name}`)).toEqual([
        '.308 Win/Beta',
        '6.5 Creedmoor/Alpha',
        '6.5 Creedmoor/Zeta',
      ]);
    });

    it('returns an empty array when there is no ammo', async () => {
      expect(await ammoProfileRepository.getAll()).toEqual([]);
    });
  });

  describe('update', () => {
    it('changes only the supplied fields and persists them', async () => {
      const created = await ammoProfileRepository.create(validAmmo({ notes: 'keep me' }));

      const updated = await ammoProfileRepository.update(created.id as number, {
        muzzleVelocity: 2700,
      });

      expect(updated?.muzzleVelocity).toBe(2700);
      expect(updated?.notes).toBe('keep me');

      const reloaded = await ammoProfileRepository.getById(created.id as number);
      expect(reloaded?.muzzleVelocity).toBe(2700);
    });

    it('returns null when the id does not exist', async () => {
      expect(await ammoProfileRepository.update(4242, { muzzleVelocity: 2700 })).toBeNull();
    });
  });

  describe('delete', () => {
    it('removes the row and reports success', async () => {
      const created = await ammoProfileRepository.create(validAmmo());

      expect(await ammoProfileRepository.delete(created.id as number)).toBe(true);
      expect(await ammoProfileRepository.getById(created.id as number)).toBeNull();
    });

    it('reports failure when the id does not exist', async () => {
      expect(await ammoProfileRepository.delete(4242)).toBe(false);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await ammoProfileRepository.create(
        validAmmo({ name: '175gr SMK', manufacturer: 'Federal', caliber: '.308 Win' })
      );
      await ammoProfileRepository.create(
        validAmmo({ name: '140gr ELD-M', manufacturer: 'Hornady', caliber: '6.5 Creedmoor' })
      );
    });

    it('matches on manufacturer', async () => {
      const results = await ammoProfileRepository.search('Hornady');
      expect(results.map((a) => a.name)).toEqual(['140gr ELD-M']);
    });

    it('matches on a partial name', async () => {
      const results = await ammoProfileRepository.search('SMK');
      expect(results.map((a) => a.name)).toEqual(['175gr SMK']);
    });

    it('returns an empty array when nothing matches', async () => {
      expect(await ammoProfileRepository.search('Nosler')).toEqual([]);
    });
  });

  describe('count', () => {
    it('counts rows across calibers', async () => {
      expect(await ammoProfileRepository.count()).toBe(0);

      await ammoProfileRepository.create(validAmmo({ caliber: '.308 Win' }));
      await ammoProfileRepository.create(validAmmo({ caliber: '6.5 Creedmoor' }));

      expect(await ammoProfileRepository.count()).toBe(2);
    });
  });
});
