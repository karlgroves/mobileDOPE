# Mobile DOPE Database Schema

## Overview

The Mobile DOPE app uses SQLite as its local database for offline-first data storage. The schema is managed through a migration system that ensures data integrity and smooth upgrades.

## Database Version

Current version: **4** (as of latest migrations)

## Tables

### rifle_profiles

Stores rifle configuration data for ballistic calculations.

```sql
CREATE TABLE IF NOT EXISTS rifle_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  caliber TEXT NOT NULL,
  barrel_length REAL NOT NULL,
  twist_rate TEXT NOT NULL,
  zero_distance INTEGER NOT NULL,
  scope_manufacturer TEXT,
  scope_model TEXT,
  scope_height REAL NOT NULL,
  reticle_type TEXT,
  turret_type TEXT NOT NULL,
  click_value REAL NOT NULL,
  click_unit TEXT NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
```

**Fields:**

- `id`: Primary key (auto-increment)
- `name`: Rifle name/identifier
- `caliber`: Caliber (e.g., ".308 Winchester", "6.5 Creedmoor")
- `barrel_length`: Barrel length in inches
- `twist_rate`: Rifling twist rate (e.g., "1:10")
- `zero_distance`: Zero distance in yards
- `scope_manufacturer`: Optic manufacturer name
- `scope_model`: Optic model name
- `scope_height`: Height of scope center over bore (inches)
- `reticle_type`: Type of reticle
- `turret_type`: Type of turret (e.g., "capped", "exposed")
- `click_value`: Adjustment value per click
- `click_unit`: Unit of click adjustment ("MIL" or "MOA")
- `notes`: Optional notes
- `created_at`: Timestamp of creation
- `updated_at`: Timestamp of last update

### ammo_profiles

Stores ammunition specifications and ballistic data. **Caliber-based architecture** - no foreign key to rifles.

```sql
CREATE TABLE IF NOT EXISTS ammo_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  caliber TEXT NOT NULL,
  manufacturer TEXT,
  bullet_weight INTEGER NOT NULL,
  bullet_type TEXT,
  ballistic_coefficient_g1 REAL NOT NULL,
  ballistic_coefficient_g7 REAL,
  muzzle_velocity INTEGER NOT NULL,
  powder_type TEXT,
  powder_weight REAL,
  primer_type TEXT,
  case_type TEXT,
  overall_length REAL,
  lot_number TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
```

**Fields:**

- `id`: Primary key (auto-increment)
- `name`: Ammunition name/identifier
- `caliber`: Caliber (must match rifle caliber for pairing)
- `manufacturer`: Ammunition manufacturer
- `bullet_weight`: Bullet weight in grains
- `bullet_type`: Bullet type (e.g., "HPBT", "ELD-X", "SPCE")
- `ballistic_coefficient_g1`: G1 ballistic coefficient
- `ballistic_coefficient_g7`: G7 ballistic coefficient (optional)
- `muzzle_velocity`: Muzzle velocity in fps
- `powder_type`: Type of powder used
- `powder_weight`: Powder weight in grains
- `primer_type`: Type of primer
- `case_type`: Type of brass/case
- `overall_length`: Overall cartridge length (COAL) in inches
- `lot_number`: Manufacturing lot number for tracking
- `notes`: Optional notes
- `created_at`: Timestamp of creation
- `updated_at`: Timestamp of last update

**Important:** Ammunition profiles are **NOT** linked to rifles via foreign key. They are matched to rifles by `caliber` field, allowing ammo to be used with multiple rifles of the same caliber.

### environment_snapshots

Captures environmental conditions at the time of shooting.

```sql
CREATE TABLE IF NOT EXISTS environment_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  temperature REAL NOT NULL,
  humidity REAL,
  pressure REAL NOT NULL,
  altitude REAL NOT NULL,
  wind_speed REAL,
  wind_direction INTEGER,
  latitude REAL,
  longitude REAL,
  timestamp INTEGER NOT NULL
)
```

**Fields:**

- `id`: Primary key (auto-increment)
- `temperature`: Temperature in Fahrenheit
- `humidity`: Relative humidity (0-100%)
- `pressure`: Barometric pressure in inches of mercury (inHg)
- `altitude`: Altitude in feet MSL (Mean Sea Level)
- `wind_speed`: Wind speed in mph
- `wind_direction`: Wind direction in degrees (0-359, 0=north, 90=east)
- `latitude`: GPS latitude
- `longitude`: GPS longitude
- `timestamp`: Timestamp of capture

### dope_logs

Data On Previous Engagements - the core shooting records.

