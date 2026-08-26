import { Migration } from './MigrationRunner';

/**
 * Retire stored precise coordinates.
 *
 * Longitude participates in no calculation anywhere in this codebase -- the
 * ballistic solver uses latitude only, through `sin`/`cos` (`src/utils/coriolis.ts`)
 * -- yet it was captured at ~0.1 m resolution, persisted indefinitely and included
 * in every exported backup. Latitude was captured at the same resolution, roughly
 * five orders of magnitude finer than the model can consume.
 *
 * New writes are coarsened by `EnvironmentSnapshot`, but that does nothing for rows
 * an existing install already holds. This migration drops the longitude column and
 * rounds every stored latitude to one decimal place (~11 km).
 *
 * The rounding is deliberately one-way: `down` restores the column shape so the
 * schema can roll back, but the discarded digits are not recoverable, which is the
 * point. See issue #44.
 */
export const migration005: Migration = {
  version: 5,
  name: 'drop_longitude_coarsen_latitude',

  async up(db) {
    // Follows migration 004's table-rebuild pattern: this codebase targets SQLite
    // versions without a dependable ALTER TABLE ... DROP COLUMN.
    await db.execAsync(`
      CREATE TABLE environment_snapshots_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        temperature REAL NOT NULL,
        humidity REAL NOT NULL,
        pressure REAL NOT NULL,
        altitude REAL NOT NULL,
        density_altitude REAL NOT NULL,
        wind_speed REAL NOT NULL,
        wind_direction REAL NOT NULL,
        latitude REAL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- ROUND(x, 1) matches coarsenLatitude()'s precision. NULL rounds to NULL.
      INSERT INTO environment_snapshots_new
        (id, temperature, humidity, pressure, altitude, density_altitude,
         wind_speed, wind_direction, latitude, timestamp)
      SELECT
        id, temperature, humidity, pressure, altitude, density_altitude,
        wind_speed, wind_direction, ROUND(latitude, 1), timestamp
      FROM environment_snapshots;

      DROP TABLE environment_snapshots;

      ALTER TABLE environment_snapshots_new RENAME TO environment_snapshots;
    `);

    console.log('Dropped longitude and coarsened stored latitudes');
  },

  async down(db) {
    // Restores the column so the schema matches version 4. The coordinates
    // themselves are gone: longitude comes back NULL and latitude stays coarse.
    await db.execAsync(`
      CREATE TABLE environment_snapshots_new (
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

      INSERT INTO environment_snapshots_new
        (id, temperature, humidity, pressure, altitude, density_altitude,
         wind_speed, wind_direction, latitude, longitude, timestamp)
      SELECT
        id, temperature, humidity, pressure, altitude, density_altitude,
        wind_speed, wind_direction, latitude, NULL, timestamp
      FROM environment_snapshots;

      DROP TABLE environment_snapshots;

      ALTER TABLE environment_snapshots_new RENAME TO environment_snapshots;
    `);

    console.log('Restored longitude column (values are not recoverable)');
  },
};

export default migration005;
