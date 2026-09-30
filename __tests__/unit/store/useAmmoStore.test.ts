import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { validAmmo } from '../../helpers/fixtures';
import { installTestDatabase, uninstallTestDatabase } from '../../helpers/testDatabase';

import type { AmmoProfile } from '../../../src/models/AmmoProfile';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../../helpers/testDatabase').openDatabaseAsync(),
}));

/** See useRifleStore.test.ts for why these run against a real database. Issue #28. */
const store = () => useAmmoStore.getState();

const resetStore = () =>
  useAmmoStore.setState({ ammoProfiles: [], selectedAmmoId: null, loading: false });

describe('useAmmoStore', () => {
  beforeEach(async () => {
    await installTestDatabase();
    resetStore();
  });

  afterEach(async () => {
    await uninstallTestDatabase();
  });

  describe('in-memory operations', () => {
    it('adds, updates and removes profiles', () => {
      store().addAmmoProfileToStore({ id: 1, name: 'A' } as AmmoProfile);
      store().addAmmoProfileToStore({ id: 2, name: 'B' } as AmmoProfile);
      expect(store().ammoProfiles).toHaveLength(2);

      store().updateAmmoProfileInStore({ id: 1, name: 'A2' } as AmmoProfile);
      expect(store().getAmmoById(1)?.name).toBe('A2');

      store().removeAmmoProfileFromStore(1);
      expect(store().ammoProfiles.map((a) => a.id)).toEqual([2]);
    });

    it('filters by caliber', () => {
      store().setAmmoProfiles([
        { id: 1, caliber: '.308 Win' } as AmmoProfile,
        { id: 2, caliber: '6.5 Creedmoor' } as AmmoProfile,
        { id: 3, caliber: '.308 Win' } as AmmoProfile,
      ]);

      expect(
        store()
          .getAmmoByCaliber('.308 Win')
          .map((a) => a.id)
      ).toEqual([1, 3]);
      expect(store().getAmmoByCaliber('.223 Rem')).toEqual([]);
    });

    it('tracks the selected ammo', () => {
      store().setSelectedAmmoId(4);
      expect(store().selectedAmmoId).toBe(4);

      store().setSelectedAmmoId(null);
      expect(store().selectedAmmoId).toBeNull();
    });

    it('tracks the loading flag', () => {
      store().setLoading(true);
      expect(store().loading).toBe(true);
      store().setLoading(false);
      expect(store().loading).toBe(false);
    });
  });

  describe('database operations', () => {
    it('createAmmoProfile persists and caches', async () => {
      const created = await store().createAmmoProfile(validAmmo({ name: '175gr SMK' }));

      expect(created.id).toBeGreaterThan(0);
      expect(store().ammoProfiles.map((a) => a.name)).toEqual(['175gr SMK']);
    });

    it('loadAmmoProfiles refreshes a stale cache', async () => {
      await store().createAmmoProfile(validAmmo({ name: 'One' }));
      resetStore();

      await store().loadAmmoProfiles();

      expect(store().ammoProfiles.map((a) => a.name)).toEqual(['One']);
    });

    it('loadAmmoProfiles filters by caliber when one is given', async () => {
      await store().createAmmoProfile(validAmmo({ name: 'Match', caliber: '.308 Win' }));
      await store().createAmmoProfile(validAmmo({ name: 'Creed', caliber: '6.5 Creedmoor' }));
      resetStore();

      await store().loadAmmoProfiles('6.5 Creedmoor');

      expect(store().ammoProfiles.map((a) => a.name)).toEqual(['Creed']);
    });

    it('updateAmmoProfile writes through to the database', async () => {
      const created = await store().createAmmoProfile(validAmmo({ name: 'Before' }));

      await store().updateAmmoProfile(created.id as number, validAmmo({ name: 'After' }));

      resetStore();
      await store().loadAmmoProfiles();
      expect(store().ammoProfiles[0]?.name).toBe('After');
    });

    it('updateAmmoProfile rejects for a missing id', async () => {
      await expect(store().updateAmmoProfile(999, validAmmo())).rejects.toThrow();
    });

    it('deleteAmmoProfile removes the row and the cached copy', async () => {
      const created = await store().createAmmoProfile(validAmmo());

      await store().deleteAmmoProfile(created.id as number);

      expect(store().ammoProfiles).toEqual([]);
      resetStore();
      await store().loadAmmoProfiles();
      expect(store().ammoProfiles).toEqual([]);
    });
  });

  describe('failure handling', () => {
    it('clears the loading flag when a load fails', async () => {
      await uninstallTestDatabase();

      await expect(store().loadAmmoProfiles()).rejects.toThrow();
      expect(store().loading).toBe(false);
    });
  });
});
