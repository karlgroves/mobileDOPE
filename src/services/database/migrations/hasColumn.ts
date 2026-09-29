import type * as SQLite from 'expo-sqlite';

/**
 * Whether `table` already has `column`.
 *
 * For migrations that must tolerate a change already being in place. Before
 * #128 was fixed, migration 001 built the then-current schema and stamped it
 * version 1, so a device installed in that window has the columns 002 adds and
 * lacks the one 004 removes. Checking the shape lets those devices move forward
 * rather than fail at the same step on every launch.
 */
export const hasColumn = async (
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string
): Promise<boolean> => {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
  return columns.some((c) => c.name === column);
};
