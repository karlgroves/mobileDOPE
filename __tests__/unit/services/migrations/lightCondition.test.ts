import { DatabaseSync } from 'node:sqlite';

import { migrationRunner } from '../../../../src/services/database/migrations';
import migration009 from '../../../../src/services/database/migrations/009_add_light_condition';
import { DB_SCHEMA } from '../../../../src/types/database.types';

import type * as SQLite from 'expo-sqlite';

/**
 * Migration 009 records the light a reading was taken in (#62).
 *
 * The shooter's own reading of the light -- day, low light or night -- had
 * nowhere to live on `environment_snapshots`. NULL means "not recorded", which
 * is the truth for every reading saved before this; a default of `day` would
 * claim daylight for shots nobody described.
 */

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const adapt = (db: DatabaseSync) =>
  ({
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    getAllAsync: async <T>(sql: string) => db.prepare(sql).all() as T[],
  }) as unknown as SQLite.SQLiteDatabase;

/** `environment_snapshots` as it stood before 009: the production DDL without the column. */
const beforeMigration = (): DatabaseSync => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const [name, ddl] of Object.entries(DB_SCHEMA)) {
    db.exec(
      name === 'ENVIRONMENT_SNAPSHOT' ? ddl.replace(/\s*light_condition TEXT[^,]*,/, '') : ddl
    );
  }
  return db;
};

const columns = (db: DatabaseSync, table: string): string[] =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);

const seed = (db: DatabaseSync): void => {
  db.exec(`
    INSERT INTO environment_snapshots (temperature, humidity, pressure, altitude,
      density_altitude, wind_speed, wind_direction)
      VALUES (59, 50, 29.92, 0, 0, 5, 90);
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

describe('migration 009, light condition on environment_snapshots (#62)', () => {
  it('is registered at version 9', () => {
    expect(migration009.version).toBe(9);
    expect(migrationRunner.getMigrations().map((m) => m.version)).toContain(9);
  });

  it('adds the column', async () => {
    const db = beforeMigration();
    expect(columns(db, 'environment_snapshots')).not.toContain('light_condition');

    await migration009.up(adapt(db));

    expect(columns(db, 'environment_snapshots')).toContain('light_condition');
    db.close();
  });

  it('leaves an existing reading unrecorded rather than calling it daylight', async () => {
    const db = beforeMigration();
    seed(db);

    await migration009.up(adapt(db));

    const row = db
      .prepare('SELECT light_condition FROM environment_snapshots WHERE id = 1')
      .get() as {
      light_condition: string | null;
    };
    expect(row.light_condition).toBeNull();
    expect(count(db, 'environment_snapshots')).toBe(1);
    db.close();
  });

  it('does nothing when the column is already there', async () => {
    const db = new DatabaseSync(':memory:');
    for (const ddl of Object.values(DB_SCHEMA)) db.exec(ddl);

    await expect(migration009.up(adapt(db))).resolves.toBeUndefined();

    expect(
      columns(db, 'environment_snapshots').filter((c) => c === 'light_condition')
    ).toHaveLength(1);
    db.close();
  });

  describe('down', () => {
    it('removes the column and keeps the readings', async () => {
      const db = beforeMigration();
      seed(db);
      await migration009.up(adapt(db));

      await migration009.down(adapt(db));

      expect(columns(db, 'environment_snapshots')).not.toContain('light_condition');
      expect(count(db, 'environment_snapshots')).toBe(1);
      db.close();
    });

    it('does nothing when it is already gone', async () => {
      const db = beforeMigration();
      await expect(migration009.down(adapt(db))).resolves.toBeUndefined();
      db.close();
    });
  });
});
