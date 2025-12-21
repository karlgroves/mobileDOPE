import { Migration } from './MigrationRunner';

/**
 * Fix empty caliber values in existing ammo profiles
 */
export const migration003: Migration = {
  version: 3,
  name: 'fix_empty_caliber',

  async up(db) {
    // Update any empty caliber values to 'Unknown'
    await db.execAsync(`
      UPDATE ammo_profiles
      SET caliber = 'Unknown'
      WHERE caliber = '' OR caliber IS NULL;
    `);

    console.log('Fixed empty caliber values in ammo_profiles table');
  },

  async down(db) {
    // Revert Unknown calibers back to empty string
    await db.execAsync(`
      UPDATE ammo_profiles
      SET caliber = ''
      WHERE caliber = 'Unknown';
    `);

    console.log('Reverted caliber values');
  },
};

export default migration003;
