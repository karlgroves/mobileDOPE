import ammoProfileRepository from '../../../src/services/database/AmmoProfileRepository';
import environmentRepository from '../../../src/services/database/EnvironmentRepository';
import rifleProfileRepository from '../../../src/services/database/RifleProfileRepository';
import { useDOPEStore } from '../../../src/store/useDOPEStore';
import { validAmmo, validDopeLog, validEnvironment, validRifle } from '../../helpers/fixtures';
import { installTestDatabase, uninstallTestDatabase } from '../../helpers/testDatabase';

import type { DOPELog } from '../../../src/models/DOPELog';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../../helpers/testDatabase').openDatabaseAsync(),
}));

/** See useRifleStore.test.ts for why these run against a real database. Issue #28. */
const store = () => useDOPEStore.getState();

const resetStore = () => useDOPEStore.setState({ dopeLogs: [], loading: false });

describe('useDOPEStore', () => {
  let ids: { rifleId: number; ammoId: number; environmentId: number };

  beforeEach(async () => {
    await installTestDatabase();
    resetStore();
    // DOPE logs are FK-constrained to a rifle, ammo and environment row.
    ids = {
      rifleId: (await rifleProfileRepository.create(validRifle())).id as number,
      ammoId: (await ammoProfileRepository.create(validAmmo())).id as number,
      environmentId: (await environmentRepository.create(validEnvironment())).id as number,
    };
  });

  afterEach(async () => {
    await uninstallTestDatabase();
  });

  describe('in-memory operations', () => {
    it('adds, updates and removes logs', () => {
      store().addDopeLogToStore({ id: 1, distance: 100 } as DOPELog);
      store().addDopeLogToStore({ id: 2, distance: 200 } as DOPELog);

      store().updateDopeLogInStore({ id: 1, distance: 150 } as DOPELog);
      expect(store().getDopeById(1)?.distance).toBe(150);

      store().removeDopeLogFromStore(2);
      expect(store().dopeLogs.map((l) => l.id)).toEqual([1]);
    });

    it('filters by rifle and ammo together, not either alone', () => {
      store().setDopeLogs([
        { id: 1, rifleId: 1, ammoId: 1 } as DOPELog,
        { id: 2, rifleId: 1, ammoId: 2 } as DOPELog,
        { id: 3, rifleId: 2, ammoId: 1 } as DOPELog,
      ]);

      expect(
        store()
          .getDopeByRifleAndAmmo(1, 1)
          .map((l) => l.id)
      ).toEqual([1]);
      expect(store().getDopeByRifleAndAmmo(9, 9)).toEqual([]);
    });
  });

  describe('database operations', () => {
    it('createDopeLog persists and caches', async () => {
      const created = await store().createDopeLog(validDopeLog(ids, { distance: 500 }));

      expect(created.id).toBeGreaterThan(0);
      expect(store().dopeLogs.map((l) => l.distance)).toEqual([500]);
    });

    it('loadDopeLogs refreshes a stale cache', async () => {
      await store().createDopeLog(validDopeLog(ids, { distance: 500 }));
      await store().createDopeLog(validDopeLog(ids, { distance: 800 }));
      resetStore();

      await store().loadDopeLogs();

      expect(
        store()
          .dopeLogs.map((l) => l.distance)
          .sort((a, b) => a - b)
      ).toEqual([500, 800]);
    });

    it('loadDopeLogs narrows to one rifle and ammo pairing', async () => {
      const otherRifleId = (await rifleProfileRepository.create(validRifle({ name: 'Other' })))
        .id as number;
      await store().createDopeLog(validDopeLog(ids, { distance: 500 }));
      await store().createDopeLog(
        validDopeLog({ ...ids, rifleId: otherRifleId }, { distance: 900 })
      );
      resetStore();

      await store().loadDopeLogs(ids.rifleId, ids.ammoId);

      expect(store().dopeLogs.map((l) => l.distance)).toEqual([500]);
    });

    it('updateDopeLog writes through to the database', async () => {
      const created = await store().createDopeLog(validDopeLog(ids, { distance: 500 }));

      await store().updateDopeLog(created.id as number, { distance: 600 });

      resetStore();
      await store().loadDopeLogs();
      expect(store().dopeLogs[0]?.distance).toBe(600);
    });

    it('deleteDopeLog removes the row and the cached copy', async () => {
      const created = await store().createDopeLog(validDopeLog(ids));

      await store().deleteDopeLog(created.id as number);

      expect(store().dopeLogs).toEqual([]);
      resetStore();
      await store().loadDopeLogs();
      expect(store().dopeLogs).toEqual([]);
    });
  });

  describe('failure handling', () => {
    it('clears the loading flag when a load fails', async () => {
      await uninstallTestDatabase();

      await expect(store().loadDopeLogs()).rejects.toThrow();
      expect(store().loading).toBe(false);
    });
  });
});
