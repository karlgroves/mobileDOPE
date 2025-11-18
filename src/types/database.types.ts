/**
 * Database table schemas and types for Mobile DOPE App
 */

export interface RifleProfileRow {
  id: number;
  name: string;
  caliber: string;
  barrel_length: number; // inches
  twist_rate: string; // e.g., "1:8", "1:10"
  zero_distance: number; // yards
  optic_manufacturer: string;
  optic_model: string;
  reticle_type: string;
  click_value_type: 'MIL' | 'MOA';
  click_value: number; // value per click
  scope_height: number; // inches over bore
  notes?: string;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

export interface AmmoProfileRow {
  id: number;
  rifle_id: number; // foreign key to RifleProfileRow
  name: string;
  manufacturer: string;
  bullet_weight: number; // grains
  bullet_type: string; // HPBT, ELD-X, etc.
  ballistic_coefficient_g1: number;
  ballistic_coefficient_g7: number;
  muzzle_velocity: number; // fps
  powder_type?: string;
  powder_weight?: number; // grains
  lot_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface EnvironmentSnapshotRow {
  id: number;
  temperature: number; // Fahrenheit
  humidity: number; // percentage (0-100)
  pressure: number; // inHg
  altitude: number; // feet
  density_altitude: number; // feet (calculated)
  wind_speed: number; // mph
  wind_direction: number; // degrees (0-360)
  latitude?: number;
  longitude?: number;
  timestamp: string; // ISO date string
}

export interface DOPELogRow {
  id: number;
  rifle_id: number;
  ammo_id: number;
  environment_id: number;
  distance: number; // yards
  distance_unit: 'yards' | 'meters';
  elevation_correction: number; // MIL or MOA
  windage_correction: number; // MIL or MOA
  correction_unit: 'MIL' | 'MOA';
  target_type: 'steel' | 'paper' | 'vital_zone' | 'other';
  group_size?: number; // inches
  hit_count?: number;
  shot_count?: number;
  notes?: string;
  timestamp: string;
}

export interface ShotStringRow {
  id: number;
  ammo_id: number;
  session_date: string;
  shot_number: number;
  velocity: number; // fps
  temperature: number; // Fahrenheit
  notes?: string;
  created_at: string;
}

export interface RangeSessionRow {
  id: number;
  rifle_id: number;
  ammo_id: number;
  environment_id: number;
  session_name?: string;
  start_time: string;
  end_time?: string;
  distance: number; // yards
  shot_count: number;
  cold_bore_shot: boolean;
  notes?: string;
  created_at: string;
}

export interface TargetImageRow {
  id: number;
  dope_log_id?: number;
  range_session_id?: number;
  image_uri: string; // local file path
  target_type: string;
  poi_markers: string; // JSON string of POI coordinates
  group_size?: number; // inches
  created_at: string;
}

export interface AppSettingsRow {
  id: number;
  key: string; // unique setting key
  value: string; // JSON string
  updated_at: string;
}

// SQL Schema definitions
export const DB_SCHEMA = {
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

// Index definitions for performance
export const DB_INDEXES = {
  AMMO_BY_RIFLE: 'CREATE INDEX IF NOT EXISTS idx_ammo_rifle ON ammo_profiles(rifle_id);',
  DOPE_BY_RIFLE: 'CREATE INDEX IF NOT EXISTS idx_dope_rifle ON dope_logs(rifle_id);',
  DOPE_BY_AMMO: 'CREATE INDEX IF NOT EXISTS idx_dope_ammo ON dope_logs(ammo_id);',
  DOPE_BY_TIMESTAMP: 'CREATE INDEX IF NOT EXISTS idx_dope_timestamp ON dope_logs(timestamp);',
  SESSION_BY_RIFLE: 'CREATE INDEX IF NOT EXISTS idx_session_rifle ON range_sessions(rifle_id);',
  SHOT_STRING_BY_AMMO:
    'CREATE INDEX IF NOT EXISTS idx_shot_string_ammo ON shot_strings(ammo_id);',
  TARGET_BY_DOPE: 'CREATE INDEX IF NOT EXISTS idx_target_dope ON target_images(dope_log_id);',
  TARGET_BY_SESSION:
    'CREATE INDEX IF NOT EXISTS idx_target_session ON target_images(range_session_id);',
};
