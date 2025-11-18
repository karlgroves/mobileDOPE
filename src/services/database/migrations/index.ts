/**
 * Migration registry
 * Import and register all migrations here
 */

import migrationRunner from './MigrationRunner';
import migration001 from './001_initial_schema';

// Register all migrations
migrationRunner.register(migration001);

// Export for use in app initialization
export { migrationRunner };
export default migrationRunner;
