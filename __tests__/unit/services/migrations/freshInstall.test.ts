import { DatabaseSync } from 'node:sqlite';

import { migrationRunner } from '../../../../src/services/database/migrations';
import { DB_INDEXES, DB_SCHEMA } from '../../../../src/types/database.types';

import type * as SQLite from 'expo-sqlite';

// The migration registry pulls in DatabaseService, which imports expo-sqlite at
// module scope. These tests drive migrations directly against node:sqlite and
// never touch the singleton, so a bare stub is enough.
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

/**
 * A new user's database: empty, then every migration in order (#128).
 *
 * Migration 001 used to create its tables from the live `DB_SCHEMA`, which had
 * already moved on to the shape later migrations produce. On an empty database
 * 001 built `ammo_profiles` with `caliber`, and 002 then failed adding it again,
 * so a fresh install never got past launch. Nothing ran the migrations from an
 * empty database, which is the only path a new user takes.
 */

/** Adapter matching how MigrationRunner drives a migration. */
const adapt = (db: DatabaseSync): SQLite.SQLiteDatabase =>
  ({
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    getAllAsync: async <T>(sql: string) => db.prepare(sql).all() as T[],
  }) as unknown as SQLite.SQLiteDatabase;

/** Run every registered migration above `fromVersion`, as the runner does. */
const migrate = async (db: DatabaseSync, fromVersion = 0): Promise<void> => {
  for (const migration of migrationRunner.getMigrations()) {
    if (migration.version <= fromVersion) continue;
    await migration.up(adapt(db));
    db.exec(`PRAGMA user_version = ${migration.version};`);
  }
};

const TABLES = Object.values(DB_SCHEMA).map(
  (ddl) => /CREATE TABLE IF NOT EXISTS (\w+)/.exec(ddl)?.[1] as string
);

/** Column names of every table, and every index name. Order-insensitive. */
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
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'")
      .all() as { name: string }[]
  )
    .map((i) => i.name)
    .sort(),
});

/** The schema the app's repositories are written against. */
const current = (): DatabaseSync => {
  const db = new DatabaseSync(':memory:');
  for (const ddl of Object.values(DB_SCHEMA)) db.exec(ddl);
  for (const ddl of Object.values(DB_INDEXES)) db.exec(ddl);
  return db;
};

describe('migrations on a fresh install (#128)', () => {
  let log: typeof console.log;
  beforeEach(() => {
    log = console.log;
    console.log = () => {};
  });
  afterEach(() => {
    console.log = log;
  });

  it('runs every migration on an empty database', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');

    await expect(migrate(db)).resolves.toBeUndefined();

    db.close();
  });

  it('ends with the schema the repositories expect', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    await migrate(db);

    // Migration 005 empties `longitude` rather than dropping it, and says why;
    // DB_SCHEMA leaves it out. That is the one intended difference.
    const expected = current();
    expected.exec('ALTER TABLE environment_snapshots ADD COLUMN longitude REAL;');
    expect(shapeOf(db)).toEqual(shapeOf(expected));

    expected.close();
    db.close();
  });
});

describe('a device already stuck by #128', () => {
  let log: typeof console.log;
  beforeEach(() => {
    log = console.log;
    console.log = () => {};
  });
  afterEach(() => {
    console.log = log;
  });

  /**
   * What the old migration 001 left behind: the then-current schema, marked as
   * version 1. Every launch since has failed at 002.
   */
  const stuck = (): DatabaseSync => {
    const db = current();
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA user_version = 1;');
    return db;
  };

  it('moves forward instead of failing at 002 again', async () => {
    const db = stuck();

    await expect(migrate(db, 1)).resolves.toBeUndefined();

    db.close();
  });

  it('still coarsens its latitudes, with no longitude column to clear', async () => {
    const db = stuck();
    db.exec(`
      INSERT INTO environment_snapshots
        (temperature, humidity, pressure, altitude, density_altitude,
         wind_speed, wind_direction, latitude, timestamp)
      VALUES (59, 50, 29.92, 1000, 1200, 5, 90, 39.739236, '2026-01-01T00:00:00.000Z');
    `);

    await migrate(db, 1);

    const row = db.prepare('SELECT latitude FROM environment_snapshots').get() as {
      latitude: number;
    };
    expect(row.latitude).toBe(39.7);
    db.close();
  });

  it('keeps the schema it already had', async () => {
    const db = stuck();
    await migrate(db, 1);

    const expected = current();
    expect(shapeOf(db)).toEqual(shapeOf(expected));

    expected.close();
    db.close();
  });
});
