import { DatabaseSync } from 'node:sqlite';

import databaseService from '../../src/services/database/DatabaseService';
import { DB_INDEXES, DB_SCHEMA } from '../../src/types/database.types';

/**
 * A real SQLite database for service-layer tests.
 *
 * The repositories are almost entirely SQL, so stubbing `expo-sqlite` with canned return
 * values would test nothing that matters -- a stub cannot enforce NOT NULL, CHECK
 * constraints, foreign keys, AUTOINCREMENT or ORDER BY. This instead adapts Node's
 * built-in `node:sqlite` (available because package.json requires node >= 24.15.0) to
 * expo-sqlite's async API, so tests run the production DDL from `DB_SCHEMA` against a
 * real engine, in memory.
 *
 * Used by every `__tests__/unit/services/**` suite. See issue #28 phase 2.
 */

/** expo-sqlite's `SQLiteRunResult`. */
export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

/** The subset of expo-sqlite's `SQLiteDatabase` that this codebase actually calls. */
export interface TestDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: readonly unknown[]): Promise<RunResult>;
  getFirstAsync<T>(sql: string, params?: readonly unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  closeAsync(): Promise<void>;
}

type BindValue = null | number | string | bigint | Uint8Array;

/**
 * `node:sqlite` accepts only null/number/string/bigint/Uint8Array. expo-sqlite tolerates
 * `undefined` (treating it as NULL), and the repositories pass `undefined` for optional
 * columns, so normalise before binding rather than letting the driver throw.
 */
const toBindValue = (value: unknown): BindValue => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (
    typeof value === 'number' ||
    typeof value === 'string' ||
    typeof value === 'bigint' ||
    value instanceof Uint8Array
  ) {
    return value;
  }
  // Objects/arrays would bind as garbage; failing loudly beats a silently wrong row.
  throw new TypeError(`Cannot bind value of type ${typeof value} to SQLite: ${String(value)}`);
};

const bind = (params: readonly unknown[] = []): BindValue[] => params.map(toBindValue);

/**
 * Creates an in-memory database with the production schema and indexes applied.
 * Foreign keys are ON, matching `DatabaseService.initialize()`.
 */
export const createTestDatabase = (): TestDatabase => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const ddl of Object.values(DB_SCHEMA)) db.exec(ddl);
  for (const ddl of Object.values(DB_INDEXES)) db.exec(ddl);

  return {
    execAsync: async (sql) => {
      db.exec(sql);
    },
    runAsync: async (sql, params) => {
      const result = db.prepare(sql).run(...bind(params));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    getFirstAsync: async <T>(sql: string, params?: readonly unknown[]) =>
      (db.prepare(sql).get(...bind(params)) as T | undefined) ?? null,
    getAllAsync: async <T>(sql: string, params?: readonly unknown[]) =>
      db.prepare(sql).all(...bind(params)) as T[],
    closeAsync: async () => {
      db.close();
    },
  };
};

/**
 * The database handed to `expo-sqlite.openDatabaseAsync` by the mock in each suite.
 * Module-level because `jest.mock` factories are hoisted and cannot close over test state.
 */
let active: TestDatabase | null = null;

/** Stands in for `expo-sqlite`'s `openDatabaseAsync`. */
export const openDatabaseAsync = async (): Promise<TestDatabase> => {
  if (!active) {
    throw new Error('No test database installed. Call installTestDatabase() in beforeEach.');
  }
  return active;
};

/**
 * `initialize()` and `close()` each log on success. Across a few hundred service tests
 * that buries real output, so silence just those two calls rather than stubbing
 * `console.log` for the whole suite (which would also hide logging from code under test).
 */
const quietly = async (fn: () => Promise<void>): Promise<void> => {
  const log = console.log;
  console.log = () => {};
  try {
    await fn();
  } finally {
    console.log = log;
  }
};

/**
 * Point `databaseService` at a fresh in-memory database.
 *
 * Goes through the real `initialize()`/`close()` rather than poking the singleton's private
 * fields, so those paths are covered too. Call from `beforeEach` for per-test isolation.
 */
export const installTestDatabase = async (): Promise<TestDatabase> => {
  await quietly(() => databaseService.close());
  active = createTestDatabase();
  await quietly(() => databaseService.initialize());
  return active;
};

/** Release the active database. Call from `afterEach`. */
export const uninstallTestDatabase = async (): Promise<void> => {
  await quietly(() => databaseService.close());
  active = null;
};
