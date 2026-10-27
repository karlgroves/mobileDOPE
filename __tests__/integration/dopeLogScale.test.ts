import { dopeLogRepository, environmentRepository } from '../../src/services/database';
import { useDOPEStore } from '../../src/store/useDOPEStore';
import { LOG_COUNT, SHOTS_PER_SESSION, seedLargeHistory } from '../helpers/largeHistory';
import { installTestDatabase, uninstallTestDatabase } from '../helpers/testDatabase';

import type { SeededHistory } from '../helpers/largeHistory';
import type { TestDatabase } from '../helpers/testDatabase';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../helpers/testDatabase').openDatabaseAsync(),
}));

/**
 * The queries the app runs return the right rows, in the right order, from a
 * history of over a thousand logs (#68, "measure database query performance
 * with 1000+ logs" -- the correctness half).
 *
 * The timing half is `__tests__/performance/dopeLogQueryPerformance.test.ts`,
 * outside `npm test` for the reason `jest.performance.config.js` gives. What is
 * here cannot flake: row counts, ordering, and the query plans SQLite chooses.
 *
 * The plans are the part that scales. A query that walks an index stays fast
 * however long the history grows; one that scans the table gets slower with
 * every log. Wall-clock time on an in-memory database on a laptop says little
 * about a phone's flash, but the plan is the same on both, so asserting it is
 * the scale guarantee that does not depend on the machine.
 */

