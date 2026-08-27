import ammoProfileRepository from '../../../../src/services/database/AmmoProfileRepository';
import databaseService from '../../../../src/services/database/DatabaseService';
import dopeLogRepository from '../../../../src/services/database/DOPELogRepository';
import environmentRepository from '../../../../src/services/database/EnvironmentRepository';
import { migrationRunner } from '../../../../src/services/database/migrations';
import rifleProfileRepository from '../../../../src/services/database/RifleProfileRepository';
import { validAmmo, validDopeLog, validEnvironment, validRifle } from '../../../helpers/fixtures';
import { installTestDatabase, uninstallTestDatabase } from '../../../helpers/testDatabase';

import type { TestDatabase } from '../../../helpers/testDatabase';

jest.mock('expo-sqlite', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  openDatabaseAsync: () => require('../../../helpers/testDatabase').openDatabaseAsync(),
}));

/**
 * `MigrationRunner` itself, not the migrations it runs.
 *
 * `allMigrations.test.ts` verifies that the migrations are safe when driven with
 * foreign keys suspended. It applies that suspension itself, which means it says
 * nothing about whether the runner does — removing `PRAGMA foreign_keys = OFF`
 * from `MigrationRunner` left that whole suite green.
 *
 * This exercises the real `runPendingMigrations()` against a populated database,
 * so the protection is pinned where it actually lives.
 *
 * The failure path lives in `migrationRunnerFailure.test.ts`: it has to
 * register a throwing migration on the module singleton, and `getMigrations()`
 * returns a copy, so there is no way to deregister it afterwards. A separate
 * file gets a fresh registry. See issue #52.
 */
describe('MigrationRunner foreign-key safety', () => {
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

  /** A rifle, a load, conditions, and two DOPE logs referencing all three. */
  const seed = async (): Promise<void> => {
    const rifleId = (await rifleProfileRepository.create(validRifle())).id as number;
    const ammoId = (await ammoProfileRepository.create(validAmmo())).id as number;
    const environmentId = (await environmentRepository.create(validEnvironment())).id as number;
    const ids = { rifleId, ammoId, environmentId };
    await dopeLogRepository.create(validDopeLog(ids, { distance: 500 }));
    await dopeLogRepository.create(validDopeLog(ids, { distance: 800 }));
  };

  /**
   * Rewind the schema to version 3 so migrations 4 and 5 are pending.
   *
   * `installTestDatabase()` applies the CURRENT `DB_SCHEMA`, which no longer has
   * `environment_snapshots.longitude` -- migration 005 removed it. A real database
   * at version 3 still has that column, so it is added back before rewinding.
   * Without it migration 005 fails on a column that a v3 database would have had.
   */
  const rewindToVersion3 = async (): Promise<void> => {
    await db.execAsync('ALTER TABLE environment_snapshots ADD COLUMN longitude REAL;');
    await db.execAsync('PRAGMA user_version = 3;');
  };

  const count = async (table: string): Promise<number> => {
    const row = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) c FROM ${table}`);
    return row?.c ?? 0;
  };

  it('preserves DOPE logs when a migration rebuilds a referenced table', async () => {
    // Migration 004 rebuilds `ammo_profiles`, which `dope_logs.ammo_id` references
    // ON DELETE CASCADE. With foreign keys enforced, the implicit DELETE behind
    // `DROP TABLE` cascades and empties `dope_logs` -- silently, with no error and
    // a clean foreign_key_check. This is the assertion that catches that.
    await seed();
    expect(await count('dope_logs')).toBe(2);

    await rewindToVersion3();

    await migrationRunner.runPendingMigrations();

    expect(await count('dope_logs')).toBe(2);
    expect(await count('ammo_profiles')).toBe(1);
    expect(await count('rifle_profiles')).toBe(1);
  });

  it('leaves referential integrity intact afterwards', async () => {
    await seed();
    await rewindToVersion3();

    await migrationRunner.runPendingMigrations();

    const violations = await db.getAllAsync<Record<string, unknown>>('PRAGMA foreign_key_check');
    expect(violations).toEqual([]);
  });

  it('restores foreign key enforcement when it is done', async () => {
    // Suspension is only safe if it is temporary. Left off, every later write
    // could orphan rows without complaint.
    await seed();
    await rewindToVersion3();

    await migrationRunner.runPendingMigrations();

    const row = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
    expect(row?.foreign_keys).toBe(1);
  });

  it('advances the schema version', async () => {
    await seed();
    await rewindToVersion3();

    await migrationRunner.runPendingMigrations();

    expect(await databaseService.getDatabaseVersion()).toBeGreaterThanOrEqual(5);
  });
});
