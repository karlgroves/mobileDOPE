/**
 * Migration registry
 * Import and register all migrations here
 */

import migrationRunner from './MigrationRunner';
import migration001 from './001_initial_schema';
import migration002 from './002_add_caliber_to_ammo';
import migration003 from './003_fix_empty_caliber';
import migration004 from './004_remove_rifle_id_from_ammo';

// Register all migrations
migrationRunner.register(migration001);
migrationRunner.register(migration002);
migrationRunner.register(migration003);
migrationRunner.register(migration004);

// Export for use in app initialization
export { migrationRunner };
export default migrationRunner;