describe('DOPE history at scale: the queries the app runs (#68)', () => {
  let db: TestDatabase;
  let seeded: SeededHistory;

  beforeAll(async () => {
    db = await installTestDatabase();
    seeded = await seedLargeHistory();
  });

  afterAll(async () => {
    await uninstallTestDatabase();
  });

  /** ISO strings sort as the instants they name. */
  const isDescending = (values: string[]) => values.every((v, i) => i === 0 || values[i - 1] >= v);

  /**
   * The plan SQLite chooses for whatever SQL `run` sends, captured as it is
   * sent -- so it is the repository's own query, not a copy that could drift.
   */
  const planOf = async (run: () => Promise<unknown>): Promise<string> => {
    const sent: { sql: string; params?: readonly unknown[] }[] = [];
    const { getAllAsync, getFirstAsync } = db;
    db.getAllAsync = (sql, params) => {
      sent.push({ sql, params });
      return getAllAsync(sql, params);
    };
    db.getFirstAsync = (sql, params) => {
      sent.push({ sql, params });
      return getFirstAsync(sql, params);
    };
    try {
      await run();
    } finally {
      db.getAllAsync = getAllAsync;
      db.getFirstAsync = getFirstAsync;
    }
    expect(sent).toHaveLength(1);
    const rows = await db.getAllAsync<{ detail: string }>(
      `EXPLAIN QUERY PLAN ${sent[0].sql}`,
      sent[0].params
    );
    return rows.map((row) => row.detail).join('\n');
  };

  /**
   * Finds its rows through an index on `dope_logs`, rather than reading every
   * row of it.
   *
   * A SEARCH, not merely an index: `SCAN dope_logs USING INDEX idx_dope_timestamp`
   * also names an index, but it reads the whole table in timestamp order. That is
   * the plan SQLite falls back to when the rifle index is dropped, so a check for
   * "an index" alone stays green exactly when it should fail.
   */
  const expectSearched = (plan: string) => {
    expect(plan).toMatch(/SEARCH dope_logs USING (COVERING )?INDEX idx_dope_/);
    expect(plan).not.toMatch(/SCAN dope_logs/);
  };

  it('seeds over a thousand logs', async () => {
    expect(LOG_COUNT).toBeGreaterThanOrEqual(1000);
    expect(await dopeLogRepository.count()).toBe(LOG_COUNT);
    expect(await environmentRepository.count()).toBe(LOG_COUNT / SHOTS_PER_SESSION);
  });

  it('DOPE Logs loads the whole history, newest first', async () => {
    await useDOPEStore.getState().loadDopeLogs();
    const { dopeLogs } = useDOPEStore.getState();

    expect(dopeLogs).toHaveLength(LOG_COUNT);
    expect(isDescending(dopeLogs.map((log) => log.timestamp as string))).toBe(true);
  });

  it("loads one rifle's logs, and only that rifle's, newest first", async () => {
    const [rifleId] = seeded.rifleIds;
    await useDOPEStore.getState().loadDopeLogs(rifleId);
    const { dopeLogs } = useDOPEStore.getState();

    const expected = seeded.ammoIds
      .map((ammoId) => seeded.perPair.get(`${rifleId}:${ammoId}`) ?? 0)
      .reduce((a, b) => a + b, 0);
    expect(dopeLogs).toHaveLength(expected);
    expect(dopeLogs.every((log) => log.rifleId === rifleId)).toBe(true);
    expect(isDescending(dopeLogs.map((log) => log.timestamp as string))).toBe(true);
  });

  it('loads one rifle and load by distance, then newest first', async () => {
    const [rifleId] = seeded.rifleIds;
    const [, ammoId] = seeded.ammoIds;
    await useDOPEStore.getState().loadDopeLogs(rifleId, ammoId);
    const { dopeLogs } = useDOPEStore.getState();

    expect(dopeLogs).toHaveLength(seeded.perPair.get(`${rifleId}:${ammoId}`) as number);
    expect(dopeLogs.every((log) => log.rifleId === rifleId && log.ammoId === ammoId)).toBe(true);
    for (let i = 1; i < dopeLogs.length; i++) {
      const [a, b] = [dopeLogs[i - 1], dopeLogs[i]];
      expect(a.distance <= b.distance).toBe(true);
      if (a.distance === b.distance) expect(a.timestamp! >= b.timestamp!).toBe(true);
    }
  });

  it('finds when each rifle last fired, for the cold-bore suggestion', async () => {
    for (const rifleId of seeded.rifleIds) {
      expect(await dopeLogRepository.getLastFiredAt(rifleId)).toBe(seeded.lastFiredAt.get(rifleId));
    }
  });

  it("reads each log's snapshot by id, as useSnapshotsFor does", async () => {
    const [rifleId] = seeded.rifleIds;
    const logs = await dopeLogRepository.getByRifleId(rifleId);
    const ids = [...new Set(logs.map((log) => log.environmentId))];
    const snapshots = await Promise.all(ids.map((id) => environmentRepository.getById(id)));

    expect(snapshots.every((snapshot) => snapshot !== null)).toBe(true);
    expect(snapshots.map((snapshot) => snapshot!.id)).toEqual(ids);
  });

  describe('query plans', () => {
    it("filters a rifle's logs through an index", async () => {
      expectSearched(await planOf(() => dopeLogRepository.getByRifleId(seeded.rifleIds[0])));
    });

    it('filters a rifle and load through an index', async () => {
      expectSearched(
        await planOf(() =>
          dopeLogRepository.getByRifleAndAmmo(seeded.rifleIds[0], seeded.ammoIds[0])
        )
      );
    });

    it("finds a rifle's last shot through an index", async () => {
      expectSearched(await planOf(() => dopeLogRepository.getLastFiredAt(seeded.rifleIds[0])));
    });

    it('reads the whole history in timestamp order without sorting it', async () => {
      // The full list is read in the index's order; a temp B-tree here would
      // mean sorting every log on every visit to DOPE Logs.
      // Every row is read here by design, so the plan is a scan -- but one that
      // walks the timestamp index rather than the table.
      const plan = await planOf(() => dopeLogRepository.getAll());
      expect(plan).toMatch(/SCAN dope_logs USING (COVERING )?INDEX idx_dope_timestamp/);
      expect(plan).not.toMatch(/TEMP B-TREE/);
    });

    it('reads a snapshot by its primary key', async () => {
      const plan = await planOf(() => environmentRepository.getById(1));
      expect(plan).toMatch(/SEARCH environment_snapshots USING INTEGER PRIMARY KEY/);
    });
  });
});
