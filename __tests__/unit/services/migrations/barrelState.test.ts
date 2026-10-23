import { DatabaseSync } from 'node:sqlite';

import migration007 from '../../../../src/services/database/migrations/007_add_barrel_state_to_dope_logs';
import { DB_SCHEMA } from '../../../../src/types/database.types';

import type * as SQLite from 'expo-sqlite';

/**
 * Migration 007 adds the barrel-state columns to `dope_logs` (#164).
 *
 * `range_sessions` has had `cold_bore_shot` since 001, but a DOPE log carried
 * nothing about barrel state, so no log could be analysed for cold-bore bias or
 * heat shift (#165 needs both).
 *
 * The two risks this covers are the ones 006 wrote down: that `ADD COLUMN` is
 * used rather than a table rebuild -- `dope_logs` is referenced `ON DELETE
 * CASCADE` and rebuilding it is what destroyed every log in #52 -- and that a
 * database which already has the columns moves forward instead of failing on
 * every launch, which is the shape a device stuck by #128 arrives in.
 */

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const adapt = (db: DatabaseSync) =>
  ({
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    getAllAsync: async <T>(sql: string) => db.prepare(sql).all() as T[],
  }) as unknown as SQLite.SQLiteDatabase;

/** `dope_logs` as it stood before 007: the production DDL with the two columns removed. */
const beforeMigration = (): DatabaseSync => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const [name, ddl] of Object.entries(DB_SCHEMA)) {
    db.exec(
      name === 'DOPE_LOG'
        ? ddl.replace(/\s*cold_bore_shot INTEGER,\n\s*shot_number_in_session INTEGER,/, '')
        : ddl
    );
  }
  return db;
};

const columns = (db: DatabaseSync, table: string): string[] =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);

/** One rifle, ammo, environment and DOPE log, so a cascade has something to destroy. */
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
      VALUES (1, 1, 1, 600, 'yards', 4.1, 0.3, 'MIL', 'steel');
  `);
};

const logCount = (db: DatabaseSync): number =>
  (db.prepare('SELECT COUNT(*) AS n FROM dope_logs').get() as { n: number }).n;

let log: typeof console.log;
beforeEach(() => {
  log = console.log;
  console.log = () => {};
});
afterEach(() => {
  console.log = log;
});

describe('migration 007, barrel state on dope_logs (#164)', () => {
  it('is registered at version 7', () => {
    expect(migration007.version).toBe(7);
  });

  it('adds both columns', async () => {
    const db = beforeMigration();
    expect(columns(db, 'dope_logs')).not.toContain('cold_bore_shot');

    await migration007.up(adapt(db));

    expect(columns(db, 'dope_logs')).toEqual(
      expect.arrayContaining(['cold_bore_shot', 'shot_number_in_session'])
    );
    db.close();
  });

  it('leaves both columns NULL on the logs that already existed', async () => {
    // Nullable on purpose: barrel state is unknown for a log recorded before
    // the app asked. Defaulting cold_bore_shot to 0 would assert "warm bore"
    // about shots nobody recorded, and #165 would then average that in.
    const db = beforeMigration();
    seed(db);

    await migration007.up(adapt(db));

    const row = db
      .prepare('SELECT cold_bore_shot, shot_number_in_session FROM dope_logs WHERE id = 1')
      .get() as { cold_bore_shot: number | null; shot_number_in_session: number | null };
    expect(row.cold_bore_shot).toBeNull();
    expect(row.shot_number_in_session).toBeNull();

    db.close();
  });

  it('destroys no rows', async () => {
    // `dope_logs` is the table #52 emptied, by rebuilding a parent it
    // references ON DELETE CASCADE. ADD COLUMN cannot do that; this is the
    // assertion that keeps it ADD COLUMN.
    const db = beforeMigration();
    seed(db);
    expect(logCount(db)).toBe(1);

    await migration007.up(adapt(db));

    expect(logCount(db)).toBe(1);
    db.close();
  });

  it('does nothing when the columns are already there', async () => {
    // The shape a device stuck by #128 arrives in: DB_SCHEMA's columns, an old
    // user_version. A second ADD COLUMN would throw and the launch would fail.
    const db = new DatabaseSync(':memory:');
    for (const ddl of Object.values(DB_SCHEMA)) db.exec(ddl);

    await expect(migration007.up(adapt(db))).resolves.toBeUndefined();

    expect(columns(db, 'dope_logs').filter((c) => c === 'cold_bore_shot')).toHaveLength(1);
    db.close();
  });

  it('is idempotent across two runs', async () => {
    const db = beforeMigration();
    await migration007.up(adapt(db));
    const after = columns(db, 'dope_logs');

    await expect(migration007.up(adapt(db))).resolves.toBeUndefined();

    expect(columns(db, 'dope_logs')).toEqual(after);
    db.close();
  });

  describe('down', () => {
    it('removes both columns again', async () => {
      const db = beforeMigration();
      await migration007.up(adapt(db));

      await migration007.down(adapt(db));

      expect(columns(db, 'dope_logs')).not.toContain('cold_bore_shot');
      expect(columns(db, 'dope_logs')).not.toContain('shot_number_in_session');
      db.close();
    });

    it('does nothing when they are already gone', async () => {
      const db = beforeMigration();

      await expect(migration007.down(adapt(db))).resolves.toBeUndefined();

      db.close();
    });

    it('keeps the logs', async () => {
      const db = beforeMigration();
      seed(db);
      await migration007.up(adapt(db));

      await migration007.down(adapt(db));

      expect(logCount(db)).toBe(1);
      db.close();
    });
  });
});