```sql
CREATE TABLE IF NOT EXISTS dope_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rifle_id INTEGER NOT NULL,
  ammo_id INTEGER NOT NULL,
  environment_id INTEGER NOT NULL,
  distance INTEGER NOT NULL,
  distance_unit TEXT NOT NULL,
  elevation_correction REAL NOT NULL,
  windage_correction REAL NOT NULL,
  correction_unit TEXT NOT NULL,
  target_type TEXT,
  group_size REAL,
  hit_count INTEGER,
  shot_count INTEGER,
  notes TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (rifle_id) REFERENCES rifle_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (ammo_id) REFERENCES ammo_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (environment_id) REFERENCES environment_snapshots(id) ON DELETE CASCADE
)
```

**Fields:**

- `id`: Primary key (auto-increment)
- `rifle_id`: Foreign key to rifle_profiles
- `ammo_id`: Foreign key to ammo_profiles
- `environment_id`: Foreign key to environment_snapshots
- `distance`: Target distance
- `distance_unit`: Unit of distance ("yards" or "meters")
- `elevation_correction`: Elevation correction applied (MIL or MOA)
- `windage_correction`: Windage correction applied (MIL or MOA)
- `correction_unit`: Unit of corrections ("MIL" or "MOA")
- `target_type`: Type of target ("steel", "paper", "vital_zone", "other")
- `group_size`: Group size in inches
- `hit_count`: Number of hits
- `shot_count`: Total shots fired
- `notes`: Optional notes
- `timestamp`: Timestamp of engagement

**Foreign Keys:**

- All foreign keys use `ON DELETE CASCADE` to maintain referential integrity
- When a rifle is deleted, all associated DOPE logs are deleted
- When ammo is deleted, all associated DOPE logs are deleted
- When an environment snapshot is deleted, all associated DOPE logs are deleted

## Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_dope_rifle ON dope_logs(rifle_id);
CREATE INDEX IF NOT EXISTS idx_dope_ammo ON dope_logs(ammo_id);
CREATE INDEX IF NOT EXISTS idx_dope_timestamp ON dope_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_environment_timestamp ON environment_snapshots(timestamp);
```

**Purpose:**

- `idx_dope_rifle`: Fast lookups of DOPE logs by rifle
- `idx_dope_ammo`: Fast lookups of DOPE logs by ammunition
- `idx_dope_timestamp`: Fast sorting and filtering by date
- `idx_environment_timestamp`: Fast lookups of environmental data by date

## Migration System

The database uses a migration-based upgrade system:

1. **001_initial_schema.ts** - Creates initial tables (rifles, ammo with rifle_id, environment, DOPE)
2. **002_add_caliber_to_ammo.ts** - Adds caliber field to ammo_profiles
3. **003_fix_empty_caliber.ts** - Populates caliber from associated rifles
4. **004_remove_rifle_id_from_ammo.ts** - Removes rifle_id foreign key (caliber-based architecture)

### Migration Runner

Migrations are tracked in the `schema_migrations` table:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
)
```

The migration runner ensures:

- Migrations run in order
- Each migration runs only once
- Failed migrations don't corrupt the database (transaction-based)
- Version tracking for upgrade paths

## Data Relationships

```
rifle_profiles (1) ──── (N) dope_logs
                              │
ammo_profiles (1) ─────── (N) │
                              │
environment_snapshots (1) ── (1)
```

**Note:** Rifles and ammo are matched by **caliber** at the application layer, not via database foreign key.

## Queries

### Common Query Patterns

**Get DOPE logs for a rifle:**

```sql
SELECT * FROM dope_logs
WHERE rifle_id = ?
ORDER BY timestamp DESC;
```

**Get ammo compatible with a rifle:**

```sql
SELECT * FROM ammo_profiles
WHERE caliber = (SELECT caliber FROM rifle_profiles WHERE id = ?);
```

**Get DOPE with full details:**

```sql
SELECT
  d.*,
  r.name as rifle_name,
  a.name as ammo_name,
  e.temperature,
  e.pressure,
  e.altitude
FROM dope_logs d
JOIN rifle_profiles r ON d.rifle_id = r.id
JOIN ammo_profiles a ON d.ammo_id = a.id
JOIN environment_snapshots e ON d.environment_id = e.id
WHERE d.id = ?;
```

## Backup Format

When exported via the backup system, data is serialized as JSON:

```json
{
  "exportDate": "2024-01-01T12:00:00.000Z",
  "exportVersion": "1.0",
  "type": "full_backup",
  "data": {
    "rifles": [...],
    "ammos": [...],
    "logs": [...]
  },
  "counts": {
    "rifles": 5,
    "ammos": 10,
    "logs": 150
  }
}
```

Environment snapshots are embedded within DOPE log exports but can also be exported separately if needed.
