import { COLD_BORE_GAP_MINUTES, suggestColdBore } from '../../../src/utils/coldBore';

/**
 * The cold-bore suggestion on New DOPE Log (#164).
 *
 * A barrel is cold when it has had time to cool, which the app can only infer
 * from the gap since the last shot from that rifle. The inference is a
 * *suggestion*: #164 says it is never silently assumed, so the screen shows
 * what this returned and why, and the shooter can overrule it.
 */

const NOW = new Date('2026-10-22T18:00:00.000Z');
const minutesAgo = (n: number): string => new Date(NOW.getTime() - n * 60_000).toISOString();

describe('suggestColdBore (#164)', () => {
  it('suggests cold bore when the rifle has never fired', () => {
    expect(suggestColdBore(undefined, NOW)).toBe(true);
  });

  it('suggests cold bore when the last shot is older than the gap', () => {
    expect(suggestColdBore(minutesAgo(11), NOW)).toBe(true);
  });

  it('suggests warm bore when the last shot is inside the gap', () => {
    expect(suggestColdBore(minutesAgo(2), NOW)).toBe(false);
  });

  it('treats exactly the gap as still warm', () => {
    // "More than 10 minutes" in #164. The boundary has to fall somewhere and
    // the issue's wording puts it here; a shot at exactly 10:00 is not yet old.
    expect(suggestColdBore(minutesAgo(COLD_BORE_GAP_MINUTES), NOW)).toBe(false);
  });

  it('suggests cold bore one second past the gap', () => {
    const justPast = new Date(NOW.getTime() - COLD_BORE_GAP_MINUTES * 60_000 - 1000).toISOString();
    expect(suggestColdBore(justPast, NOW)).toBe(true);
  });

  it('does not read an unparseable timestamp as a recent shot', () => {
    // `new Date('not a date').getTime()` is NaN, and every comparison against
    // NaN is false -- so `now - at < gap` would be false too and the shot
    // would look recent, suppressing a correct cold-bore suggestion with
    // nothing looking wrong.
    expect(suggestColdBore('not a date', NOW)).toBe(true);
  });

  it('does not read a timestamp in the future as a recent shot', () => {
    // A backup restored from a device with a skewed clock. Dialling this back
    // to "warm" on the strength of a shot that has not happened is worse than
    // suggesting cold and being overruled.
    expect(suggestColdBore(new Date(NOW.getTime() + 60 * 60_000).toISOString(), NOW)).toBe(true);
  });
});
