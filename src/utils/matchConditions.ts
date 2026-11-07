/**
 * Which conditions to rank logged DOPE against, and how to say so (#187).
 *
 * `useEnvironmentStore().current` is null until the shooter opens Environment
 * and taps "Update Current", which on a cold launch is almost never before the
 * first solve. The most recent snapshot stands in for it -- but only while it
 * is recent. A snapshot from another range weeks ago is a wrong opinion about
 * today's air, where no snapshot is no opinion, and `environmentSimilarity`
 * cannot tell the two apart. So a snapshot is used only when it can be shown
 * to be under a day old, and the caption names whichever case applied.
 */

import type { MatchableEnvironment } from './dopeMatching';

/** A snapshot older than this is not used as today's air. */
export const MAX_SNAPSHOT_AGE_MS = 24 * 60 * 60 * 1000;

/** Where the ranking's conditions came from, or why there were none. */
export type MatchConditionsSource =
  | 'current'
  | 'latest-snapshot'
  | 'stale-snapshot'
  | 'undated-snapshot'
  | 'none';

/** The conditions chosen for ranking, with the case that produced them. */
export interface MatchConditions {
  /** The conditions to rank against; undefined leaves that factor neutral. */
  environment?: MatchableEnvironment;
  source: MatchConditionsSource;
}

/** SQLite's `datetime('now')`: UTC, space-separated, no zone designator. */
const SQLITE_DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/;

/**
 * Epoch milliseconds of a snapshot timestamp.
 *
 * The schema default writes `YYYY-MM-DD HH:MM:SS` in UTC with no zone, which a
 * bare `Date.parse` reads as local time -- hours out anywhere but UTC, enough
 * to move a snapshot across the 24-hour line. Restored backups carry ISO.
 *
 * @param timestamp - The stored timestamp, if any.
 * @returns Milliseconds since the epoch, or undefined when it cannot be read.
 */
export const snapshotTime = (timestamp: string | undefined): number | undefined => {
  if (timestamp === undefined) return undefined;
  const iso = SQLITE_DATETIME.test(timestamp) ? `${timestamp.replace(' ', 'T')}Z` : timestamp;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? undefined : time;
};

/**
 * Pick the conditions to rank against.
 *
 * @param current - What the shooter set, or null if nothing has been.
 * @param snapshots - Stored snapshots, most recent first (the repository orders
 *   by timestamp descending and `createSnapshot` prepends).
 * @param now - The time to measure the snapshot's age from.
 * @returns The conditions, and which case produced them.
 */
export const conditionsToMatch = (
  current: MatchableEnvironment | null | undefined,
  snapshots: readonly (MatchableEnvironment & { timestamp?: string })[],
  now: Date = new Date()
): MatchConditions => {
  if (current) return { environment: current, source: 'current' };

  const latest = snapshots[0];
  if (latest === undefined) return { source: 'none' };

  const taken = snapshotTime(latest.timestamp);
  const age = taken === undefined ? undefined : now.getTime() - taken;
  // A snapshot dated in the future is a wrong clock: its age is not known, so
  // it cannot be shown to be recent.
  if (age === undefined || age < 0) return { source: 'undated-snapshot' };
  if (age >= MAX_SNAPSHOT_AGE_MS) return { source: 'stale-snapshot' };
  return { environment: latest, source: 'latest-snapshot' };
};

/**
 * How old a snapshot is, in the words a warning uses (#192).
 *
 * Deliberately refuses to name an age it cannot establish: an unparseable or
 * future-dated timestamp returns "of unknown age" rather than a number, for the
 * same reason `conditionsToMatch` returns `undated-snapshot` for both -- a
 * figure the reader would trust is worse than an admission.
 *
 * @param timestamp - The stored timestamp, if any.
 * @param now - The time to measure from.
 * @returns A phrase that completes "the conditions are ...".
 */
export const describeSnapshotAge = (
  timestamp: string | undefined,
  now: Date = new Date()
): string => {
  const taken = snapshotTime(timestamp);
  if (taken === undefined) return 'of unknown age';

  const age = now.getTime() - taken;
  if (age < 0) return 'of unknown age';
  if (age < 3_600_000) return 'under an hour old';

  const hours = Math.floor(age / 3_600_000);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} old`;

  const days = Math.floor(age / 86_400_000);
  return `${days} ${days === 1 ? 'day' : 'days'} old`;
};

/**
 * The line under the adjustment, saying what the logs were compared with.
 *
 * @param count - Logs that contributed.
 * @param source - Where the conditions came from.
 * @returns The caption.
 */
export const matchesCaption = (count: number, source: MatchConditionsSource): string => {
  const base = `Based on ${count} ${count === 1 ? 'log' : 'logs'}`;
  switch (source) {
    case 'current':
      return `${base} from similar conditions.`;
    case 'latest-snapshot':
      return `${base} from conditions similar to your latest snapshot.`;
    case 'stale-snapshot':
      return `${base}. Conditions not compared: the latest snapshot is over 24 hours old.`;
    case 'undated-snapshot':
      return `${base}. Conditions not compared: the latest snapshot's time is unknown.`;
    case 'none':
      return `${base}.`;
  }
};
