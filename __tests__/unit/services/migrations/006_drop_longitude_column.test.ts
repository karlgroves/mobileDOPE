import { DatabaseSync } from 'node:sqlite';

import migration006 from '../../../../src/services/database/migrations/006_drop_longitude_column';

import type * as SQLite from 'expo-sqlite';

/**
 * Migration 006 removes the always-NULL `environment_snapshots.longitude` that
 * 005 left behind (#133). The upgrade itself, through the real runner with DOPE
 * logs referencing the snapshots, is in freshInstall.test.ts; this covers the
 * migration's own contract.
 */

const adapt = (db: DatabaseSync): SQLite.SQLiteDatabase =>
  ({
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    getAllAsync: async <T>(sql: string) => db.prepare(sql).all() as T[],
  }) as unknown as SQLite.SQLiteDatabase;

const columns = (db: DatabaseSync): string[] =>
  (db.prepare('PRAGMA table_info(environment_snapshots)').all() as { name: string }[]).map(
    (c) => c.name
  );

const table = (withLongitude: boolean): DatabaseSync => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE environment_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      latitude REAL,
      ${withLongitude ? 'longitude REAL,' : ''}
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO environment_snapshots (latitude) VALUES (39.7);
  `);
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

describe('migration 006: drop environment_snapshots.longitude (#133)', () => {
  it('is version 6', () => {
    expect(migration006.version).toBe(6);
  });

  it('removes the column and keeps the rows', async () => {
    const db = table(true);

    await migration006.up(adapt(db));

    expect(columns(db)).not.toContain('longitude');
    expect(db.prepare('SELECT latitude FROM environment_snapshots').all()).toEqual([
      { latitude: 39.7 },
    ]);
    db.close();
  });

  it('leaves a table that never had it alone', async () => {
    // A device stuck by #128 on a develop-era schema never had the column.
    const db = table(false);

    await expect(migration006.up(adapt(db))).resolves.toBeUndefined();
    expect(columns(db)).toEqual(['id', 'latitude', 'timestamp']);
    db.close();
  });

  it('puts the column back, empty, on the way down', async () => {
    const db = table(true);
    await migration006.up(adapt(db));

    await migration006.down(adapt(db));
    // Twice, as a rerun would: the second must not fail on a duplicate column.
    await migration006.down(adapt(db));

    expect(columns(db)).toContain('longitude');
    expect(db.prepare('SELECT longitude FROM environment_snapshots').all()).toEqual([
      { longitude: null },
    ]);
    db.close();
  });
});
