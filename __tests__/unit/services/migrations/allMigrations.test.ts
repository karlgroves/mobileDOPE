import { DatabaseSync } from 'node:sqlite';

import { migrationRunner } from '../../../../src/services/database/migrations';
import { DB_INDEXES, DB_SCHEMA } from '../../../../src/types/database.types';

import type * as SQLite from 'expo-sqlite';

// The migration registry pulls in DatabaseService, which imports expo-sqlite at
// module scope. These tests drive migrations directly against node:sqlite and
// never touch the singleton, so a bare stub is enough.
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

/**
 * Every registered migration, run against a fully-populated database with foreign
 * keys enforced exactly as `DatabaseService.initialize()` sets them.
 *
 * This exists because migration 004 destroyed data and nothing noticed. It
 * rebuilds `ammo_profiles` (create new, copy, `DROP TABLE`, rename), and
 * `dope_logs.ammo_id` references that table `ON DELETE CASCADE` -- so the implicit
 * `DELETE FROM` behind `DROP TABLE` cascaded and removed **every DOPE log**. No
 * error was raised; the runner reported success over an emptied table.
 *
 * Per-migration suites did not catch it because each seeded only the table it was
 * interested in. The hazard only exists when a *child* row is present, which is
 * precisely what a per-migration fixture leaves out. So the guard has to be here,
 * across all of them, on a database that actually has data in it.
 *
 * See issue #52.
 */

/** Row counts for every table a migration could plausibly disturb. */
interface Census {
  rifle_profiles: number;
  ammo_profiles: number;
  environment_snapshots: number;
  dope_logs: number;
  shot_strings: number;
  range_sessions: number;
}

const TABLES: (keyof Census)[] = [
  'rifle_profiles',
  'ammo_profiles',
  'environment_snapshots',
  'dope_logs',
  'shot_strings',
  'range_sessions',
];

/**
 * The schema as it stood at version 1, before any migration ran.
 *
 * Built from the production DDL with the columns later migrations remove added
 * back, so the migrations under test have something real to operate on.
 */
