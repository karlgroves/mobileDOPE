import { DatabaseSync } from 'node:sqlite';

import { migrationRunner } from '../../../../src/services/database/migrations';
import migration008 from '../../../../src/services/database/migrations/008_add_target_scale';
import { DB_SCHEMA } from '../../../../src/types/database.types';

import type * as SQLite from 'expo-sqlite';

/**
 * Migration 008 records the scale a target was marked at (#63).
 *
 * Marks are stored as fractions of the image, so a group can only be put into
 * inches with the target's real width -- and, for a photo that is not square,
 * the image's shape, or every vertical distance comes out wrong. `target_images`
 * had nowhere to keep either. Without them a saved target could be shown but
 * never measured again, and the only measurement left would be `group_size`,
 * frozen at whatever the scale was when it was saved.
 *
 * `ADD COLUMN` only, as 006 and 007 did: `target_images` cascades from both
 * `dope_logs` and `range_sessions`, and nothing here rebuilds a table.
 */

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const adapt = (db: DatabaseSync) =>
  ({
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    getAllAsync: async <T>(sql: string) => db.prepare(sql).all() as T[],
  }) as unknown as SQLite.SQLiteDatabase;

/** `target_images` as it stood before 008: the production DDL without the two columns. */
const beforeMigration = (): DatabaseSync => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const [name, ddl] of Object.entries(DB_SCHEMA)) {
    db.exec(
      name === 'TARGET_IMAGE'
        ? ddl.replace(/\s*target_width_inches REAL,\n\s*aspect_ratio REAL,/, '')
        : ddl
    );
  }
  return db;
};

const columns = (db: DatabaseSync, table: string): string[] =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);

const seed = (db: DatabaseSync): void => {
  db.exec(`
    INSERT INTO rifle_profiles (name, caliber, barrel_length, twist_rate, zero_distance,
      optic_manufacturer, optic_model, reticle_type, click_value_type, click_value, scope_height)
      VALUES ('Tikka', '6.5CM', 24, '1:8', 100, 'Vortex', 'Razor', 'EBR-7C', 'MIL', 0.1, 1.75);
    INSERT INTO ammo_profiles (name, manufacturer, caliber, bullet_weight, bullet_type,
      ballistic_coefficient_g1, ballistic_coefficient_g7, muzzle_velocity)
      VALUES ('ELD-M', 'Hornady', '6.5CM', 147, 'ELD Match', 0.697, 0.351, 2695);
    INSERT INTO environment_snapshots (temperature, humidity, pressure, altitude,
      density_altitude, wind_speed, wind_direction)
      VALUES (59, 50, 29.92, 0, 0, 5, 90);
    INSERT INTO dope_logs (rifle_id, ammo_id, environment_id, distance, distance_unit,
      elevation_correction, windage_correction, correction_unit, target_type)
      VALUES (1, 1, 1, 100, 'yards', 0, 0, 'MIL', 'paper');
    INSERT INTO target_images (dope_log_id, image_uri, target_type, poi_markers, group_size)
      VALUES (1, 'file:///t.jpg', 'photo', '[{"x":0.5,"y":0.5,"shotNumber":1}]', NULL);
  `);
};

const count = (db: DatabaseSync, table: string): number =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

let log: typeof console.log;
beforeEach(() => {
  log = console.log;
  console.log = () => {};
});
afterEach(() => {
  console.log = log;
});

describe('migration 008, target scale on target_images (#63)', () => {
  it('is registered at version 8', () => {
    expect(migration008.version).toBe(8);
    expect(migrationRunner.getMigrations().map((m) => m.version)).toContain(8);
  });

  it('adds both columns', async () => {
    const db = beforeMigration();
    expect(columns(db, 'target_images')).not.toContain('target_width_inches');

    await migration008.up(adapt(db));

    expect(columns(db, 'target_images')).toEqual(
      expect.arrayContaining(['target_width_inches', 'aspect_ratio'])
    );
    db.close();
  });

  it('leaves an existing target unscaled rather than inventing a width for it', async () => {
    // A default width would turn every old group into a confident, made-up
    // size in inches. NULL is the truth: nobody said how big the target was.
    const db = beforeMigration();
    seed(db);

    await migration008.up(adapt(db));

    const row = db
      .prepare('SELECT target_width_inches, aspect_ratio FROM target_images WHERE id = 1')
      .get() as { target_width_inches: number | null; aspect_ratio: number | null };
    expect(row.target_width_inches).toBeNull();
    expect(row.aspect_ratio).toBeNull();
    db.close();
  });

  it('destroys no rows in any table', async () => {
    const db = beforeMigration();
    seed(db);

    await migration008.up(adapt(db));

    expect(count(db, 'target_images')).toBe(1);
    expect(count(db, 'dope_logs')).toBe(1);
    db.close();
  });

  it('does nothing when the columns are already there', async () => {
    const db = new DatabaseSync(':memory:');
    for (const ddl of Object.values(DB_SCHEMA)) db.exec(ddl);

    await expect(migration008.up(adapt(db))).resolves.toBeUndefined();

    expect(columns(db, 'target_images').filter((c) => c === 'aspect_ratio')).toHaveLength(1);
    db.close();
  });

  describe('down', () => {
    it('removes both columns and keeps the targets', async () => {
      const db = beforeMigration();
      seed(db);
      await migration008.up(adapt(db));

      await migration008.down(adapt(db));

      expect(columns(db, 'target_images')).not.toContain('target_width_inches');
      expect(columns(db, 'target_images')).not.toContain('aspect_ratio');
      expect(count(db, 'target_images')).toBe(1);
      db.close();
    });

    it('does nothing when they are already gone', async () => {
      const db = beforeMigration();
      await expect(migration008.down(adapt(db))).resolves.toBeUndefined();
      db.close();
    });
  });
});
