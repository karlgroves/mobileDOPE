/** The epoch in SQLite's `datetime('now')` format: where a row with no date sorts. */
export const DB_EPOCH = '1970-01-01 00:00:00';

/**
 * Parse a timestamp as it was stored in the SQLite database (#228).
 *
 * Columns defaulted with SQLite's `datetime('now')` store UTC without a zone
 * marker ("2026-11-06 19:43:09"). `new Date()` reads a zone-less string as
 * *local* time, so east of UTC a moment stored minutes ago reads as hours in
 * the future and west of UTC as hours old -- and every duration, sort and
 * display built on that reading is wrong unless the zone is supplied here.
 *
 * Rows the app wrote itself (a backup restore, an imported log) carry a zone
 * already -- ISO 8601 -- and Date parses those correctly as-is, so anything
 * that is not a zone-less SQLite timestamp gets `new Date(value)`'s own
 * answer, `Invalid Date` for garbage included.
 */
export const parseDbTimestamp = (value: string): Date => {
  // SQLite's `datetime('now')` format: "YYYY-MM-DD HH:MM:SS", always UTC; the
  // fractional seconds `strftime('%f')` adds are accepted too.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)) {
    return new Date(`${value.replace(' ', 'T')}Z`);
  }

  return new Date(value);
};
