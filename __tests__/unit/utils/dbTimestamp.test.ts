import { parseDbTimestamp } from '../../../src/utils/dbTimestamp';

/**
 * Timestamps read back from SQLite (#228).
 *
 * Columns defaulted with `datetime('now')` store UTC without a zone marker.
 * `new Date()` reads a zone-less string as *local* time, which put stored
 * moments hours in the future or hours in the past depending on the device's
 * zone. The helper has to answer the same instant `new Date` gives the
 * zone-marked spelling of the same moment.
 */
describe('parseDbTimestamp (#228)', () => {
  it('reads a zone-less SQLite timestamp as UTC', () => {
    expect(parseDbTimestamp('2026-11-06 19:43:09').getTime()).toBe(
      Date.parse('2026-11-06T19:43:09Z')
    );
  });

  it('reads fractional seconds, as strftime writes them, as UTC too', () => {
    expect(parseDbTimestamp('2026-11-06 19:43:09.123').getTime()).toBe(
      Date.parse('2026-11-06T19:43:09.123Z')
    );
  });

  it('reads a zone-less SQLite timestamp at the epoch boundary', () => {
    expect(parseDbTimestamp('1970-01-01 00:00:00').getTime()).toBe(0);
  });

  it('leaves an ISO timestamp with a zone to Date', () => {
    expect(parseDbTimestamp('2026-11-06T19:43:09.000Z').getTime()).toBe(
      Date.parse('2026-11-06T19:43:09.000Z')
    );
    expect(parseDbTimestamp('2026-11-06T19:43:09+05:00').getTime()).toBe(
      Date.parse('2026-11-06T19:43:09+05:00')
    );
  });

  it('answers Invalid Date for garbage, like Date does', () => {
    expect(Number.isNaN(parseDbTimestamp('not a date').getTime())).toBe(true);
  });
});
