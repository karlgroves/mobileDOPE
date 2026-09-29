import { AmmoProfile } from '../../../src/models/AmmoProfile';
import { DOPELog } from '../../../src/models/DOPELog';
import { EnvironmentSnapshot } from '../../../src/models/EnvironmentSnapshot';
import {
  createAmmoProfile,
  createDOPELog,
  createEnvironmentSnapshot,
  createRangeSession,
  createRifleProfile,
  createShotString,
  createTargetImage,
} from '../../../src/models/factories';
import { RangeSession } from '../../../src/models/RangeSession';
import { RifleProfile } from '../../../src/models/RifleProfile';
import { ShotString } from '../../../src/models/ShotString';
import { TargetImage } from '../../../src/models/TargetImage';
import { DB_SCHEMA } from '../../../src/types/database.types';

/**
 * SQLite hands back an empty optional column as `null`, but every model types
 * those fields as `?: T` and every reader checks them with `!== undefined`.
 *
 * A null that got through crashed DOPE Log Details (`groupSize.toFixed` on a
 * log saved without a group size), rated a missing group as a perfect 0.0 MOA
 * and a missing hit count as 0% hits in the confidence score, and printed
 * "Hits: /" in the log list.
 *
 * The nullable columns are read off `DB_SCHEMA` rather than listed here, so a
 * column added later is covered without anyone remembering to add it.
 */

/** Columns of `table` that may hold NULL: no NOT NULL and not the primary key. */
const nullableColumns = (table: string): string[] => {
  const ddl = Object.values(DB_SCHEMA).find((d) =>
    new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`).test(d)
  );
  if (!ddl) throw new Error(`No DDL for ${table}`);
  return ddl
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[a-z_]+ [A-Z]/.test(line))
    .filter((line) => !/NOT NULL|PRIMARY KEY/.test(line))
    .map((line) => line.split(' ')[0]);
};

/** Own properties of `model` that are `null`. */
const nullsIn = (model: object): string[] =>
  Object.entries(model)
    .filter(([, value]) => value === null)
    .map(([key]) => key);

const CASES: {
  table: string;
  row: () => Record<string, unknown>;
  fromRow: (row: never) => object;
  /** Nullable columns the model still requires, as an alternative to another. */
  keep?: string[];
}[] = [
  {
    table: 'rifle_profiles',
    row: () => ({ id: 1, ...createRifleProfile().toRow() }),
    fromRow: RifleProfile.fromRow,
  },
  {
    table: 'ammo_profiles',
    row: () => ({ id: 1, ...createAmmoProfile().toRow() }),
    fromRow: AmmoProfile.fromRow,
  },
  {
    table: 'environment_snapshots',
    row: () => ({
      id: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      ...createEnvironmentSnapshot().toRow(),
    }),
    fromRow: EnvironmentSnapshot.fromRow,
  },
  {
    table: 'dope_logs',
    row: () => ({ id: 1, timestamp: '2026-01-01T00:00:00.000Z', ...createDOPELog().toRow() }),
    fromRow: DOPELog.fromRow,
  },
  {
    table: 'shot_strings',
    row: () => ({ id: 1, ...createShotString().toRow() }),
    fromRow: ShotString.fromRow,
  },
  {
    table: 'range_sessions',
    row: () => ({ id: 1, ...createRangeSession().toRow() }),
    fromRow: RangeSession.fromRow,
  },
  {
    table: 'target_images',
    row: () => ({ id: 1, ...createTargetImage().toRow() }),
    fromRow: TargetImage.fromRow,
    // An image belongs to a DOPE log or a range session; one of the two stays.
    keep: ['dope_log_id'],
  },
];

describe('fromRow turns an empty column into undefined, never null', () => {
  it('covers every table in DB_SCHEMA except settings', () => {
    const tables = Object.values(DB_SCHEMA)
      .map((ddl) => /CREATE TABLE IF NOT EXISTS (\w+)/.exec(ddl)?.[1])
      .filter((t) => t !== 'app_settings');
    expect(CASES.map((c) => c.table).sort()).toEqual([...tables].sort());
  });

  it.each(CASES)('$table has nullable columns to test', ({ table }) => {
    // Guards the parser: if it found none, the test below would pass vacuously.
    expect(nullableColumns(table).length).toBeGreaterThan(0);
  });

  it.each(CASES)('$table', ({ table, row, fromRow, keep = [] }) => {
    const withNulls = row();
    for (const column of nullableColumns(table)) {
      if (!keep.includes(column)) withNulls[column] = null;
    }

    const model = fromRow(withNulls as never);

    expect(nullsIn(model)).toEqual([]);
  });
});
