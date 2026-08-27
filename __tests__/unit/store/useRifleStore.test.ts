import { useRifleStore } from '../../../src/store/useRifleStore';
import { validRifle } from '../../helpers/fixtures';
import { installTestDatabase, uninstallTestDatabase } from '../../helpers/testDatabase';

import type { RifleProfile } from '../../../src/models/RifleProfile';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../../helpers/testDatabase').openDatabaseAsync(),
}));

/**
 * The Zustand rifle store, exercised against a real in-memory database rather than
 * a mocked repository.
 *
 * Stubbing the repository would assert only that the store calls the function it
 * obviously calls. Running the real path catches the thing that actually breaks: a
 * store whose cache drifts out of step with the rows on disk. See issue #28 phase 3.
 */
const store = () => useRifleStore.getState();

/** Zustand stores are module singletons; reset between tests. */
const resetStore = () =>
  useRifleStore.setState({ rifles: [], selectedRifleId: null, loading: false });

describe('useRifleStore', () => {
  beforeEach(async () => {
    await installTestDatabase();
    resetStore();
  });

  afterEach(async () => {
    await uninstallTestDatabase();
  });

  describe('in-memory operations', () => {
    it('starts empty', () => {
      expect(store().rifles).toEqual([]);
      expect(store().selectedRifleId).toBeNull();
      expect(store().loading).toBe(false);
    });

    it('replaces the whole collection with setRifles', () => {
      store().setRifles([{ id: 1, name: 'A' } as RifleProfile]);
      expect(store().rifles).toHaveLength(1);

      store().setRifles([]);
      expect(store().rifles).toEqual([]);
    });

    it('appends with addRifle without mutating the previous array', () => {
      const before = store().rifles;
      store().addRifle({ id: 1, name: 'A' } as RifleProfile);

      expect(store().rifles).toHaveLength(1);
      expect(before).toHaveLength(0);
    });

    it('replaces only the matching rifle on updateRifleInStore', () => {
      store().setRifles([
        { id: 1, name: 'A' } as RifleProfile,
        { id: 2, name: 'B' } as RifleProfile,
      ]);

      store().updateRifleInStore({ id: 2, name: 'B renamed' } as RifleProfile);

      expect(store().rifles.map((r) => r.name)).toEqual(['A', 'B renamed']);
    });

    it('leaves the collection alone when updateRifleInStore matches nothing', () => {
      store().setRifles([{ id: 1, name: 'A' } as RifleProfile]);

      store().updateRifleInStore({ id: 99, name: 'Ghost' } as RifleProfile);

      expect(store().rifles.map((r) => r.name)).toEqual(['A']);
    });

    it('removes by id', () => {
      store().setRifles([
        { id: 1, name: 'A' } as RifleProfile,
        { id: 2, name: 'B' } as RifleProfile,
      ]);

      store().removeRifle(1);

      expect(store().rifles.map((r) => r.id)).toEqual([2]);
    });

    it('finds by id and returns undefined for a miss', () => {
      store().setRifles([{ id: 7, name: 'A' } as RifleProfile]);

      expect(store().getRifleById(7)?.name).toBe('A');
      expect(store().getRifleById(8)).toBeUndefined();
    });

    it('tracks the selected rifle, including clearing it', () => {
      store().setSelectedRifleId(3);
      expect(store().selectedRifleId).toBe(3);

      store().setSelectedRifleId(null);
      expect(store().selectedRifleId).toBeNull();
    });

    it('tracks the loading flag', () => {
      store().setLoading(true);
      expect(store().loading).toBe(true);

      store().setLoading(false);
      expect(store().loading).toBe(false);
    });
  });

  describe('database operations', () => {
    it('createRifle persists and caches in one step', async () => {
      const created = await store().createRifle(validRifle({ name: 'Tikka T3x' }));

      expect(created.id).toBeGreaterThan(0);
      expect(store().rifles.map((r) => r.id)).toEqual([created.id]);
    });

    it('loadRifles replaces the cache with what is on disk', async () => {
      await store().createRifle(validRifle({ name: 'One' }));
      await store().createRifle(validRifle({ name: 'Two' }));

      // Simulate a stale cache: the rows exist, the store does not know about them.
      resetStore();
      expect(store().rifles).toEqual([]);

      await store().loadRifles();

      expect(
        store()
          .rifles.map((r) => r.name)
          .sort()
      ).toEqual(['One', 'Two']);
    });

    it('loadRifles clears the loading flag on success', async () => {
      await store().loadRifles();
      expect(store().loading).toBe(false);
    });

    it('updateRifle writes through and refreshes the cached copy', async () => {
      const created = await store().createRifle(validRifle({ name: 'Before' }));

      await store().updateRifle(created.id as number, validRifle({ name: 'After' }));

      expect(store().getRifleById(created.id as number)?.name).toBe('After');

      // And the change reached the database, not just the cache.
      resetStore();
      await store().loadRifles();
      expect(store().rifles[0]?.name).toBe('After');
    });

    it('updateRifle rejects for an id that does not exist', async () => {
      await expect(store().updateRifle(999, validRifle())).rejects.toThrow(
        'Rifle profile with id 999 not found'
      );
    });

    it('deleteRifle removes the row and drops it from the cache', async () => {
      const created = await store().createRifle(validRifle());

      await store().deleteRifle(created.id as number);

      expect(store().rifles).toEqual([]);
      resetStore();
      await store().loadRifles();
      expect(store().rifles).toEqual([]);
    });
  });

  describe('failure handling', () => {
    it('loadRifles clears the loading flag and rethrows when the database is gone', async () => {
      await uninstallTestDatabase();

      await expect(store().loadRifles()).rejects.toThrow();
      // The flag must not be left stuck on, or every list screen spins forever.
      expect(store().loading).toBe(false);
    });
  });
});
