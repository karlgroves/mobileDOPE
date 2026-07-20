import { Migration } from './MigrationRunner';

/**
 * Remove rifle_id from ammo_profiles table
 * Ammunition should be standalone entities that can be used across multiple rifles
 */
export const migration004: Migration = {
  version: 4,
  name: 'remove_rifle_id_from_ammo',

  async up(db) {
    // SQLite doesn't support DROP COLUMN, so we need to recreate the table
    await db.execAsync(`
      -- Create new table without rifle_id
      CREATE TABLE ammo_profiles_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        manufacturer TEXT NOT NULL,
        caliber TEXT NOT NULL,
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
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Copy data from old table (excluding rifle_id)
      INSERT INTO ammo_profiles_new
        (id, name, manufacturer, caliber, bullet_weight, bullet_type,
         ballistic_coefficient_g1, ballistic_coefficient_g7, muzzle_velocity,
         powder_type, powder_weight, lot_number, notes, created_at, updated_at)
      SELECT
        id, name, manufacturer, caliber, bullet_weight, bullet_type,
        ballistic_coefficient_g1, ballistic_coefficient_g7, muzzle_velocity,
        powder_type, powder_weight, lot_number, notes, created_at, updated_at
      FROM ammo_profiles;

      -- Drop old table
      DROP TABLE ammo_profiles;

      -- Rename new table
      ALTER TABLE ammo_profiles_new RENAME TO ammo_profiles;
    `);

    console.log('Removed rifle_id from ammo_profiles table');
  },

  async down(db) {
    // To rollback, we'd need to add rifle_id back, but we can't determine which rifle
    // each ammo belonged to, so we'll just add it as NULL or a default value
    await db.execAsync(`
      -- Create table with rifle_id
      CREATE TABLE ammo_profiles_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rifle_id INTEGER NOT NULL DEFAULT 1,
        name TEXT NOT NULL,
        manufacturer TEXT NOT NULL,
        caliber TEXT NOT NULL,
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
      INSERT INTO ammo_profiles_new
        (id, name, manufacturer, caliber, bullet_weight, bullet_type,
         ballistic_coefficient_g1, ballistic_coefficient_g7, muzzle_velocity,
         powder_type, powder_weight, lot_number, notes, created_at, updated_at)
      SELECT
        id, name, manufacturer, caliber, bullet_weight, bullet_type,
        ballistic_coefficient_g1, ballistic_coefficient_g7, muzzle_velocity,
        powder_type, powder_weight, lot_number, notes, created_at, updated_at
      FROM ammo_profiles;

      -- Drop new table
      DROP TABLE ammo_profiles;

      -- Rename back
      ALTER TABLE ammo_profiles_new RENAME TO ammo_profiles;

      -- Recreate index
      CREATE INDEX IF NOT EXISTS idx_ammo_rifle ON ammo_profiles(rifle_id);
    `);

    console.log('Added rifle_id back to ammo_profiles table');
  },
};

export default migration004;
