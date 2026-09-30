import { migrationRunner } from '../../../../src/services/database/migrations';
import { installTestDatabase, uninstallTestDatabase } from '../../../helpers/testDatabase';

import type { TestDatabase } from '../../../helpers/testDatabase';

jest.mock('expo-sqlite', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  openDatabaseAsync: () => require('../../../helpers/testDatabase').openDatabaseAsync(),
}));

/**
 * What `MigrationRunner` leaves behind when a migration fails.
 *
 * Separate from `migrationRunner.test.ts` because this registers a throwing
 * migration on the module singleton, and `getMigrations()` returns a copy — there
 * is no way to deregister it, so a stray version-99 migration would fail every
 * later test in the same file. A separate file gets a fresh module registry.
 *
 * See issue #52.
 */
describe('MigrationRunner failure handling', () => {
  let db: TestDatabase;
  let log: typeof console.log;
  let errorLog: typeof console.error;

  beforeEach(async () => {
    db = await installTestDatabase();
    log = console.log;
    errorLog = console.error;
    console.log = () => {};
    console.error = () => {};
  });

  afterEach(async () => {
    console.log = log;
    console.error = errorLog;
    await uninstallTestDatabase();
  });

  it('restores foreign key enforcement even when a migration throws', async () => {
    // The `finally` in withForeignKeysSuspended. Enforcement left off after a
    // failed migration would let every subsequent write orphan rows in silence --
    // a worse outcome than the failure itself, and one nothing would report.
    // A fresh test database reports version 0, so every real migration would be
    // pending and 002 would fail on a `caliber` column the current schema already
    // has. Mark the schema current so the throwing migration is the only one left.
    await db.execAsync('PRAGMA user_version = 5;');

    migrationRunner.register({
      version: 99,
      name: 'exploding',
      up: async () => {
        throw new Error('boom');
      },
      down: async () => undefined,
    });

    await expect(migrationRunner.runPendingMigrations()).rejects.toThrow(/boom/);

    const row = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
    expect(row?.foreign_keys).toBe(1);
  });
});
