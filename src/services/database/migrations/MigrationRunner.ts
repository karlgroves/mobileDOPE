import * as SQLite from 'expo-sqlite';
import databaseService from '../DatabaseService';

export interface Migration {
  version: number;
  name: string;
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
  down: (db: SQLite.SQLiteDatabase) => Promise<void>;
}

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
        await databaseService.transaction(async (txDb) => {
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
        await databaseService.transaction(async (txDb) => {
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
