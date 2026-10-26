import {
  conditionsToMatch,
  matchesCaption,
  MAX_SNAPSHOT_AGE_MS,
  snapshotTime,
} from '../../src/utils/matchConditions';

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-10-26T12:00:00Z');

const air = (over: Record<string, unknown> = {}) => ({
  temperature: 59,
  pressure: 29.92,
  altitude: 0,
  densityAltitude: 500,
  ...over,
});

const takenAgo = (ms: number) => air({ timestamp: new Date(NOW.getTime() - ms).toISOString() });

describe('conditionsToMatch (#187)', () => {
  it('uses the conditions the shooter set, whatever the snapshots say', () => {
    const current = air({ densityAltitude: 3000 });
    const picked = conditionsToMatch(current, [takenAgo(48 * HOUR)], NOW);
    expect(picked.source).toBe('current');
    expect(picked.environment).toBe(current);
  });

  it('falls back to the latest snapshot while it is under a day old', () => {
    const latest = takenAgo(23 * HOUR);
    const picked = conditionsToMatch(null, [latest, takenAgo(30 * HOUR)], NOW);
    expect(picked.source).toBe('latest-snapshot');
    expect(picked.environment).toBe(latest);
  });

  it('refuses a latest snapshot older than a day rather than ranking against it', () => {
    // A snapshot from another range weeks ago is a wrong opinion about today's
    // air, where no snapshot is no opinion. Only the second is honest.
    const picked = conditionsToMatch(null, [takenAgo(25 * HOUR)], NOW);
    expect(picked.source).toBe('stale-snapshot');
    expect(picked.environment).toBeUndefined();
  });

  it('treats exactly a day old as too old', () => {
    expect(conditionsToMatch(null, [takenAgo(MAX_SNAPSHOT_AGE_MS)], NOW).source).toBe(
      'stale-snapshot'
    );
    expect(MAX_SNAPSHOT_AGE_MS).toBe(24 * HOUR);
  });

  it('does not use a snapshot whose age cannot be established', () => {
    // No timestamp, an unparseable one, or one from the future (a wrong clock):
    // none of them shows the snapshot is under a day old.
    for (const timestamp of [
      undefined,
      'not a date',
      new Date(NOW.getTime() + HOUR).toISOString(),
    ]) {
      const picked = conditionsToMatch(null, [air({ timestamp })], NOW);
      expect(picked.source).toBe('undated-snapshot');
      expect(picked.environment).toBeUndefined();
    }
  });

  it('reports nothing to compare against when there are no snapshots', () => {
    const picked = conditionsToMatch(null, [], NOW);
    expect(picked.source).toBe('none');
    expect(picked.environment).toBeUndefined();
  });
});

describe('snapshotTime', () => {
  it("reads SQLite's datetime('now') format as UTC, which is what it writes", () => {
    // The schema default stores `YYYY-MM-DD HH:MM:SS` in UTC with no zone, and a
    // bare Date.parse reads that as local time -- hours off anywhere but UTC,
    // which is enough to move a snapshot across the 24-hour line.
    expect(snapshotTime('2026-10-25 13:00:00')).toBe(Date.parse('2026-10-25T13:00:00Z'));
  });

  it('reads an ISO timestamp as written', () => {
    expect(snapshotTime('2026-10-25T13:00:00.000Z')).toBe(Date.parse('2026-10-25T13:00:00Z'));
  });

  it('returns undefined for a missing or unparseable timestamp', () => {
    expect(snapshotTime(undefined)).toBeUndefined();
    expect(snapshotTime('yesterday-ish')).toBeUndefined();
  });
});

describe('matchesCaption', () => {
  it('claims similar conditions only when they are the ones the shooter set', () => {
    expect(matchesCaption(2, 'current')).toBe('Based on 2 logs from similar conditions.');
  });

  it('names the latest snapshot when that is what the logs were compared with', () => {
    expect(matchesCaption(1, 'latest-snapshot')).toBe(
      'Based on 1 log from conditions similar to your latest snapshot.'
    );
  });

  it('says why conditions were not compared when the latest snapshot is too old', () => {
    expect(matchesCaption(3, 'stale-snapshot')).toBe(
      'Based on 3 logs. Conditions not compared: the latest snapshot is over 24 hours old.'
    );
  });

  it('says why conditions were not compared when the snapshot has no usable time', () => {
    expect(matchesCaption(1, 'undated-snapshot')).toBe(
      "Based on 1 log. Conditions not compared: the latest snapshot's time is unknown."
    );
  });

  it('makes no claim at all when there are no conditions anywhere', () => {
    expect(matchesCaption(1, 'none')).toBe('Based on 1 log.');
  });
});
