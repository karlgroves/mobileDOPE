import { DatabaseSync } from 'node:sqlite';

import migration005 from '../../../../src/services/database/migrations/005_drop_longitude_coarsen_latitude';
import { DB_INDEXES, DB_SCHEMA } from '../../../../src/types/database.types';

import type * as SQLite from 'expo-sqlite';

/**
 * The migration that retires stored precise coordinates.
 *
 * Coarsening new writes (see `EnvironmentSnapshot`) does nothing for the rows an
 * existing install already holds -- those were captured at ~0.1 m resolution and
 * would keep flowing into every export. See issue #44.
 *
 * The fixture here is deliberately the *production* one: the full `DB_SCHEMA`,
 * `PRAGMA foreign_keys = ON` exactly as `DatabaseService.initialize()` sets it, a
 * `dope_logs` row referencing the snapshot being migrated, and the migration run
 * inside a transaction the way `MigrationRunner` runs it. An earlier version of
 * this suite built `environment_snapshots` alone with foreign keys off; it passed
 * while the migration raised `FOREIGN KEY constraint failed` on every real
 * install.
 */

/** `environment_snapshots` as it stood before this migration -- with `longitude`. */
const LEGACY_ENVIRONMENT_DDL = `
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

/**
 * A database in the shape an upgrading install actually has: every production
 * table, foreign keys enforced, and the pre-migration environment schema.
 */
const createUpgradingDatabase = (): DatabaseSync => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');

  for (const [name, ddl] of Object.entries(DB_SCHEMA)) {
    db.exec(name === 'ENVIRONMENT_SNAPSHOT' ? LEGACY_ENVIRONMENT_DDL : ddl);
  }
  for (const ddl of Object.values(DB_INDEXES)) db.exec(ddl);

  return db;
};

/** Adapter over the subset of expo-sqlite the migration touches. */
const adapt = (db: DatabaseSync): SQLite.SQLiteDatabase =>
  ({
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
  }) as unknown as SQLite.SQLiteDatabase;

interface Row {
  id: number;
  latitude: number | null;
  longitude: number | null;
}

const columnsOf = (db: DatabaseSync, table: string): string[] =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[]).map(
    (column) => column.name
  );

describe('migration 005: retire stored coordinates', () => {
  let raw: DatabaseSync;
  let db: SQLite.SQLiteDatabase;
  let log: typeof console.log;

  beforeEach(() => {
    raw = createUpgradingDatabase();
    db = adapt(raw);
    log = console.log;
    console.log = () => {};
  });

  afterEach(() => {
    console.log = log;
    raw.close();
  });

  /** Seed a snapshot plus a DOPE log that references it, as a real install has. */
  const seed = (coordinates: [number | null, number | null][]): void => {
    raw
      .prepare(
        `INSERT INTO rifle_profiles
           (name, caliber, barrel_length, twist_rate, zero_distance,
            optic_manufacturer, optic_model, reticle_type,
            click_value_type, click_value, scope_height)
         VALUES ('Tikka T3x', '.308 Win', 24, 8, 100,
                 'Vortex', 'Razor HD', 'EBR-7C', 'MIL', 0.1, 1.5)`
      )
      .run();
    raw
      .prepare(
        `INSERT INTO ammo_profiles
           (name, manufacturer, caliber, bullet_weight, bullet_type,
            ballistic_coefficient_g1, ballistic_coefficient_g7, muzzle_velocity)
         VALUES ('175gr SMK', 'Sierra', '.308 Win', 175, 'HPBT', 0.505, 0.243, 2650)`
      )
      .run();

    for (const [latitude, longitude] of coordinates) {
      raw
        .prepare(
          `INSERT INTO environment_snapshots
             (temperature, humidity, pressure, altitude, density_altitude,
              wind_speed, wind_direction, latitude, longitude, timestamp)
           VALUES (59, 50, 29.92, 1000, 1200, 5, 90, ?, ?, '2026-01-01T00:00:00.000Z')`
        )
        .run(latitude, longitude);
    }

    // The row that made the old table-rebuild fail.
    raw
      .prepare(
        `INSERT INTO dope_logs
           (rifle_id, ammo_id, environment_id, distance, distance_unit,
            elevation_correction, windage_correction, correction_unit,
            target_type, timestamp)
         VALUES (1, 1, 1, 500, 'yards', 3.4, 0.5, 'MIL', 'steel',
                 '2026-01-01T00:00:00.000Z')`
      )
      .run();
  };

  const environments = (): Row[] =>
    raw
      .prepare('SELECT id, latitude, longitude FROM environment_snapshots ORDER BY id')
      .all() as unknown as Row[];

  it('is registered at version 5', () => {
    expect(migration005.version).toBe(5);
  });

  it('runs to completion with foreign keys on and a referencing DOPE log', async () => {
    // The regression this suite exists for. The previous table-rebuild raised
    // `FOREIGN KEY constraint failed` here.
    seed([[39.739236, -104.990251]]);

    await expect(migration005.up(db)).resolves.toBeUndefined();
  });

  it('runs inside a transaction, the way MigrationRunner invokes it', async () => {
    seed([[39.739236, -104.990251]]);

    raw.exec('BEGIN');
    await migration005.up(db);
    raw.exec('COMMIT');

    expect(environments()[0]?.latitude).toBe(39.7);
  });

  it('clears every stored longitude', async () => {
    seed([
      [39.739236, -104.990251],
      [-33.868821, 151.209295],
    ]);
    await migration005.up(db);

    expect(environments().map((row) => row.longitude)).toEqual([null, null]);
  });

  it('coarsens every stored latitude to one decimal place', async () => {
    seed([
      [39.739236, -104.990251],
      [-33.868821, 151.209295],
      [51.477928, -0.001545],
    ]);
    await migration005.up(db);

    expect(environments().map((row) => row.latitude)).toEqual([39.7, -33.9, 51.5]);
  });

  it('leaves a NULL latitude NULL rather than turning it into 0', async () => {
    seed([[null, null]]);
    await migration005.up(db);

    expect(environments()[0]?.latitude).toBeNull();
  });

  it('preserves the DOPE log and its link to the snapshot', async () => {
    seed([[39.739236, -104.990251]]);
    await migration005.up(db);

    const log = raw.prepare('SELECT environment_id, distance FROM dope_logs').get() as unknown as {
      environment_id: number;
      distance: number;
    };
    expect(log).toEqual({ environment_id: 1, distance: 500 });
    expect(raw.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('preserves the ballistic readings and the capture time', async () => {
    seed([[39.739236, -104.990251]]);
    await migration005.up(db);

    const row = raw
      .prepare(
        `SELECT temperature, humidity, pressure, altitude, density_altitude,
                wind_speed, wind_direction, timestamp
           FROM environment_snapshots WHERE id = 1`
      )
      .get() as unknown as Record<string, unknown>;

    expect(row).toEqual({
      temperature: 59,
      humidity: 50,
      pressure: 29.92,
      altitude: 1000,
      density_altitude: 1200,
      wind_speed: 5,
      wind_direction: 90,
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  it('leaves the table structure alone', async () => {
    // The deliberate trade: `longitude` survives as an always-NULL column rather
    // than the table being rebuilt under a foreign key. See the migration's docs.
    seed([[39.739236, -104.990251]]);
    await migration005.up(db);

    expect(columnsOf(raw, 'environment_snapshots')).toContain('longitude');
  });

  it('is idempotent', async () => {
    seed([[39.739236, -104.990251]]);
    await migration005.up(db);
    await migration005.up(db);

    expect(environments()[0]).toMatchObject({ latitude: 39.7, longitude: null });
  });

  it('does not restore precision on rollback', async () => {
    seed([[39.739236, -104.990251]]);
    await migration005.up(db);
    await migration005.down(db);

    expect(environments()[0]).toMatchObject({ latitude: 39.7, longitude: null });
  });
});
