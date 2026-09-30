import { useEnvironmentStore } from '../../../src/store/useEnvironmentStore';
import { validEnvironment } from '../../helpers/fixtures';
import { installTestDatabase, uninstallTestDatabase } from '../../helpers/testDatabase';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../../helpers/testDatabase').openDatabaseAsync(),
}));

/** See useRifleStore.test.ts for why these run against a real database. Issue #28. */
const store = () => useEnvironmentStore.getState();

const resetStore = () =>
  useEnvironmentStore.setState({ current: null, snapshots: [], loading: false });

describe('useEnvironmentStore', () => {
  beforeEach(async () => {
    await installTestDatabase();
    resetStore();
  });

  afterEach(async () => {
    await uninstallTestDatabase();
  });

  describe('current conditions', () => {
    it('starts with nothing current', () => {
      expect(store().current).toBeNull();
    });

    it('sets and clears the current reading', () => {
      store().setCurrent(validEnvironment());
      expect(store().current?.temperature).toBe(59);

      store().setCurrent(null);
      expect(store().current).toBeNull();
    });

    it('merges a partial update into the current reading', () => {
      store().setCurrent(validEnvironment({ temperature: 59, windSpeed: 5 }));

      store().updateCurrent({ windSpeed: 12 });

      expect(store().current).toMatchObject({ temperature: 59, windSpeed: 12 });
    });

    it('ignores a partial update when nothing is current', () => {
      // The alternative -- constructing a half-populated reading from a fragment --
      // would produce a snapshot the solver could silently use.
      store().updateCurrent({ windSpeed: 12 });

      expect(store().current).toBeNull();
    });
  });

  describe('snapshots', () => {
    it('createSnapshot persists and caches', async () => {
      const created = await store().createSnapshot(validEnvironment({ temperature: 72 }));

      expect(created.id).toBeGreaterThan(0);
      expect(store().snapshots.map((s) => s.temperature)).toEqual([72]);
    });

    it('loadSnapshots refreshes a stale cache', async () => {
      await store().createSnapshot(validEnvironment({ temperature: 59 }));
      await store().createSnapshot(validEnvironment({ temperature: 72 }));
      resetStore();

      await store().loadSnapshots();

      expect(store().snapshots).toHaveLength(2);
    });

    it('loadSnapshots honours a limit', async () => {
      await store().createSnapshot(validEnvironment({ temperature: 59 }));
      await store().createSnapshot(validEnvironment({ temperature: 72 }));
      resetStore();

      await store().loadSnapshots(1);

      expect(store().snapshots).toHaveLength(1);
    });

    it('updateSnapshot writes through to the database', async () => {
      const created = await store().createSnapshot(validEnvironment({ temperature: 59 }));

      await store().updateSnapshot(created.id as number, { temperature: 80 });

      resetStore();
      await store().loadSnapshots();
      expect(store().snapshots[0]?.temperature).toBe(80);
    });

    it('deleteSnapshot removes the row and the cached copy', async () => {
      const created = await store().createSnapshot(validEnvironment());

      await store().deleteSnapshot(created.id as number);

      expect(store().snapshots).toEqual([]);
      resetStore();
      await store().loadSnapshots();
      expect(store().snapshots).toEqual([]);
    });
  });

  describe('loadCurrent and saveCurrent', () => {
    it('loadCurrent picks up the most recent stored reading', async () => {
      await store().createSnapshot(validEnvironment({ temperature: 59 }));
      await store().createSnapshot(validEnvironment({ temperature: 72 }));
      resetStore();

      await store().loadCurrent();

      expect(store().current?.temperature).toBe(72);
    });

    it('loadCurrent leaves current null when nothing is stored', async () => {
      await store().loadCurrent();

      expect(store().current).toBeNull();
      expect(store().loading).toBe(false);
    });

    it('saveCurrent persists the working reading and puts it at the head', async () => {
      await store().createSnapshot(validEnvironment({ temperature: 59 }));
      store().setCurrent(validEnvironment({ temperature: 95 }));

      const saved = await store().saveCurrent();

      expect(saved.id).toBeGreaterThan(0);
      expect(store().snapshots[0]?.temperature).toBe(95);
      // `current` is replaced with the persisted copy so it carries its new id.
      expect(store().current?.id).toBe(saved.id);
    });

    it('saveCurrent rejects when there is nothing to save', async () => {
      await expect(store().saveCurrent()).rejects.toThrow('No current environment data to save');
    });
  });

  describe('failure handling', () => {
    it('clears the loading flag when a load fails', async () => {
      await uninstallTestDatabase();

      await expect(store().loadSnapshots()).rejects.toThrow();
      expect(store().loading).toBe(false);
    });

    it('clears the loading flag when loadCurrent fails', async () => {
      await uninstallTestDatabase();

      await expect(store().loadCurrent()).rejects.toThrow();
      expect(store().loading).toBe(false);
    });
  });
});
