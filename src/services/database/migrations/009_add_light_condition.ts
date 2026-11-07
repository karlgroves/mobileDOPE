import { hasColumn } from './hasColumn';
import { Migration } from './MigrationRunner';

/**
 * Add the light a reading was taken in to `environment_snapshots` (#62).
 *
 * The shooter's own description of the light -- day, low light or night -- is
 * a fact about the conditions like the wind, and the table had nowhere to keep
 * it. It is stored as text from a closed set (see `LightCondition`) rather than
 * a number, because there is no scale between the three to put on a slider.
 *
 * Nullable with no default. NULL means "not recorded", which is the truth for
 * every reading saved before this; a default of `day` would claim daylight for
 * shots nobody described.
 *
 * `ADD COLUMN` only, as 006 to 008 established: `dope_logs` and
 * `range_sessions` reference this table, and nothing here rebuilds it. The
 * column check lets a database that already has the column move forward.
 */
export const migration009: Migration = {
  version: 9,
  name: 'add_light_condition',

  async up(db) {
    if (!(await hasColumn(db, 'environment_snapshots', 'light_condition'))) {
      await db.execAsync('ALTER TABLE environment_snapshots ADD COLUMN light_condition TEXT;');
      console.log('Added environment_snapshots.light_condition');
    }
  },

  async down(db) {
    // Not indexed, constrained, referenced or used by a trigger, so it meets
    // DROP COLUMN's restrictions (SQLite 3.35+; expo-sqlite vendors 3.50.3).
    // The readings stay; only the recorded light is discarded.
    if (await hasColumn(db, 'environment_snapshots', 'light_condition')) {
      await db.execAsync('ALTER TABLE environment_snapshots DROP COLUMN light_condition;');
    }

    console.log('Removed light_condition from environment_snapshots');
  },
};

export default migration009;
