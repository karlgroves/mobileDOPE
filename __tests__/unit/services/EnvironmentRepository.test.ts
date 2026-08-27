import environmentRepository from '../../../src/services/database/EnvironmentRepository';
import { validEnvironment } from '../../helpers/fixtures';
import { installTestDatabase, uninstallTestDatabase } from '../../helpers/testDatabase';

import type { TestDatabase } from '../../helpers/testDatabase';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../../helpers/testDatabase').openDatabaseAsync(),
}));

/** Days before now, as the ISO timestamp the schema stores. */
const daysAgo = (days: number): string => new Date(Date.now() - days * 86_400_000).toISOString();

describe('EnvironmentRepository', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await installTestDatabase();
  });

  afterEach(async () => {
    await uninstallTestDatabase();
  });

  /** Creates a snapshot back-dated by `days`, for ordering and age-based queries. */
  const createAged = async (days: number, altitude: number): Promise<void> => {
    await environmentRepository.create(validEnvironment({ altitude, timestamp: daysAgo(days) }));
  };

  describe('create', () => {
    it('persists the snapshot and returns the assigned id', async () => {
      const created = await environmentRepository.create(validEnvironment());

      expect(created.id).toBeGreaterThan(0);
      expect(await environmentRepository.count()).toBe(1);
    });

    it('round-trips the atmospheric fields', async () => {
      const created = await environmentRepository.create(
        validEnvironment({
          temperature: 41.5,
          humidity: 72,
          pressure: 28.44,
          altitude: 6500,
          windSpeed: 12,
          windDirection: 315,
        })
      );

      const fetched = await environmentRepository.getById(created.id as number);
      expect(fetched).toMatchObject({
        temperature: 41.5,
        humidity: 72,
        pressure: 28.44,
        altitude: 6500,
        windSpeed: 12,
        windDirection: 315,
      });
    });

    it('stores omitted GPS coordinates as NULL', async () => {
      const created = await environmentRepository.create(validEnvironment());

      const row = await db.getFirstAsync<{
        latitude: number | null;
      }>('SELECT latitude FROM environment_snapshots WHERE id = ?', [created.id]);
      expect(row).toEqual({ latitude: null });
    });

    it('derives density altitude when it is not supplied', async () => {
      // EnvironmentSnapshot computes it from pressure/temperature, so it is never NULL.
      const created = await environmentRepository.create(validEnvironment());

      const row = await db.getFirstAsync<{ density_altitude: number | null }>(
        'SELECT density_altitude FROM environment_snapshots WHERE id = ?',
        [created.id]
      );
      expect(row?.density_altitude).toEqual(expect.any(Number));
      expect(created.densityAltitude).toBe(row?.density_altitude);
    });

    it('persists a supplied latitude, coarsened', async () => {
      // Longitude is no longer collected at all, and latitude is reduced to one
      // decimal place before it reaches the database. See #44.
      const created = await environmentRepository.create(
        validEnvironment({ latitude: 39.7392, densityAltitude: 7200 })
      );

      const fetched = await environmentRepository.getById(created.id as number);
      expect(fetched).toMatchObject({
        latitude: 39.7,
        densityAltitude: 7200,
      });
    });

    it('stores no full-precision coordinate even when handed one', async () => {
      const created = await environmentRepository.create(validEnvironment({ latitude: 39.739236 }));

      const row = await db.getFirstAsync<{ latitude: number | null }>(
        'SELECT latitude FROM environment_snapshots WHERE id = ?',
        [created.id]
      );
      expect(row?.latitude).toBe(39.7);
    });
  });

  describe('clearStoredCoordinates', () => {
    // Settings offers this so a user can retire their location history without
    // destroying the ballistic readings those snapshots carry. See issue #44.
    it('nulls every stored latitude', async () => {
      await environmentRepository.create(validEnvironment({ latitude: 39.7 }));
      await environmentRepository.create(validEnvironment({ latitude: -33.9 }));

      await environmentRepository.clearStoredCoordinates();

      const rows = await db.getAllAsync<{ latitude: number | null }>(
        'SELECT latitude FROM environment_snapshots'
      );
      expect(rows.map((row) => row.latitude)).toEqual([null, null]);
    });

    it('reports how many snapshots it cleared', async () => {
      await environmentRepository.create(validEnvironment({ latitude: 39.7 }));
      await environmentRepository.create(validEnvironment());

      // Only the row that actually held a coordinate counts.
      expect(await environmentRepository.clearStoredCoordinates()).toBe(1);
    });

    it('preserves the ballistic readings', async () => {
      const created = await environmentRepository.create(
        validEnvironment({ latitude: 39.7, temperature: 72, windSpeed: 11 })
      );

      await environmentRepository.clearStoredCoordinates();

      const fetched = await environmentRepository.getById(created.id as number);
      expect(fetched).toMatchObject({ temperature: 72, windSpeed: 11 });
      expect(fetched?.latitude).toBeUndefined();
    });

    it('is safe to run when nothing is stored', async () => {
      expect(await environmentRepository.clearStoredCoordinates()).toBe(0);
    });
  });

  describe('timestamp handling', () => {
    it('preserves a caller-supplied capture time', async () => {
      const captured = '2026-03-14T15:09:26.000Z';

      const created = await environmentRepository.create(validEnvironment({ timestamp: captured }));

      const row = await db.getFirstAsync<{ timestamp: string }>(
        'SELECT timestamp FROM environment_snapshots WHERE id = ?',
        [created.id]
      );
      expect(row?.timestamp).toBe(captured);
      expect((await environmentRepository.getById(created.id as number))?.timestamp).toBe(captured);
    });

    it('falls back to the schema default when no timestamp is given', async () => {
      const created = await environmentRepository.create(validEnvironment());

      const row = await db.getFirstAsync<{ timestamp: string | null }>(
        'SELECT timestamp FROM environment_snapshots WHERE id = ?',
        [created.id]
      );
      expect(row?.timestamp).toEqual(expect.any(String));
      expect(Number.isNaN(Date.parse(row?.timestamp as string))).toBe(false);
    });
  });

  describe('getById', () => {
    it('returns null for an id that does not exist', async () => {
      expect(await environmentRepository.getById(4242)).toBeNull();
    });
  });

  describe('getAll', () => {
    it('returns newest first and honours the limit', async () => {
      await createAged(3, 300);
      await createAged(1, 100);
      await createAged(2, 200);

      expect((await environmentRepository.getAll()).map((e) => e.altitude)).toEqual([
        100, 200, 300,
      ]);
      expect(await environmentRepository.getAll(2)).toHaveLength(2);
    });

    it('returns an empty array when there are no snapshots', async () => {
      expect(await environmentRepository.getAll()).toEqual([]);
    });
  });

  describe('getRecent', () => {
    it('defaults to at most 10 and caps at the requested count', async () => {
      for (let i = 0; i < 12; i += 1) {
        await createAged(i, 100 + i);
      }

      expect(await environmentRepository.getRecent()).toHaveLength(10);
      expect(await environmentRepository.getRecent(3)).toHaveLength(3);
    });
  });

  describe('getCurrent', () => {
    it('returns the most recent snapshot', async () => {
      await createAged(5, 500);
      await createAged(1, 100);

      expect((await environmentRepository.getCurrent())?.altitude).toBe(100);
    });

    it('returns null when there are no snapshots', async () => {
      expect(await environmentRepository.getCurrent()).toBeNull();
    });
  });

  describe('update', () => {
    it('changes only the supplied fields and persists them', async () => {
      const created = await environmentRepository.create(validEnvironment());

      const updated = await environmentRepository.update(created.id as number, {
        windSpeed: 18,
      });

      expect(updated?.windSpeed).toBe(18);
      expect(updated?.temperature).toBe(59);

      const reloaded = await environmentRepository.getById(created.id as number);
      expect(reloaded?.windSpeed).toBe(18);
    });

    it('returns null when the id does not exist', async () => {
      expect(await environmentRepository.update(4242, { windSpeed: 1 })).toBeNull();
    });
  });

  describe('delete', () => {
    it('removes the snapshot and reports success', async () => {
      const created = await environmentRepository.create(validEnvironment());

      expect(await environmentRepository.delete(created.id as number)).toBe(true);
      expect(await environmentRepository.getById(created.id as number)).toBeNull();
    });

    it('reports failure when the id does not exist', async () => {
      expect(await environmentRepository.delete(4242)).toBe(false);
    });
  });

  describe('deleteOlderThan', () => {
    it('deletes only snapshots older than the cutoff and reports the count', async () => {
      await createAged(60, 600);
      await createAged(45, 450);
      await createAged(0, 100);

      const deleted = await environmentRepository.deleteOlderThan(30);

      expect(deleted).toBe(2);
      expect(await environmentRepository.count()).toBe(1);
    });

    it('deletes nothing when every snapshot is newer than the cutoff', async () => {
      await createAged(0, 100);

      expect(await environmentRepository.deleteOlderThan(30)).toBe(0);
      expect(await environmentRepository.count()).toBe(1);
    });
  });

  describe('count', () => {
    it('returns 0 for an empty table', async () => {
      expect(await environmentRepository.count()).toBe(0);
    });
  });
});
