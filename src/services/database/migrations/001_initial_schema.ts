import { Migration } from './MigrationRunner';

/**
 * The schema exactly as it stood at version 1 (a2b7db5).
 *
 * Frozen on purpose, and never to be edited: every later migration assumes this
 * is what it starts from. 001 used to read the live `DB_SCHEMA`, which has since
 * moved on to the shape 002 and 004 produce -- so on a fresh install 001 built
 * `ammo_profiles` with `caliber` already in it, 002 failed adding it again, and
 * the app never got past launch (#128). Schema changes belong in a new
 * migration, and `DB_SCHEMA` is updated to match what the migrations produce.
 */
const V1_SCHEMA = {
  RIFLE_PROFILE: `
    CREATE TABLE IF NOT EXISTS rifle_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      caliber TEXT NOT NULL,
      barrel_length REAL NOT NULL,
      twist_rate TEXT NOT NULL,
      zero_distance REAL NOT NULL,
      optic_manufacturer TEXT NOT NULL,
      optic_model TEXT NOT NULL,
      reticle_type TEXT NOT NULL,
      click_value_type TEXT NOT NULL CHECK(click_value_type IN ('MIL', 'MOA')),
      click_value REAL NOT NULL,
      scope_height REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `,
  AMMO_PROFILE: `
    CREATE TABLE IF NOT EXISTS ammo_profiles (
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
  `,
  ENVIRONMENT_SNAPSHOT: `
    CREATE TABLE IF NOT EXISTS environment_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      temperature REAL NOT NULL,
      humidity REAL NOT NULL,
      pressure REAL NOT NULL,
      altitude REAL NOT NULL,
      density_altitude REAL NOT NULL,
      wind_speed REAL NOT NULL,
      wind_direction REAL NOT NULL,
      latitude REAL,
      longitude REAL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `,
  DOPE_LOG: `
    CREATE TABLE IF NOT EXISTS dope_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rifle_id INTEGER NOT NULL,
      ammo_id INTEGER NOT NULL,
      environment_id INTEGER NOT NULL,
      distance REAL NOT NULL,
      distance_unit TEXT NOT NULL CHECK(distance_unit IN ('yards', 'meters')),
      elevation_correction REAL NOT NULL,
      windage_correction REAL NOT NULL,
      correction_unit TEXT NOT NULL CHECK(correction_unit IN ('MIL', 'MOA')),
      target_type TEXT NOT NULL,
      group_size REAL,
      hit_count INTEGER,
      shot_count INTEGER,
      notes TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (rifle_id) REFERENCES rifle_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (ammo_id) REFERENCES ammo_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (environment_id) REFERENCES environment_snapshots(id)
    );
  `,
  SHOT_STRING: `
    CREATE TABLE IF NOT EXISTS shot_strings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ammo_id INTEGER NOT NULL,
      session_date TEXT NOT NULL,
      shot_number INTEGER NOT NULL,
      velocity REAL NOT NULL,
      temperature REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ammo_id) REFERENCES ammo_profiles(id) ON DELETE CASCADE
    );
  `,
  RANGE_SESSION: `
    CREATE TABLE IF NOT EXISTS range_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rifle_id INTEGER NOT NULL,
      ammo_id INTEGER NOT NULL,
      environment_id INTEGER NOT NULL,
      session_name TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      distance REAL NOT NULL,
      shot_count INTEGER NOT NULL DEFAULT 0,
      cold_bore_shot INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (rifle_id) REFERENCES rifle_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (ammo_id) REFERENCES ammo_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (environment_id) REFERENCES environment_snapshots(id)
    );
  `,
  TARGET_IMAGE: `
    CREATE TABLE IF NOT EXISTS target_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dope_log_id INTEGER,
      range_session_id INTEGER,
      image_uri TEXT NOT NULL,
      target_type TEXT NOT NULL,
      poi_markers TEXT NOT NULL,
      group_size REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (dope_log_id) REFERENCES dope_logs(id) ON DELETE CASCADE,
      FOREIGN KEY (range_session_id) REFERENCES range_sessions(id) ON DELETE CASCADE
    );
  `,
  APP_SETTINGS: `
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `,
};

const V1_INDEXES = {
  AMMO_BY_RIFLE: 'CREATE INDEX IF NOT EXISTS idx_ammo_rifle ON ammo_profiles(rifle_id);',
  DOPE_BY_RIFLE: 'CREATE INDEX IF NOT EXISTS idx_dope_rifle ON dope_logs(rifle_id);',
  DOPE_BY_AMMO: 'CREATE INDEX IF NOT EXISTS idx_dope_ammo ON dope_logs(ammo_id);',
  DOPE_BY_TIMESTAMP: 'CREATE INDEX IF NOT EXISTS idx_dope_timestamp ON dope_logs(timestamp);',
  SESSION_BY_RIFLE: 'CREATE INDEX IF NOT EXISTS idx_session_rifle ON range_sessions(rifle_id);',
  SHOT_STRING_BY_AMMO: 'CREATE INDEX IF NOT EXISTS idx_shot_string_ammo ON shot_strings(ammo_id);',
  TARGET_BY_DOPE: 'CREATE INDEX IF NOT EXISTS idx_target_dope ON target_images(dope_log_id);',
  TARGET_BY_SESSION:
    'CREATE INDEX IF NOT EXISTS idx_target_session ON target_images(range_session_id);',
};

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
    await db.execAsync(V1_SCHEMA.RIFLE_PROFILE);
    await db.execAsync(V1_SCHEMA.AMMO_PROFILE);
    await db.execAsync(V1_SCHEMA.ENVIRONMENT_SNAPSHOT);
    await db.execAsync(V1_SCHEMA.DOPE_LOG);
    await db.execAsync(V1_SCHEMA.SHOT_STRING);
    await db.execAsync(V1_SCHEMA.RANGE_SESSION);
    await db.execAsync(V1_SCHEMA.TARGET_IMAGE);
    await db.execAsync(V1_SCHEMA.APP_SETTINGS);

    // Create indexes
    for (const [_name, sql] of Object.entries(V1_INDEXES)) {
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
