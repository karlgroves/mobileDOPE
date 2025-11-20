import * as SQLite from 'expo-sqlite';
import { DB_SCHEMA, DB_INDEXES } from '../../types/database.types';

const DATABASE_NAME = 'mobiledope.db';
const DATABASE_VERSION = 1;

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initialized = false;

  /**
   * Initialize and open the database connection
   * Note: Use migrations for schema creation, not this method
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      // Enable foreign keys
      await this.db.execAsync('PRAGMA foreign_keys = ON;');
      this.initialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw new Error('Failed to initialize database');
    }
  }

  /**
   * Get the database instance
   */
  getDatabase(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Create all tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) return;

    try {
      // Enable foreign keys
      await this.db.execAsync('PRAGMA foreign_keys = ON;');

      // Create all tables
      await this.db.execAsync(DB_SCHEMA.RIFLE_PROFILE);
      await this.db.execAsync(DB_SCHEMA.AMMO_PROFILE);
      await this.db.execAsync(DB_SCHEMA.ENVIRONMENT_SNAPSHOT);
      await this.db.execAsync(DB_SCHEMA.DOPE_LOG);
      await this.db.execAsync(DB_SCHEMA.SHOT_STRING);
      await this.db.execAsync(DB_SCHEMA.RANGE_SESSION);
      await this.db.execAsync(DB_SCHEMA.TARGET_IMAGE);
      await this.db.execAsync(DB_SCHEMA.APP_SETTINGS);

      console.log('All tables created successfully');
    } catch (error) {
      console.error('Failed to create tables:', error);
      throw error;
    }
  }

  /**
   * Create all indexes for performance optimization
   */
  private async createIndexes(): Promise<void> {
    if (!this.db) return;

    try {
      for (const [name, sql] of Object.entries(DB_INDEXES)) {
        await this.db.execAsync(sql);
      }
      console.log('All indexes created successfully');
    } catch (error) {
      console.error('Failed to create indexes:', error);
      throw error;
    }
  }

  /**
   * Set or update database version
   */
  private async setDatabaseVersion(): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
    } catch (error) {
      console.error('Failed to set database version:', error);
    }
  }

  /**
   * Get current database version
   */
  async getDatabaseVersion(): Promise<number> {
    if (!this.db) return 0;

    try {
      const result = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
      return result?.user_version || 0;
    } catch (error) {
      console.error('Failed to get database version:', error);
      return 0;
    }
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
    const db = this.getDatabase();

    try {
      await db.execAsync('BEGIN TRANSACTION;');
      const result = await callback(db);
      await db.execAsync('COMMIT;');
      return result;
    } catch (error) {
      await db.execAsync('ROLLBACK;');
      throw error;
    }
  }

  /**
   * Drop all tables (use with caution!)
   */
  async dropAllTables(): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.execAsync(`
        DROP TABLE IF EXISTS target_images;
        DROP TABLE IF EXISTS range_sessions;
        DROP TABLE IF EXISTS shot_strings;
        DROP TABLE IF EXISTS dope_logs;
        DROP TABLE IF EXISTS environment_snapshots;
        DROP TABLE IF EXISTS ammo_profiles;
        DROP TABLE IF EXISTS rifle_profiles;
        DROP TABLE IF EXISTS app_settings;
      `);
      console.log('All tables dropped');
    } catch (error) {
      console.error('Failed to drop tables:', error);
      throw error;
    }
  }

  /**
   * Reset database (drop and recreate)
   */
  async reset(): Promise<void> {
    await this.dropAllTables();
    await this.createTables();
    await this.createIndexes();
    console.log('Database reset complete');
  }

  /**
   * Check database integrity
   */
  async checkIntegrity(): Promise<boolean> {
    if (!this.db) return false;

    try {
      const result = await this.db.getFirstAsync<{ integrity_check: string }>(
        'PRAGMA integrity_check;'
      );
      return result?.integrity_check === 'ok';
    } catch (error) {
      console.error('Integrity check failed:', error);
      return false;
    }
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    rifleProfiles: number;
    ammoProfiles: number;
    dopeLogs: number;
    rangeSessions: number;
  }> {
    const db = this.getDatabase();

    try {
      const rifleProfiles = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM rifle_profiles'
      );
      const ammoProfiles = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM ammo_profiles'
      );
      const dopeLogs = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM dope_logs'
      );
      const rangeSessions = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM range_sessions'
      );

      return {
        rifleProfiles: rifleProfiles?.count || 0,
        ammoProfiles: ammoProfiles?.count || 0,
        dopeLogs: dopeLogs?.count || 0,
        rangeSessions: rangeSessions?.count || 0,
      };
    } catch (error) {
      console.error('Failed to get statistics:', error);
      return {
        rifleProfiles: 0,
        ammoProfiles: 0,
        dopeLogs: 0,
        rangeSessions: 0,
      };
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      this.initialized = false;
      console.log('Database closed');
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
export default databaseService;
