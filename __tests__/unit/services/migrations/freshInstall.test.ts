import { DatabaseSync } from 'node:sqlite';

import { migrationRunner } from '../../../../src/services/database/migrations';
import { DB_INDEXES, DB_SCHEMA } from '../../../../src/types/database.types';

/**
 * A new user's database: empty, then every migration in order (#128).
 *
 * Migration 001 used to create its tables from the live `DB_SCHEMA`, which had
 * already moved on to the shape later migrations produce. On an empty database
 * 001 built `ammo_profiles` with `caliber`, and 002 then failed adding it again,
 * so a fresh install never got past launch. Nothing ran the migrations from an
 * empty database, which is the only path a new user takes.
 *
 * These drive the real `MigrationRunner.runPendingMigrations()`, transaction and
 * all, with `DatabaseService` pointed at an in-memory node:sqlite database.
 */

// The database the stand-in DatabaseService serves. Each test sets its own.
let mockDb: DatabaseSync;

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('../../../../src/services/database/DatabaseService', () => {
  const adapter = {
    execAsync: async (sql: string) => {
      mockDb.exec(sql);
    },
    getAllAsync: async (sql: string) => mockDb.prepare(sql).all(),
  };
  const service = {
    getDatabase: () => adapter,
    getDatabaseVersion: async () =>
      (mockDb.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
    // The same shape as DatabaseService.transaction.
    transaction: async <T>(work: (db: typeof adapter) => Promise<T>): Promise<T> => {
      await adapter.execAsync('BEGIN TRANSACTION;');
      try {
        const result = await work(adapter);
        await adapter.execAsync('COMMIT;');
        return result;
      } catch (error) {
        await adapter.execAsync('ROLLBACK;');
        throw error;
      }
    },
  };
  const module = { default: service, databaseService: service };
  // Marks it as an ES module so the default import resolves to `service`.
  Object.defineProperty(module, '__esModule', { value: true });
  return module;
});

/** Open `db` the way DatabaseService.initialize() does, and run the migrations. */
const migrate = async (db: DatabaseSync): Promise<void> => {
  mockDb = db;
  db.exec('PRAGMA foreign_keys = ON;');
  await migrationRunner.runPendingMigrations();
};

const version = (db: DatabaseSync): number =>
  (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;

const latest = Math.max(...migrationRunner.getMigrations().map((m) => m.version));

const TABLES = Object.values(DB_SCHEMA).map(
  (ddl) => /CREATE TABLE IF NOT EXISTS (\w+)/.exec(ddl)?.[1] as string
);

/**
 * Column names of every table, and every index with the table and columns it
 * covers. Order-insensitive.
 */
const shapeOf = (db: DatabaseSync) => ({
  columns: Object.fromEntries(
    TABLES.map((table) => [
      table,
      (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[])
        .map((c) => c.name)
        .sort(),
    ])
  ),
  indexes: (
    db
      .prepare(
        "SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'"
      )
      .all() as { name: string; tbl_name: string }[]
  )
    .map((index) => {
      const columns = (
        db.prepare(`PRAGMA index_info(${index.name})`).all() as { name: string }[]
      ).map((c) => c.name);
      return `${index.name} ON ${index.tbl_name}(${columns.join(', ')})`;
    })
    .sort(),
});

/** The schema the app's repositories are written against. */
const current = (): DatabaseSync => {
  const db = new DatabaseSync(':memory:');
  for (const ddl of Object.values(DB_SCHEMA)) db.exec(ddl);
  for (const ddl of Object.values(DB_INDEXES)) db.exec(ddl);
  return db;
};

let log: typeof console.log;
beforeEach(() => {
  log = console.log;
  console.log = () => {};
});
afterEach(() => {
  console.log = log;
});

describe('migrations on a fresh install (#128)', () => {
  it('runs every migration on an empty database', async () => {
    const db = new DatabaseSync(':memory:');

    await expect(migrate(db)).resolves.toBeUndefined();
    expect(version(db)).toBe(latest);

    db.close();
  });

  it('ends with the schema the repositories expect', async () => {
    const db = new DatabaseSync(':memory:');
    await migrate(db);

    // No allowance for `longitude`: 001 creates it, 005 empties it and 006
    // drops it (#133), so a new install matches DB_SCHEMA exactly.
    const expected = current();
    expect(shapeOf(db)).toEqual(shapeOf(expected));

    expected.close();
    db.close();
  });

  it('does nothing on the next launch', async () => {
    const db = new DatabaseSync(':memory:');
    await migrate(db);
    const before = shapeOf(db);

    await expect(migrate(db)).resolves.toBeUndefined();
    expect(version(db)).toBe(latest);
    expect(shapeOf(db)).toEqual(before);

    db.close();
  });
});

/**
 * What the old migration 001 left behind: the then-current schema, marked as
 * version 1. Every launch since has failed at 002.
 *
 * There are two such shapes. `DB_SCHEMA` still had `longitude` until d952654
 * (2026-08-26) -- which is also `main`'s shape -- and has not had it since.
 */
const STUCK_SHAPES = [
  { name: 'installed before longitude was dropped', withLongitude: true },
  { name: 'installed after longitude was dropped', withLongitude: false },
];

describe.each(STUCK_SHAPES)('a device stuck by #128, $name', ({ withLongitude }) => {
  const shape = (): DatabaseSync => {
    const db = current();
    if (withLongitude) {
      db.exec('ALTER TABLE environment_snapshots ADD COLUMN longitude REAL;');
    }
    return db;
  };

  const stuck = (): DatabaseSync => {
    const db = shape();
    db.exec('PRAGMA user_version = 1;');
    return db;
  };

  it('moves forward instead of failing at 002 again', async () => {
    const db = stuck();

    await expect(migrate(db)).resolves.toBeUndefined();
    expect(version(db)).toBe(latest);

    db.close();
  });

  it('ends with the schema the repositories expect', async () => {
    // With or without `longitude` to begin with: 006 drops it when it is there
    // and leaves the table alone when it is not (#133).
    const db = stuck();
    await migrate(db);

    const expected = current();
    expect(shapeOf(db)).toEqual(shapeOf(expected));

    expected.close();
    db.close();
  });

  it('still coarsens its latitudes', async () => {
    const db = stuck();
    db.exec(`
      INSERT INTO environment_snapshots
        (temperature, humidity, pressure, altitude, density_altitude,
         wind_speed, wind_direction, latitude, timestamp)
      VALUES (59, 50, 29.92, 1000, 1200, 5, 90, 39.739236, '2026-01-01T00:00:00.000Z');
    `);

    await migrate(db);

    const row = db.prepare('SELECT latitude FROM environment_snapshots').get() as {
      latitude: number;
    };
    expect(row.latitude).toBe(39.7);
    db.close();
  });
});

/**
 * An install that is up to date apart from #133: migration 005 left
 * `environment_snapshots.longitude` in place, always NULL, and every real
 * install has DOPE logs referencing its snapshots.
 */
describe('an install at version 5, with the emptied longitude column (#133)', () => {
  const atVersion5 = (): DatabaseSync => {
    const db = current();
    db.exec('ALTER TABLE environment_snapshots ADD COLUMN longitude REAL;');
    db.exec(`
      INSERT INTO rifle_profiles
        (name, caliber, barrel_length, twist_rate, zero_distance, optic_manufacturer,
         optic_model, reticle_type, click_value_type, click_value, scope_height)
      VALUES ('Tikka T3x', '.308 Win', 24, 8, 100, 'Vortex', 'Razor', 'EBR-7C', 'MIL', 0.1, 1.5);
      INSERT INTO ammo_profiles
        (name, manufacturer, caliber, bullet_weight, bullet_type,
         ballistic_coefficient_g1, ballistic_coefficient_g7, muzzle_velocity)
      VALUES ('175gr SMK', 'Sierra', '.308 Win', 175, 'HPBT', 0.505, 0.243, 2650);
      INSERT INTO environment_snapshots
        (temperature, humidity, pressure, altitude, density_altitude,
         wind_speed, wind_direction, latitude, longitude, timestamp)
      VALUES (41, 73, 28.61, 1250, 2000, 12, 270, 39.7, NULL, '2026-01-01T00:00:00.000Z');
      INSERT INTO dope_logs
        (rifle_id, ammo_id, environment_id, distance, distance_unit,
         elevation_correction, windage_correction, correction_unit, target_type, timestamp)
      VALUES (1, 1, 1, 400, 'yards', 2.9, -0.5, 'MIL', 'steel', '2026-01-01T00:00:00.000Z');
      PRAGMA user_version = 5;
    `);
    return db;
  };

  it('drops the column and ends with the schema the repositories expect', async () => {
    const db = atVersion5();
    await migrate(db);

    expect(version(db)).toBe(latest);
    const expected = current();
    expect(shapeOf(db)).toEqual(shapeOf(expected));

    expected.close();
    db.close();
  });

  it('keeps the snapshot, its readings and the log that references it', async () => {
    const db = atVersion5();
    await migrate(db);

    expect(db.prepare('SELECT temperature, latitude FROM environment_snapshots').all()).toEqual([
      { temperature: 41, latitude: 39.7 },
    ]);
    expect(
      db
        .prepare(
          `SELECT l.distance, e.wind_direction FROM dope_logs l
             JOIN environment_snapshots e ON e.id = l.environment_id`
        )
        .all()
    ).toEqual([{ distance: 400, wind_direction: 270 }]);
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(db.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });

    db.close();
  });
});
