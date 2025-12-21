import { Migration } from './MigrationRunner';

/**
 * Add caliber field to ammo_profiles table
 */
export const migration002: Migration = {
  version: 2,
  name: 'add_caliber_to_ammo',

  async up(db) {
    // Add caliber column to ammo_profiles table with a default value
    await db.execAsync(`
      ALTER TABLE ammo_profiles
      ADD COLUMN caliber TEXT NOT NULL DEFAULT 'Unknown';
    `);

    console.log('Added caliber column to ammo_profiles table');
  },

  async down(db) {
    // SQLite doesn't support DROP COLUMN directly
    // We need to recreate the table without the caliber column
    await db.execAsync(`
      -- Create temporary table with old schema
      CREATE TABLE ammo_profiles_old AS SELECT
        id, rifle_id, name, manufacturer, bullet_weight, bullet_type,
        ballistic_coefficient_g1, ballistic_coefficient_g7, muzzle_velocity,
        powder_type, powder_weight, lot_number, notes, created_at, updated_at
      FROM ammo_profiles;

      -- Drop the current table
      DROP TABLE ammo_profiles;

      -- Recreate table without caliber
      CREATE TABLE ammo_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rifle_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        manufacturer TEXT NOT NULL,
        bullet_weight REAL NOT NULL,
        bullet_type TEXT NOT NULL,
        ballistic_coefficient_g1 REAL NOT NULL,
        ballistic_coefficient_g7 REAL NOT NULL,
        muzzle_velocity REAL NOT NULL,
        powder_type TEXT,
        powder_weight REAL,
        lot_number TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (rifle_id) REFERENCES rifle_profiles(id) ON DELETE CASCADE
      );

      -- Copy data back
      INSERT INTO ammo_profiles SELECT * FROM ammo_profiles_old;

      -- Drop temporary table
      DROP TABLE ammo_profiles_old;

      -- Recreate index
      CREATE INDEX IF NOT EXISTS idx_ammo_rifle ON ammo_profiles(rifle_id);
    `);

    console.log('Removed caliber column from ammo_profiles table');
  },
};

export default migration002;
