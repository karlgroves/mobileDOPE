import { hasColumn } from './hasColumn';
import { Migration } from './MigrationRunner';

/**
 * Add barrel state to `dope_logs` (#164).
 *
 * `range_sessions` has carried `cold_bore_shot` since 001, but a DOPE log
 * carried nothing about the state of the barrel when the shot was taken, so no
 * log could be analysed for cold-bore bias or heat shift -- which is what #165
 * is for.
 *
 * Both columns are nullable with no default. NULL means "not recorded", which
 * is the truth for every log written before this migration; defaulting
 * `cold_bore_shot` to 0 would assert *warm bore* about shots nobody observed,
 * and #165 would then average that fiction into the bias.
 *
 * `ADD COLUMN` only, as 006 established: `dope_logs` is referenced
 * `ON DELETE CASCADE`, and rebuilding a table in that position is exactly what
 * emptied every log in #52. The column checks let a database that already has
 * the columns -- a device stuck by #128 on a current-schema v1 -- move forward
 * instead of failing at the same step on every launch.
 */
export const migration007: Migration = {
  version: 7,
  name: 'add_barrel_state_to_dope_logs',

  async up(db) {
    if (!(await hasColumn(db, 'dope_logs', 'cold_bore_shot'))) {
      await db.execAsync('ALTER TABLE dope_logs ADD COLUMN cold_bore_shot INTEGER;');
      console.log('Added dope_logs.cold_bore_shot');
    }

    if (!(await hasColumn(db, 'dope_logs', 'shot_number_in_session'))) {
      await db.execAsync('ALTER TABLE dope_logs ADD COLUMN shot_number_in_session INTEGER;');
      console.log('Added dope_logs.shot_number_in_session');
    }
  },

  async down(db) {
    // Neither column is indexed, constrained, referenced or used by a trigger,
    // so both meet DROP COLUMN's restrictions (SQLite 3.35+; expo-sqlite
    // vendors 3.50.3). Recorded barrel state is discarded, which is what
    // reversing this migration means.
    if (await hasColumn(db, 'dope_logs', 'shot_number_in_session')) {
      await db.execAsync('ALTER TABLE dope_logs DROP COLUMN shot_number_in_session;');
    }

    if (await hasColumn(db, 'dope_logs', 'cold_bore_shot')) {
      await db.execAsync('ALTER TABLE dope_logs DROP COLUMN cold_bore_shot;');
    }

    console.log('Removed the barrel-state columns from dope_logs');
  },
};

export default migration007;
