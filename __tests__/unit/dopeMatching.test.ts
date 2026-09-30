import {
  DEFAULT_DISTANCE_DELTA,
  DEFAULT_WEIGHTS,
  DEFAULT_RECENCY_HALF_LIFE_DAYS,
  DEFAULT_SIGMA_YARDS,
  distanceSimilarity,
  environmentSimilarity,
  logDistanceInYards,
  queryCandidates,
  rankMatches,
  recencyFactor,
  scoreRelevance,
  shotQuality,
} from '../../src/utils/dopeMatching';

import type { MatchableLog } from '../../src/utils/dopeMatching';

/**
 * DOPE matching (#70, section 1).
 *
 * The job is to find the logs that actually resemble the shot in front of you.
 * Every failure mode here is quiet: a scorer that ranks the wrong logs first
 * still returns an answer, and the correction derived from it is wrong by an
 * amount nobody can see. So these tests pin the ORDERING and the boundaries,
 * not just that a number comes back.
 */

// Anchored to MatchableLog rather than to logDistanceInYards' parameter. That
// function now lives in distanceUnits and takes the narrower { distance,
// distanceUnit } shape, which is not what the query functions here want.
type Log = MatchableLog & Record<string, unknown>;

const log = (over: Partial<Log> = {}): Log =>
  ({
    id: 1,
    rifleId: 1,
    ammoId: 1,
    distance: 600,
    distanceUnit: 'yards',
    timestamp: '2026-09-16T00:00:00Z',
    ...over,
  }) as Log;

const NOW = new Date('2026-09-16T00:00:00Z');

describe('logDistanceInYards', () => {
  it('converts a log recorded in meters', () => {
    // A log in meters compared against a shot in yards without converting is
    // out by 9%, which at 600 is 55 yards -- larger than the default delta.
    // It would silently drop the very logs it should be matching.
    expect(logDistanceInYards(log({ distance: 600, distanceUnit: 'meters' }))).toBeCloseTo(
      656.2,
      1
    );
  });

  it('leaves a log already in yards alone', () => {
    expect(logDistanceInYards(log({ distance: 600 }))).toBe(600);
  });

  it('treats a missing unit as yards, the app default', () => {
    expect(logDistanceInYards(log({ distanceUnit: undefined }))).toBe(600);
  });
});

describe('queryCandidates', () => {
  const target = { rifleId: 1, ammoId: 1, distance: 600 };

  it('keeps only the same rifle and load', () => {
    const logs = [log(), log({ id: 2, rifleId: 2 }), log({ id: 3, ammoId: 2 })];

    expect(queryCandidates(logs, target).map((l) => l.id)).toEqual([1]);
  });

  it('keeps logs within the distance delta, inclusive at the edge', () => {
    const logs = [
      log({ id: 1, distance: 600 - DEFAULT_DISTANCE_DELTA }),
      log({ id: 2, distance: 600 + DEFAULT_DISTANCE_DELTA }),
      log({ id: 3, distance: 600 + DEFAULT_DISTANCE_DELTA + 1 }),
    ];

    expect(queryCandidates(logs, target).map((l) => l.id)).toEqual([1, 2]);
  });

  it('compares across units rather than across raw numbers', () => {
    // 550 metres is 601 yards: a match. Comparing the raw 550 against 600 would
    // put it 50 out -- at the very edge -- and a metric user's whole history
    // would sit at the boundary of every query.
    const logs = [log({ distance: 550, distanceUnit: 'meters' })];

    expect(queryCandidates(logs, target)).toHaveLength(1);
  });

  it('honours a custom delta', () => {
    const logs = [log({ distance: 610 })];

    expect(queryCandidates(logs, target, 5)).toHaveLength(0);
    expect(queryCandidates(logs, target, 20)).toHaveLength(1);
  });

  it('returns nothing rather than everything when there is no history', () => {
    expect(queryCandidates([], target)).toEqual([]);
  });
});

