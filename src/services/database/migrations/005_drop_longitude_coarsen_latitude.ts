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
 * New writes are coarsened by `EnvironmentSnapshot`; this handles the rows an
 * existing install already holds.
 *
 * ## Why this nulls in place instead of rebuilding the table
 *
 * Migrations 002-004 use the classic SQLite table-rebuild (create new, copy, drop
 * old, rename). That pattern is unsafe here, and measurably so: `dope_logs`
 * references `environment_snapshots` with a foreign key, `DatabaseService.initialize()`
 * sets `PRAGMA foreign_keys = ON`, and `MigrationRunner` then runs every migration
 * inside a transaction. Dropping the parent table under those conditions raises
 * `FOREIGN KEY constraint failed`, the transaction rolls back, and the app fails to
 * start -- for any install with at least one DOPE log, which is every real install.
 *
 * The usual escape (`PRAGMA foreign_keys = OFF` around the rebuild) is unavailable:
 * that pragma is a documented no-op inside a transaction.
 *
 * So the column stays and its values go. Issue #44's acceptance criterion asks for a
 * migration that "nulls **or** coarsens existing stored coordinates" -- this does
 * both, without touching table structure. `longitude` remains in upgraded databases
 * as an always-NULL column that nothing reads or writes; `DB_SCHEMA` omits it for
 * fresh installs. That divergence is inert and is the deliberate trade against an
 * app that will not boot.
 *
 * The coarsening is one-way. `down()` cannot restore the discarded digits, which is
 * the point. See issue #44.
 */
export const migration005: Migration = {
  version: 5,
  name: 'drop_longitude_coarsen_latitude',

  async up(db) {
    // ROUND(x, 1) matches coarsenLatitude()'s precision. NULL rounds to NULL, so a
    // snapshot that never had a coordinate is left alone rather than becoming 0.
    await db.execAsync(`
      UPDATE environment_snapshots
         SET longitude = NULL,
             latitude  = ROUND(latitude, 1)
       WHERE longitude IS NOT NULL
          OR latitude IS NOT NULL;
    `);

    console.log('Cleared stored longitudes and coarsened stored latitudes');
  },

  async down(db) {
    // Deliberately a no-op. There is no structural change to reverse, and the
    // discarded precision is not recoverable -- restoring the schema shape would
    // imply the data came back with it.
    await db.execAsync('SELECT 1;');

    console.log('Migration 005 is not reversible: coordinate precision was discarded');
  },
};

export default migration005;