const createVersion1Database = (): DatabaseSync => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');

  for (const [name, ddl] of Object.entries(DB_SCHEMA)) {
    if (name === 'AMMO_PROFILE') {
      // Pre-004: ammo belonged to a rifle, and pre-002 it had no caliber.
      db.exec(`
        CREATE TABLE IF NOT EXISTS ammo_profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rifle_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          manufacturer TEXT NOT NULL,
          bullet_weight REAL NOT NULL,
          bullet_type TEXT NOT NULL,
          ballistic_coefficient_g1 REAL NOT NULL,
          ballistic_coefficient_g7 REAL NOT NULL,
          muzzle_velocity REAL NOT NULL,
          powder_type TEXT,
          powder_weight REAL,
          lot_number TEXT,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (rifle_id) REFERENCES rifle_profiles(id) ON DELETE CASCADE
        );
      `);
      continue;
    }
    if (name === 'ENVIRONMENT_SNAPSHOT') {
      // Pre-005: longitude was still stored.
      db.exec(`
        CREATE TABLE IF NOT EXISTS environment_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          temperature REAL NOT NULL, humidity REAL NOT NULL, pressure REAL NOT NULL,
          altitude REAL NOT NULL, density_altitude REAL NOT NULL,
          wind_speed REAL NOT NULL, wind_direction REAL NOT NULL,
          latitude REAL, longitude REAL,
          timestamp TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      continue;
    }
    db.exec(ddl);
  }
  for (const ddl of Object.values(DB_INDEXES)) {
    // Indexes on columns that no longer exist at v1 are skipped.
    try {
      db.exec(ddl);
    } catch {
      /* index references a post-migration column */
    }
  }
  return db;
};

/** Populate every table, so a cascade has something to destroy. */
const seed = (db: DatabaseSync): void => {
  db.exec(`
    INSERT INTO rifle_profiles
      (name, caliber, barrel_length, twist_rate, zero_distance,
       optic_manufacturer, optic_model, reticle_type, click_value_type,
       click_value, scope_height)
    VALUES ('Tikka T3x', '.308 Win', 24, 8, 100, 'Vortex', 'Razor HD', 'EBR-7C',
            'MIL', 0.1, 1.5);

    INSERT INTO ammo_profiles
      (rifle_id, name, manufacturer, bullet_weight, bullet_type,
       ballistic_coefficient_g1, ballistic_coefficient_g7, muzzle_velocity)
    VALUES (1, '175gr SMK', 'Sierra', 175, 'HPBT', 0.505, 0.243, 2650);

    INSERT INTO environment_snapshots
      (temperature, humidity, pressure, altitude, density_altitude,
       wind_speed, wind_direction, latitude, longitude, timestamp)
    VALUES (59, 50, 29.92, 1000, 1200, 5, 90, 39.739236, -104.990251,
            '2026-01-01T00:00:00.000Z');

    INSERT INTO dope_logs
      (rifle_id, ammo_id, environment_id, distance, distance_unit,
       elevation_correction, windage_correction, correction_unit,
       target_type, timestamp)
    VALUES (1, 1, 1, 500, 'yards', 3.4, 0.5, 'MIL', 'steel',
            '2026-01-01T00:00:00.000Z'),
           (1, 1, 1, 800, 'yards', 6.1, 1.2, 'MIL', 'steel',
            '2026-01-01T00:00:00.000Z');

    INSERT INTO shot_strings (ammo_id, session_date, shot_number, velocity, temperature)
    VALUES (1, '2026-01-01', 1, 2648, 59),
           (1, '2026-01-01', 2, 2655, 59);

    INSERT INTO range_sessions
      (rifle_id, ammo_id, environment_id, start_time, distance, shot_count,
       cold_bore_shot)
    VALUES (1, 1, 1, '2026-01-01T09:00:00.000Z', 500, 5, 0);
  `);
};

const census = (db: DatabaseSync): Census =>
  Object.fromEntries(
    TABLES.map((table) => [
      table,
      (db.prepare(`SELECT COUNT(*) c FROM ${table}`).get() as unknown as { c: number }).c,
    ])
  ) as unknown as Census;

/**
 * Adapter matching how MigrationRunner drives a migration: `execAsync` for DDL
 * plus `getAllAsync` for the foreign-key check.
 */
const adapt = (db: DatabaseSync): SQLite.SQLiteDatabase =>
  ({
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    getAllAsync: async <T>(sql: string) => db.prepare(sql).all() as T[],
  }) as unknown as SQLite.SQLiteDatabase;

describe('every registered migration, against a populated database', () => {
  const migrations = migrationRunner.getMigrations();
  let log: typeof console.log;

  beforeEach(() => {
    log = console.log;
    console.log = () => {};
  });
  afterEach(() => {
    console.log = log;
  });

  it('has migrations registered, so this suite cannot pass vacuously', () => {
    expect(migrations.length).toBeGreaterThanOrEqual(5);
  });

  it('seeds every table, so a cascade has something to destroy', () => {
    // Without this, the per-migration assertions below could pass by comparing
    // zero to zero.
    const db = createVersion1Database();
    seed(db);

    const empty = TABLES.filter((table) => census(db)[table] === 0);
    expect(empty).toEqual([]);

    db.close();
  });

  it('runs the whole chain in order, destroying nothing', async () => {
    // Sequential, because migrations are. Running each against a v1 fixture in
    // isolation is not how they execute -- 003 assumes 002 has run, and so on.
    //
    // Migration 001 is excluded deliberately: it creates the schema rather than
    // migrating data, and its `up()` has been updated over time to emit the
    // CURRENT schema. Replaying it does not reproduce the v1 state that the later
    // migrations were written against, which is what the fixture supplies instead.
    const db = createVersion1Database();
    seed(db);
    const before = census(db);

    for (const migration of migrations.filter((m) => m.version > 1)) {
      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec('BEGIN');
      await migration.up(adapt(db));
      db.exec('COMMIT');
      db.exec('PRAGMA foreign_keys = ON;');

      // Checked after EVERY step, so a failure names the migration that caused it
      // rather than just the end state.
      expect({ after: migration.version, census: census(db) }).toEqual({
        after: migration.version,
        census: before,
      });
      expect({
        after: migration.version,
        violations: db.prepare('PRAGMA foreign_key_check').all(),
      }).toEqual({ after: migration.version, violations: [] });
    }

    db.close();
  });

  it('is destroyed by the unprotected rebuild that migration 004 used', async () => {
    // The counter-test. Without `PRAGMA foreign_keys = OFF`, migration 004's
    // rebuild completes cleanly and cascades away every dope_logs row -- no error,
    // no foreign_key_check violation, just an emptied table. This pins the hazard
    // itself, so a future migration reintroducing the pattern is recognisable.
    const db = createVersion1Database();
    seed(db);
    const before = census(db);

    // 002 and 003 first, protected: 004 references the `caliber` column 002 adds.
    for (const migration of migrations.filter((m) => m.version === 2 || m.version === 3)) {
      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec('BEGIN');
      await migration.up(adapt(db));
      db.exec('COMMIT');
      db.exec('PRAGMA foreign_keys = ON;');
    }

    const migration004 = migrations.find((m) => m.version === 4);
    expect(migration004).toBeDefined();

    // Foreign keys left ON, as MigrationRunner used to leave them.
    db.exec('BEGIN');
    await (migration004 as (typeof migrations)[number]).up(adapt(db));
    db.exec('COMMIT');

    const after = census(db);
    expect(after.dope_logs).toBe(0);
    expect(before.dope_logs).toBeGreaterThan(0);
    // And nothing complains, which is what made it dangerous.
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);

    db.close();
  });
});