describe('distanceSimilarity', () => {
  it('is 1 for the same distance', () => {
    expect(distanceSimilarity(600, 600)).toBe(1);
  });

  it('falls to exp(-1/2) at one sigma', () => {
    // The Gaussian the issue specifies: exp(-(d1-d2)^2 / (2*sigma^2)).
    expect(distanceSimilarity(600, 600 + DEFAULT_SIGMA_YARDS)).toBeCloseTo(Math.exp(-0.5), 10);
  });

  it('is symmetric', () => {
    expect(distanceSimilarity(600, 650)).toBe(distanceSimilarity(650, 600));
  });

  it('decreases monotonically with separation', () => {
    const scores = [0, 10, 25, 50, 100, 200].map((d) => distanceSimilarity(600, 600 + d));
    const sorted = [...scores].sort((a, b) => b - a);

    expect(scores).toEqual(sorted);
  });

  it('still scores above zero at the edge of the query window', () => {
    // A log the query let through must never score a flat 0, or it would be
    // indistinguishable from no match at all. Far beyond the window the
    // Gaussian underflows to 0 in double precision -- true, and harmless,
    // because `queryCandidates` has already excluded anything that far out.
    expect(distanceSimilarity(600, 600 + DEFAULT_DISTANCE_DELTA)).toBeGreaterThan(0);
    expect(distanceSimilarity(600, 600 - DEFAULT_DISTANCE_DELTA)).toBeGreaterThan(0);
  });

  it('treats a non-positive sigma as an exact-match-only comparison', () => {
    // Guarding this matters: sigma comes from user settings, and dividing by
    // zero would make every score NaN, which sorts unpredictably.
    expect(distanceSimilarity(600, 600, 0)).toBe(1);
    expect(distanceSimilarity(600, 601, 0)).toBe(0);
  });
});

