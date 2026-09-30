import { hasColumn } from './hasColumn';
import { Migration } from './MigrationRunner';

/**
 * Drop `environment_snapshots.longitude` (#133).
 *
 * Migration 005 emptied the column instead of removing it, because a table
 * rebuild was the only way to remove one and rebuilding a table that
 * `dope_logs` references failed under the migration transaction. Since #128,
 * 001 builds the v1 schema on every install, so every database has carried an
 * always-NULL column that `DB_SCHEMA` does not.
 *
 * `ALTER TABLE ... DROP COLUMN` (SQLite 3.35+; expo-sqlite vendors 3.50.3 on
 * iOS and Android) removes it in place, with no rebuild. `longitude` has no
 * index, constraint, trigger or reference, so it meets DROP COLUMN's
 * restrictions. A device stuck by #128 on a develop-era schema never had the
 * column, so it is checked first.
 */
export const migration006: Migration = {
  version: 6,
  name: 'drop_longitude_column',

  async up(db) {
    if (!(await hasColumn(db, 'environment_snapshots', 'longitude'))) return;

    await db.execAsync('ALTER TABLE environment_snapshots DROP COLUMN longitude;');

    console.log('Dropped environment_snapshots.longitude');
  },

  async down(db) {
    // The column 005 left behind, empty. The values were discarded in 005.
    if (await hasColumn(db, 'environment_snapshots', 'longitude')) return;

    await db.execAsync('ALTER TABLE environment_snapshots ADD COLUMN longitude REAL;');

    console.log('Restored environment_snapshots.longitude (empty)');
  },
};

export default migration006;
