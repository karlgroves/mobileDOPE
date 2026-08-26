import { DatabaseSync } from 'node:sqlite';

import migration005 from '../../../../src/services/database/migrations/005_drop_longitude_coarsen_latitude';

import type * as SQLite from 'expo-sqlite';

/**
 * The migration that retires stored precise coordinates.
 *
 * Coarsening new writes (see `EnvironmentSnapshot`) does nothing for the rows an
 * existing install already holds -- those were captured at ~0.1 m resolution and
 * would keep flowing into every export. See issue #44.
 */

/** The `environment_snapshots` DDL as it stood before this migration. */
const LEGACY_DDL = `
  CREATE TABLE IF NOT EXISTS environment_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    temperature REAL NOT NULL,
    humidity REAL NOT NULL,
    pressure REAL NOT NULL,
    altitude REAL NOT NULL,
    density_altitude REAL NOT NULL,
    wind_speed REAL NOT NULL,
    wind_direction REAL NOT NULL,
    latitude REAL,
    longitude REAL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

/** Minimal adapter: the migration only ever calls `execAsync`. */
const adapt = (db: DatabaseSync): SQLite.SQLiteDatabase =>
  ({
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
  }) as unknown as SQLite.SQLiteDatabase;

interface Row {
  id: number;
  latitude: number | null;
}

const columnsOf = (db: DatabaseSync, table: string): string[] =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
    (column) => column.name
  );

describe('migration 005: drop longitude, coarsen latitude', () => {
  let raw: DatabaseSync;
  let db: SQLite.SQLiteDatabase;
  let log: typeof console.log;

  beforeEach(() => {
    raw = new DatabaseSync(':memory:');
    raw.exec(LEGACY_DDL);
    db = adapt(raw);
    log = console.log;
    console.log = () => {};
  });

  afterEach(() => {
    console.log = log;
    raw.close();
  });

  const seed = (rows: [number | null, number | null][]): void => {
    for (const [latitude, longitude] of rows) {
      raw
        .prepare(
          `INSERT INTO environment_snapshots
            (temperature, humidity, pressure, altitude, density_altitude,
             wind_speed, wind_direction, latitude, longitude, timestamp)
           VALUES (59, 50, 29.92, 1000, 1200, 5, 90, ?, ?, '2026-01-01T00:00:00.000Z')`
        )
        .run(latitude, longitude);
    }
  };

  it('is registered at version 5', () => {
    expect(migration005.version).toBe(5);
  });

  it('removes the longitude column entirely', async () => {
    seed([[39.739236, -104.990251]]);
    await migration005.up(db);

    expect(columnsOf(raw, 'environment_snapshots')).not.toContain('longitude');
  });

  it('coarsens every stored latitude to one decimal place', async () => {
    seed([
      [39.739236, -104.990251],
      [-33.868821, 151.209295],
      [51.477928, -0.001545],
    ]);
    await migration005.up(db);

    const rows = raw
      .prepare('SELECT id, latitude FROM environment_snapshots ORDER BY id')
      .all() as unknown as Row[];
    expect(rows.map((row) => row.latitude)).toEqual([39.7, -33.9, 51.5]);
  });

  it('leaves a NULL latitude NULL', async () => {
    seed([[null, null]]);
    await migration005.up(db);

    const row = raw.prepare('SELECT latitude FROM environment_snapshots').get() as unknown as Row;
    expect(row.latitude).toBeNull();
  });

  it('preserves ids, ballistic readings and capture times', async () => {
    seed([
      [39.739236, -104.990251],
      [null, null],
    ]);
    await migration005.up(db);

    const rows = raw
      .prepare(
        `SELECT id, temperature, humidity, pressure, altitude, density_altitude,
                wind_speed, wind_direction, timestamp
           FROM environment_snapshots ORDER BY id`
      )
      .all() as unknown as Record<string, unknown>[];

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      id: 1,
      temperature: 59,
      humidity: 50,
      pressure: 29.92,
      altitude: 1000,
      density_altitude: 1200,
      wind_speed: 5,
      wind_direction: 90,
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    expect(rows[1]?.id).toBe(2);
  });

  it('keeps AUTOINCREMENT working after the table rebuild', async () => {
    seed([[39.739236, -104.990251]]);
    await migration005.up(db);

    raw
      .prepare(
        `INSERT INTO environment_snapshots
          (temperature, humidity, pressure, altitude, density_altitude,
           wind_speed, wind_direction, latitude)
         VALUES (60, 40, 29.9, 900, 1100, 3, 180, 40.1)`
      )
      .run();

    const row = raw
      .prepare('SELECT id FROM environment_snapshots ORDER BY id DESC LIMIT 1')
      .get() as unknown as Row;
    expect(row.id).toBe(2);
  });

  it('does not restore precision on rollback', async () => {
    // The coarsening is deliberately one-way: `down` may re-add the column, but the
    // discarded digits are gone. Anything else would defeat the point.
    seed([[39.739236, -104.990251]]);
    await migration005.up(db);
    await migration005.down(db);

    const row = raw
      .prepare('SELECT latitude, longitude FROM environment_snapshots')
      .get() as unknown as { latitude: number | null; longitude: number | null };

    expect(columnsOf(raw, 'environment_snapshots')).toContain('longitude');
    expect(row.latitude).toBe(39.7);
    expect(row.longitude).toBeNull();
  });
});
