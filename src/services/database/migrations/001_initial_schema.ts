import { Migration } from './MigrationRunner';
import { DB_SCHEMA, DB_INDEXES } from '../../../types/database.types';

/**
 * Initial database schema migration
 * Creates all tables and indexes
 */
export const migration001: Migration = {
  version: 1,
  name: 'initial_schema',

  async up(db) {
    // Enable foreign keys
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // Create all tables
    await db.execAsync(DB_SCHEMA.RIFLE_PROFILE);
    await db.execAsync(DB_SCHEMA.AMMO_PROFILE);
    await db.execAsync(DB_SCHEMA.ENVIRONMENT_SNAPSHOT);
    await db.execAsync(DB_SCHEMA.DOPE_LOG);
    await db.execAsync(DB_SCHEMA.SHOT_STRING);
    await db.execAsync(DB_SCHEMA.RANGE_SESSION);
    await db.execAsync(DB_SCHEMA.TARGET_IMAGE);
    await db.execAsync(DB_SCHEMA.APP_SETTINGS);

    // Create indexes
    for (const [_name, sql] of Object.entries(DB_INDEXES)) {
      await db.execAsync(sql);
    }

    console.log('Initial schema created successfully');
  },

  async down(db) {
    // Drop all tables in reverse order of dependencies
    await db.execAsync(`
      DROP TABLE IF EXISTS target_images;
      DROP TABLE IF EXISTS range_sessions;
      DROP TABLE IF EXISTS shot_strings;
      DROP TABLE IF EXISTS dope_logs;
      DROP TABLE IF EXISTS environment_snapshots;
      DROP TABLE IF EXISTS ammo_profiles;
      DROP TABLE IF EXISTS rifle_profiles;
      DROP TABLE IF EXISTS app_settings;
    `);

    console.log('Initial schema dropped successfully');
  },
};

export default migration001;
