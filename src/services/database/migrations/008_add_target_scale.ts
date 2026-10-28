import { hasColumn } from './hasColumn';
import { Migration } from './MigrationRunner';

/**
 * Add the marked target's scale to `target_images` (#63).
 *
 * Points of impact are stored as fractions of the image (see
 * `src/utils/targetMarking.ts`), so a group can only be measured in inches with
 * two more facts: how wide the target really is, and -- for a photo that is not
 * square -- the image's height over its width, without which every vertical
 * distance is measured in the wrong unit. The table had nowhere to keep either,
 * so a saved target could be shown again but never measured again.
 *
 * Both columns are nullable with no default. NULL means "the shooter did not
 * say", which is the truth for any row written before this; a default width
 * would turn an unmeasured group into a confident, invented number of inches.
 *
 * `ADD COLUMN` only, as 006 and 007 established: `target_images` cascades from
 * `dope_logs` and `range_sessions`, and nothing here rebuilds a table. The column
 * checks let a database that already has the columns move forward.
 */
export const migration008: Migration = {
  version: 8,
  name: 'add_target_scale',

  async up(db) {
    if (!(await hasColumn(db, 'target_images', 'target_width_inches'))) {
      await db.execAsync('ALTER TABLE target_images ADD COLUMN target_width_inches REAL;');
      console.log('Added target_images.target_width_inches');
    }

    if (!(await hasColumn(db, 'target_images', 'aspect_ratio'))) {
      await db.execAsync('ALTER TABLE target_images ADD COLUMN aspect_ratio REAL;');
      console.log('Added target_images.aspect_ratio');
    }
  },

  async down(db) {
    // Neither column is indexed, constrained, referenced or used by a trigger,
    // so both meet DROP COLUMN's restrictions (SQLite 3.35+; expo-sqlite
    // vendors 3.50.3). The marks stay; only the scale is discarded.
    if (await hasColumn(db, 'target_images', 'aspect_ratio')) {
      await db.execAsync('ALTER TABLE target_images DROP COLUMN aspect_ratio;');
    }

    if (await hasColumn(db, 'target_images', 'target_width_inches')) {
      await db.execAsync('ALTER TABLE target_images DROP COLUMN target_width_inches;');
    }

    console.log('Removed the scale columns from target_images');
  },
};

export default migration008;
