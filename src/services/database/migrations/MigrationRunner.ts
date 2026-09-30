import * as SQLite from 'expo-sqlite';

import databaseService from '../DatabaseService';

export interface Migration {
  version: number;
  name: string;
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
  down: (db: SQLite.SQLiteDatabase) => Promise<void>;
}

/**
 * Run one migration with foreign keys suspended, per SQLite's documented
 * table-rebuild procedure.
 *
 * A migration that rebuilds a table (create new, copy, `DROP TABLE`, rename) is
 * unsafe with foreign keys enforced, and unsafe in two different ways depending on
 * the child's delete action:
 *
 * - plain `FOREIGN KEY` -> `DROP TABLE` raises `FOREIGN KEY constraint failed` and
 *   the migration aborts;
 * - `ON DELETE CASCADE` -> `DROP TABLE` performs an implicit `DELETE FROM`, the
 *   cascade fires, and **every child row is silently deleted**. No error. The app
 *   reports a successful migration over a table that has just been emptied.
 *
 * The second is what migration 004 did: `dope_logs.ammo_id` cascades from
 * `ammo_profiles`, so rebuilding that table wiped the user's entire DOPE history
 * while reporting success. See issue #52.
 *
 * `PRAGMA foreign_keys` is a documented no-op inside a transaction, so a migration
 * cannot protect itself — the pragma has to be set out here, around the
 * transaction. `PRAGMA foreign_key_check` then verifies the result before the
 * commit, which is what makes suspending enforcement safe rather than merely quiet.
 *
 * @param db - The database to migrate.
 * @param work - What to run inside the transaction.
 */
const withForeignKeysSuspended = async (
  db: SQLite.SQLiteDatabase,
  work: (txDb: SQLite.SQLiteDatabase) => Promise<void>
): Promise<void> => {
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await databaseService.transaction(async (txDb) => {
      await work(txDb);

      // Enforcement was off, so nothing checked referential integrity as we went.
      // This is that check, and it runs before the commit so a migration that
      // orphans a row rolls back instead of persisting the damage.
      const violations = await txDb.getAllAsync<Record<string, unknown>>(
        'PRAGMA foreign_key_check'
      );
      if (violations.length > 0) {
        throw new Error(
          `Migration left ${violations.length} foreign key violation(s): ` +
            JSON.stringify(violations.slice(0, 5))
        );
      }
    });
  } finally {
    // Restored even when the migration threw: leaving enforcement off would let
    // every later write corrupt the database silently.
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
};

class MigrationRunner {
  private migrations: Migration[] = [];

  /**
   * Register a migration
   */
  register(migration: Migration): void {
    this.migrations.push(migration);
    this.migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * Run all pending migrations
   */
  async runPendingMigrations(): Promise<void> {
    const currentVersion = await databaseService.getDatabaseVersion();

    console.log(`Current database version: ${currentVersion}`);

    const pendingMigrations = this.migrations.filter((m) => m.version > currentVersion);

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Running ${pendingMigrations.length} pending migration(s)`);

    for (const migration of pendingMigrations) {
      try {
        console.log(`Running migration ${migration.version}: ${migration.name}`);
        await withForeignKeysSuspended(databaseService.getDatabase(), async (txDb) => {
          await migration.up(txDb);
          await txDb.execAsync(`PRAGMA user_version = ${migration.version};`);
        });
        console.log(`Migration ${migration.version} completed successfully`);
      } catch (error) {
        console.error(`Migration ${migration.version} failed:`, error);
        throw new Error(`Migration ${migration.version} failed: ${error}`);
      }
    }

    console.log('All migrations completed successfully');
  }

  /**
   * Rollback to a specific version
   */
  async rollbackTo(targetVersion: number): Promise<void> {
    const currentVersion = await databaseService.getDatabaseVersion();

    if (targetVersion >= currentVersion) {
      console.log('Target version is not lower than current version');
      return;
    }

    const migrationsToRollback = this.migrations
      .filter((m) => m.version > targetVersion && m.version <= currentVersion)
      .sort((a, b) => b.version - a.version); // Reverse order for rollback

    console.log(`Rolling back ${migrationsToRollback.length} migration(s)`);

    for (const migration of migrationsToRollback) {
      try {
        console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
        // A `down()` rebuilds tables for the same reasons an `up()` does, so it
        // carries the same hazard and gets the same protection.
        await withForeignKeysSuspended(databaseService.getDatabase(), async (txDb) => {
          await migration.down(txDb);
          await txDb.execAsync(`PRAGMA user_version = ${migration.version - 1};`);
        });
        console.log(`Migration ${migration.version} rolled back successfully`);
      } catch (error) {
        console.error(`Rollback of migration ${migration.version} failed:`, error);
        throw new Error(`Rollback of migration ${migration.version} failed: ${error}`);
      }
    }

    console.log('Rollback completed successfully');
  }

  /**
   * Get list of all migrations
   */
  getMigrations(): Migration[] {
    return [...this.migrations];
  }

  /**
   * Get current migration status
   */
  async getStatus(): Promise<{
    currentVersion: number;
    latestVersion: number;
    pendingCount: number;
  }> {
    const currentVersion = await databaseService.getDatabaseVersion();
    const latestVersion =
      this.migrations.length > 0 ? Math.max(...this.migrations.map((m) => m.version)) : 0;
    const pendingCount = this.migrations.filter((m) => m.version > currentVersion).length;

    return {
      currentVersion,
      latestVersion,
      pendingCount,
    };
  }
}

export const migrationRunner = new MigrationRunner();
export default migrationRunner;
