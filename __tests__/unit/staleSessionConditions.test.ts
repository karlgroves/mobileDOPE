import {
  conditionsToMatch,
  describeSnapshotAge,
  matchesCaption,
} from '../../src/utils/matchConditions';

/**
 * Starting a range session must not make old air look new (#192).
 *
 * `RangeSessionStart` copies the latest environment snapshot so the session has
 * an environment of its own. It used to stamp that copy with `new Date()`, so
 * conditions measured weeks ago came back dated minutes ago. Since #190 the
 * DOPE ranking only compares against the latest snapshot while it is under a
 * day old -- and a re-stamped copy is always under a day old, so every session
 * start defeated that limit and stale air was ranked as "conditions similar to
 * your latest snapshot".
 *
 * This suite covers the rule itself: the age that reaches `conditionsToMatch`
 * is the age of the *measurement*, and the words shown to the shooter say so.
 * The screen's own behaviour is in
 * `__tests__/components/screens/staleSessionStart.test.tsx`; the repository's
 * read-back of the schema default is in
 * `__tests__/unit/services/EnvironmentRepository.test.ts`.
 */

const THIRTY_DAYS_MS = 30 * 86_400_000;

/** The reduced shape `conditionsToMatch` ranks on, plus the timestamp it ages. */
const snapshotAt = (timestamp: string | undefined) => ({
  temperature: 59,
  humidity: 50,
  pressure: 29.92,
  altitude: 0,
  windSpeed: 5,
  windDirection: 90,
  timestamp,
});

describe('a session-start copy carries the measurement time (#192)', () => {
  const now = new Date('2026-10-28T12:00:00.000Z');
  const measuredAt = new Date(now.getTime() - THIRTY_DAYS_MS).toISOString();

  it('ranks against nothing when the copied conditions were measured 30 days ago', () => {
    // What the fixed session start writes: the source snapshot's own timestamp.
    const { environment, source } = conditionsToMatch(null, [snapshotAt(measuredAt)], now);

    expect(source).toBe('stale-snapshot');
    expect(environment).toBeUndefined();
    expect(matchesCaption(3, source)).toBe(
      'Based on 3 logs. Conditions not compared: the latest snapshot is over 24 hours old.'
    );
  });

  it('is what the old re-stamping defeated: now() makes the same air comparable', () => {
    // Pins the regression rather than only the fix. This is exactly what the
    // screen used to produce, and it must not be what `conditionsToMatch` sees.
    const restamped = conditionsToMatch(null, [snapshotAt(now.toISOString())], now);

    expect(restamped.source).toBe('latest-snapshot');
    expect(restamped.environment).toBeDefined();
  });

  it('still compares against conditions measured an hour ago', () => {
    const anHourAgo = new Date(now.getTime() - 3_600_000).toISOString();

    expect(conditionsToMatch(null, [snapshotAt(anHourAgo)], now).source).toBe('latest-snapshot');
  });

  it('treats a copy with no timestamp as not comparable, not as fresh', () => {
    // The in-memory list used to hold an undated snapshot after any create that
    // relied on the schema default, because the repository never read it back.
    expect(conditionsToMatch(null, [snapshotAt(undefined)], now).source).toBe('undated-snapshot');
  });
});

describe('describeSnapshotAge (#192)', () => {
  const now = new Date('2026-10-28T12:00:00.000Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it('counts whole days once a snapshot is a day or more old', () => {
    expect(describeSnapshotAge(ago(THIRTY_DAYS_MS), now)).toBe('30 days old');
    expect(describeSnapshotAge(ago(86_400_000), now)).toBe('1 day old');
  });

  it('counts whole hours below a day', () => {
    expect(describeSnapshotAge(ago(3 * 3_600_000), now)).toBe('3 hours old');
    expect(describeSnapshotAge(ago(3_600_000), now)).toBe('1 hour old');
  });

  it('says so rather than rounding to zero under an hour', () => {
    expect(describeSnapshotAge(ago(60_000), now)).toBe('under an hour old');
  });

  it('does not claim an age it cannot establish', () => {
    expect(describeSnapshotAge(undefined, now)).toBe('of unknown age');
    expect(describeSnapshotAge('not a date', now)).toBe('of unknown age');
    // A snapshot dated in the future is a wrong clock, not a fresh reading --
    // the same call `conditionsToMatch` makes.
    expect(describeSnapshotAge(new Date(now.getTime() + 3_600_000).toISOString(), now)).toBe(
      'of unknown age'
    );
  });
});
