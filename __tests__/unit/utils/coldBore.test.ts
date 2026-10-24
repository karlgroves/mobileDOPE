import {
  COLD_BORE_GAP_MINUTES,
  describeColdBoreSuggestion,
  suggestColdBore,
} from '../../../src/utils/coldBore';

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

/**
 * What the hint under the control actually claims (#164).
 *
 * The first cut interpolated `COLD_BORE_GAP_MINUTES` -- the *threshold* -- into
 * a sentence that reads as a statement about the elapsed time: "Suggested from
 * the 10 minutes since this rifle last fired." On a rifle that last fired three
 * days ago that sentence is simply false, and it was false on every suggestion
 * the rule ever made except one at almost exactly ten minutes.
 *
 * That matters more here than a wording slip usually would. #164's requirement
 * is that cold bore is "never silently assumed" -- the hint exists to let the
 * shooter check the app's reasoning. A hint that misstates the reasoning is
 * worse than no hint, because it invites them to confirm it and they cannot.
 *
 * So these assert the sentence against the gap it is describing.
 */
describe('describeColdBoreSuggestion (#164)', () => {
  it('says the rifle has no earlier logs rather than inventing a gap', () => {
    const hint = describeColdBoreSuggestion(undefined, NOW);

    expect(hint).toContain('no earlier logs');
    // The gap rule did not decide this one, so it must not be cited.
    expect(hint).not.toContain(String(COLD_BORE_GAP_MINUTES));
  });

  it('reports the real gap, not the threshold, when it suggests cold', () => {
    expect(describeColdBoreSuggestion(minutesAgo(3 * 24 * 60), NOW)).toBe(
      'Suggested because this rifle last fired 3 days ago, more than the 10-minute cold-bore gap. Change it if that is wrong.'
    );
  });

  it('reports the real gap when it suggests warm', () => {
    expect(describeColdBoreSuggestion(minutesAgo(4), NOW)).toBe(
      'Suggested because this rifle fired 4 minutes ago, inside the 10-minute cold-bore gap. Change it if that is wrong.'
    );
  });

  it('never states the threshold as though it were the elapsed time', () => {
    // The defect, pinned directly: the old sentence said "the 10 minutes since
    // this rifle last fired" whatever the gap actually was.
    for (const minutes of [0, 1, 4, 9, 11, 60, 90, 24 * 60, 10 * 24 * 60]) {
      expect(describeColdBoreSuggestion(minutesAgo(minutes), NOW)).not.toContain(
        `the ${COLD_BORE_GAP_MINUTES} minutes since`
      );
    }
  });

  it('reads in minutes, hours and days as the gap grows', () => {
    expect(describeColdBoreSuggestion(minutesAgo(1), NOW)).toContain('1 minute ago');
    expect(describeColdBoreSuggestion(minutesAgo(45), NOW)).toContain('45 minutes ago');
    expect(describeColdBoreSuggestion(minutesAgo(60), NOW)).toContain('1 hour ago');
    expect(describeColdBoreSuggestion(minutesAgo(5 * 60), NOW)).toContain('5 hours ago');
    expect(describeColdBoreSuggestion(minutesAgo(24 * 60), NOW)).toContain('1 day ago');
    expect(describeColdBoreSuggestion(minutesAgo(9 * 24 * 60), NOW)).toContain('9 days ago');
  });

  it('agrees with suggestColdBore about which side of the gap it is on', () => {
    // Two functions reading the same timestamp must not disagree: a hint that
    // says "inside the gap" under a control reading "Cold bore" is the failure
    // this guards.
    for (const minutes of [0, 1, 9, 10, 11, 60, 24 * 60]) {
      const at = minutesAgo(minutes);
      const saysCold = describeColdBoreSuggestion(at, NOW).includes('more than');
      expect(saysCold).toBe(suggestColdBore(at, NOW));
    }
  });

  it('does not claim a gap it cannot measure', () => {
    // An unparseable or future timestamp still suggests cold (see above), but
    // there is no honest elapsed time to report for either.
    for (const at of ['not a date', new Date(NOW.getTime() + 3_600_000).toISOString()]) {
      const hint = describeColdBoreSuggestion(at, NOW);
      expect(hint).toContain('could not be read');
      expect(hint).not.toMatch(/\d+ (minute|hour|day)/);
    }
  });
});
