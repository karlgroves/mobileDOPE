import { DOPELog } from '../../../src/models/DOPELog';
import { COLD_BORE_GAP_MINUTES, suggestColdBore } from '../../../src/utils/coldBore';

/**
 * The cold-bore suggestion on New DOPE Log (#164).
 *
 * A barrel is cold when it has had time to cool, which the app can only infer
 * from the gap since the last shot at the same rifle. The inference is a
 * *suggestion*: #164 says it is never silently assumed, so the function returns
 * `undefined` -- not recorded -- whenever it has no evidence either way, and
 * the screen shows what it chose and why.
 */

const NOW = new Date('2026-10-22T18:00:00.000Z');

const logAt = (timestamp: string, rifleId = 1): DOPELog =>
  new DOPELog({
    rifleId,
    ammoId: 1,
    environmentId: 1,
    distance: 600,
    distanceUnit: 'yards',
    elevationCorrection: 4.1,
    windageCorrection: 0.3,
    correctionUnit: 'MIL',
    targetType: 'steel',
    timestamp,
  });

describe('suggestColdBore (#164)', () => {
  it('suggests cold bore when the rifle has no logs at all', () => {
    expect(suggestColdBore([], 1, NOW)).toBe(true);
  });

  it('suggests cold bore when the last shot is older than the gap', () => {
    const eleven = new Date(NOW.getTime() - 11 * 60_000).toISOString();
    expect(suggestColdBore([logAt(eleven)], 1, NOW)).toBe(true);
  });

  it('suggests warm bore when the last shot is inside the gap', () => {
    const two = new Date(NOW.getTime() - 2 * 60_000).toISOString();
    expect(suggestColdBore([logAt(two)], 1, NOW)).toBe(false);
  });

  it('treats exactly the gap as still warm', () => {
    // "More than 10 minutes" in #164. The boundary has to fall somewhere and
    // the issue's wording puts it here; a shot at exactly 10:00 is not yet old.
    const exactly = new Date(NOW.getTime() - COLD_BORE_GAP_MINUTES * 60_000).toISOString();
    expect(suggestColdBore([logAt(exactly)], 1, NOW)).toBe(false);
  });

  it('only looks at the rifle in hand', () => {
    // A different rifle fired two minutes ago says nothing about this barrel.
    const two = new Date(NOW.getTime() - 2 * 60_000).toISOString();
    expect(suggestColdBore([logAt(two, 2)], 1, NOW)).toBe(true);
  });

  it('uses the most recent log, not the first in the list', () => {
    const old = new Date(NOW.getTime() - 90 * 60_000).toISOString();
    const recent = new Date(NOW.getTime() - 60_000).toISOString();
    expect(suggestColdBore([logAt(recent), logAt(old)], 1, NOW)).toBe(false);
    expect(suggestColdBore([logAt(old), logAt(recent)], 1, NOW)).toBe(false);
  });

  it('declines to guess when no rifle is chosen yet', () => {
    const two = new Date(NOW.getTime() - 2 * 60_000).toISOString();
    expect(suggestColdBore([logAt(two)], undefined, NOW)).toBeUndefined();
  });

  it('ignores a log with no usable timestamp rather than reading it as ancient', () => {
    // `new Date(undefined).getTime()` is NaN, and every comparison against NaN
    // is false -- so an untimestamped log read as "recent" would suppress a
    // correct cold-bore suggestion without anything looking wrong.
    const recent = new Date(NOW.getTime() - 60_000).toISOString();
    expect(suggestColdBore([logAt('not a date')], 1, NOW)).toBe(true);
    expect(suggestColdBore([logAt('not a date'), logAt(recent)], 1, NOW)).toBe(false);
  });

  it('does not treat a log recorded in the future as a recent shot', () => {
    // A restored backup from a device with a skewed clock. Dialling this back
    // to "warm" on the strength of a shot that has not happened is worse than
    // declining to guess.
    const future = new Date(NOW.getTime() + 60 * 60_000).toISOString();
    expect(suggestColdBore([logAt(future)], 1, NOW)).toBe(true);
  });
});