describe('recencyFactor', () => {
  it('is 1 for a log recorded now', () => {
    expect(recencyFactor('2026-09-16T00:00:00Z', NOW)).toBe(1);
  });

  it('is exactly a half at one half-life', () => {
    const old = new Date(NOW.getTime() - DEFAULT_RECENCY_HALF_LIFE_DAYS * 86400000);

    expect(recencyFactor(old.toISOString(), NOW)).toBeCloseTo(0.5, 10);
  });

  it('is a quarter at two half-lives', () => {
    const old = new Date(NOW.getTime() - 2 * DEFAULT_RECENCY_HALF_LIFE_DAYS * 86400000);

    expect(recencyFactor(old.toISOString(), NOW)).toBeCloseTo(0.25, 10);
  });

  it('can be disabled, which the issue asks for', () => {
    const old = new Date(NOW.getTime() - 5 * 365 * 86400000).toISOString();

    expect(recencyFactor(old, NOW, Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('does not reward a log dated in the future', () => {
    // A device with a wrong clock, or a hand-edited backup, must not be able to
    // out-rank every genuine log by claiming to be from next year.
    const future = new Date(NOW.getTime() + 365 * 86400000).toISOString();

    expect(recencyFactor(future, NOW)).toBe(1);
  });

  it('treats an unusable timestamp as neutral rather than as ancient', () => {
    // A log with no timestamp is missing data, not old data. Scoring it as
    // ancient would bury genuine entries logged before timestamps were kept.
    expect(recencyFactor(undefined, NOW)).toBe(1);
    expect(recencyFactor('not a date', NOW)).toBe(1);
  });
});

describe('environmentSimilarity', () => {
  const conditions = { temperature: 59, pressure: 29.92, altitude: 0 };

  it('is 1 for identical conditions', () => {
    expect(environmentSimilarity(conditions, conditions)).toBe(1);
  });

  it('ranks a closer density altitude higher', () => {
    const denver = { temperature: 59, pressure: 29.92, altitude: 5280 };
    const highest = { temperature: 59, pressure: 29.92, altitude: 12000 };

    expect(environmentSimilarity(conditions, denver)).toBeGreaterThan(
      environmentSimilarity(conditions, highest)
    );
  });

  it('separates sea level from the mountains, which the issue calls out', () => {
    const mountain = { temperature: 30, pressure: 24.9, altitude: 10000 };

    expect(environmentSimilarity(conditions, mountain)).toBeLessThan(0.5);
  });

  it('is symmetric', () => {
    const other = { temperature: 85, pressure: 29.5, altitude: 2000 };

    expect(environmentSimilarity(conditions, other)).toBeCloseTo(
      environmentSimilarity(other, conditions),
      10
    );
  });

  it('is neutral when a log carries no environment at all', () => {
    // Older logs predate environment capture. Scoring them 0 would exclude a
    // shooter's entire early history from their own recommendations.
    expect(environmentSimilarity(conditions, undefined)).toBe(0.5);
  });

  it('uses a stored density altitude in preference to recomputing one', () => {
    // The snapshot's own figure is what the shooter saw at the time.
    const stored = { temperature: 59, pressure: 29.92, altitude: 0, densityAltitude: 8000 };

    expect(environmentSimilarity(conditions, stored)).toBeLessThan(
      environmentSimilarity(conditions, { ...stored, densityAltitude: 0 })
    );
  });
});

describe('shotQuality', () => {
  it('is neutral when nothing was recorded', () => {
    // A one-tap log with no group size is not a bad group.
    expect(shotQuality(log())).toBe(0.5);
  });

  it('ranks a tighter group higher', () => {
    const tight = shotQuality(log({ groupSize: 0.5, shotCount: 5 }));
    const loose = shotQuality(log({ groupSize: 3, shotCount: 5 }));

    expect(tight).toBeGreaterThan(loose);
  });

  it('rewards a sub-MOA group, which the issue asks for', () => {
    expect(shotQuality(log({ groupSize: 0.8, shotCount: 5 }))).toBeGreaterThan(0.5);
  });

  it('ranks a full hit rate above a partial one', () => {
    const all = shotQuality(log({ hitCount: 5, shotCount: 5 }));
    const half = shotQuality(log({ hitCount: 2, shotCount: 5 }));

    expect(all).toBeGreaterThan(half);
  });

  it('ignores a group size measured over a single shot', () => {
    // One shot has no group. A recorded 0.0 there is an artefact, and treating
    // it as a perfect group would float every single-shot log to the top.
    expect(shotQuality(log({ groupSize: 0, shotCount: 1 }))).toBe(0.5);
  });

  it('is not fooled by a hit count larger than the shot count', () => {
    expect(shotQuality(log({ hitCount: 9, shotCount: 5 }))).toBeLessThanOrEqual(1);
  });

  it('does not let an impossible hit rate paper over a bad group', () => {
    // 9 hits from 5 shots is corrupt data. Averaged in unclamped it would drag
    // a 4 MOA group up to a top score, which is the wrong direction entirely.
    const corrupt = shotQuality(log({ groupSize: 4, shotCount: 5, hitCount: 9 }));
    const honest = shotQuality(log({ groupSize: 4, shotCount: 5, hitCount: 5 }));

    expect(corrupt).toBe(honest);
    expect(corrupt).toBeLessThan(1);
  });

  it('stays within 0 and 1 for an absurd group', () => {
    const score = shotQuality(log({ groupSize: 500, shotCount: 5 }));

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('scoreRelevance', () => {
  const target = {
    rifleId: 1,
    ammoId: 1,
    distance: 600,
    environment: { temperature: 59, pressure: 29.92, altitude: 0 },
    timestamp: NOW.toISOString(),
  };

  it('scores an identical log at the top of the range', () => {
    const identical = log({
      distance: 600,
      environment: target.environment,
      groupSize: 0.4,
      shotCount: 5,
      hitCount: 5,
    });

    expect(scoreRelevance(identical, target).score).toBeGreaterThan(0.9);
  });

  it('stays within 0 and 1 whatever the weights are', () => {
    const weights = { distance: 17, environment: 0, recency: 3, quality: 100 };
    const score = scoreRelevance(log({ distance: 900 }), target, { weights }).score;

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('does not move when every weight is scaled by the same factor', () => {
    // Doubling every weight expresses the same preferences, so the relevance
    // the user is shown must not change. Without normalising by the weight
    // total the score would just grow until it clamped at 1, and every log
    // would look like a perfect match.
    const entry = log({ distance: 640 });
    const base = scoreRelevance(entry, target, { weights: DEFAULT_WEIGHTS }).score;
    const scaled = scoreRelevance(entry, target, {
      weights: {
        distance: DEFAULT_WEIGHTS.distance * 10,
        environment: DEFAULT_WEIGHTS.environment * 10,
        recency: DEFAULT_WEIGHTS.recency * 10,
        quality: DEFAULT_WEIGHTS.quality * 10,
      },
    }).score;

    expect(scaled).toBeCloseTo(base, 10);
    expect(base).toBeLessThan(1);
  });

  it('gives a defined answer when weights cancel out to zero', () => {
    // Reachable from settings that allow a negative weight. Dividing by a zero
    // total would give +/-Infinity, and an Infinity ranks above every genuine
    // match rather than failing visibly.
    const weights = { distance: -1, environment: 1, recency: 0, quality: 0 };
    const score = scoreRelevance(log(), target, { weights }).score;

    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBe(0);
  });

  it('reports the factors, so a recommendation can say why', () => {
    const { factors } = scoreRelevance(log(), target);

    expect(Object.keys(factors).sort()).toEqual(['distance', 'environment', 'quality', 'recency']);
  });

  it('falls back to distance alone when every other weight is zero', () => {
    const weights = { distance: 1, environment: 0, recency: 0, quality: 0 };
    const near = scoreRelevance(log({ distance: 605 }), target, { weights }).score;
    const far = scoreRelevance(log({ distance: 700 }), target, { weights }).score;

    expect(near).toBeGreaterThan(far);
  });

  it('does not produce NaN when every weight is zero', () => {
    // Settings can reach this state. NaN sorts unpredictably, so a silent NaN
    // would scramble the ranking rather than fail.
    const weights = { distance: 0, environment: 0, recency: 0, quality: 0 };

    expect(scoreRelevance(log(), target, { weights }).score).toBe(0);
  });
});

describe('rankMatches', () => {
  const target = {
    rifleId: 1,
    ammoId: 1,
    distance: 600,
    environment: { temperature: 59, pressure: 29.92, altitude: 0 },
    timestamp: NOW.toISOString(),
  };

  const history = [
    log({ id: 1, distance: 600, environment: target.environment }),
    log({ id: 2, distance: 630, environment: target.environment }),
    log({ id: 3, distance: 575, environment: target.environment }),
    log({ id: 4, distance: 900, environment: target.environment }),
    log({ id: 5, rifleId: 2, distance: 600, environment: target.environment }),
  ];

  it('puts the closest match first', () => {
    expect(rankMatches(history, target)[0].log.id).toBe(1);
  });

  it('excludes another rifle entirely, however good the match otherwise', () => {
    expect(rankMatches(history, target).map((m) => m.log.id)).not.toContain(5);
  });

  it('excludes a log outside the delta', () => {
    expect(rankMatches(history, target).map((m) => m.log.id)).not.toContain(4);
  });

  it('is sorted by descending score', () => {
    const scores = rankMatches(history, target).map((m) => m.score);

    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('caps the result at the requested count', () => {
    expect(rankMatches(history, target, { limit: 2 })).toHaveLength(2);
  });

  it('returns an empty ranking rather than throwing when nothing matches', () => {
    expect(rankMatches([], target)).toEqual([]);
    expect(rankMatches(history, { ...target, distance: 50 })).toEqual([]);
  });

  it('breaks ties deterministically instead of depending on array order', () => {
    // Two logs that score identically must not swap places between runs, or the
    // recommendation changes without the data changing.
    const tied = [
      log({ id: 7, distance: 620, environment: target.environment }),
      log({ id: 3, distance: 580, environment: target.environment }),
    ];
    const forwards = rankMatches(tied, target).map((m) => m.log.id);
    const backwards = rankMatches([...tied].reverse(), target).map((m) => m.log.id);

    expect(forwards).toEqual(backwards);
  });

  it('prefers the recent log when two are otherwise identical', () => {
    const older = new Date(NOW.getTime() - 400 * 86400000).toISOString();
    const pair = [
      log({ id: 1, distance: 600, environment: target.environment, timestamp: older }),
      log({ id: 2, distance: 600, environment: target.environment }),
    ];

    expect(rankMatches(pair, target)[0].log.id).toBe(2);
  });

  it('prefers the log shot in similar air when distance and age are equal', () => {
    const pair = [
      log({ id: 1, distance: 600, environment: { temperature: 20, pressure: 24, altitude: 9000 } }),
      log({ id: 2, distance: 600, environment: target.environment }),
    ];

    expect(rankMatches(pair, target)[0].log.id).toBe(2);
  });
});
