import { dopeLogRepository, environmentRepository } from '../../src/services/database';
import { useDOPEStore } from '../../src/store/useDOPEStore';
import { LOG_COUNT, seedLargeHistory } from '../helpers/largeHistory';
import { installTestDatabase, uninstallTestDatabase } from '../helpers/testDatabase';

import type { SeededHistory } from '../helpers/largeHistory';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../helpers/testDatabase').openDatabaseAsync(),
}));

/**
 * The queries the app runs stay fast with over a thousand logs (#68, "measure
 * database query performance with 1000+ logs").
 *
 * Real SQLite -- `node:sqlite` behind expo-sqlite's API, the production schema
 * and indexes, rows written through the real repositories -- and the calls the
 * screens actually make: the DOPE store's three loads (DOPE Logs, a rifle's
 * history, a rifle and load for the curve), `getLastFiredAt` for New DOPE
 * Log's cold-bore suggestion, the snapshot fetch `useSnapshotsFor` does for
 * every candidate log, and the full snapshot list the CSV export reads. The
 * DOPE store and repository are measured together, model construction
 * included, because that is the cost a screen waits for.
 *
 * Out of band, in `jest.performance.config.js`, for the reason written up there
 * and in `solverPerformance.test.ts`. The correctness half -- counts, ordering,
 * and the query plans that make this scale -- is in the default suite as
 * `__tests__/integration/dopeLogScale.test.ts`, where it cannot flake.
 *
 * Like its neighbours this is a **regression tripwire**, not a benchmark. An
 * in-memory database on a development machine is far faster than a phone's
 * flash, so the absolute figures say little about a device. The budget is
 * what a screen can spend before a tap feels slow (100 ms); the medians
 * measured when this was written were 0.1-2.6 ms, the full list the slowest.
 * It trips on the changes that cost real time at this size: an N+1 query per
 * log, a full solve inside the model mapping. A dropped index would not trip
 * it -- 1,200 rows scan in well under a millisecond in memory -- which is why
 * the query plans are asserted in the correctness suite instead.
 *
 * MEDIAN of several runs, after a warm-up, as in `solverPerformance.test.ts`.
 */

const BUDGET_MS = 100;
const RUNS = 7;

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/** Median wall-clock time of `work`, warmed once so first-touch costs are excluded. */
const timed = async (work: () => Promise<unknown>): Promise<number> => {
  await work();
  const samples: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const started = performance.now();
    await work();
    samples.push(performance.now() - started);
  }
  return median(samples);
};

describe(`DOPE history query performance, ${LOG_COUNT} logs (#68)`, () => {
  let seeded: SeededHistory;

  beforeAll(async () => {
    await installTestDatabase();
    seeded = await seedLargeHistory();
  });

  afterAll(async () => {
    await uninstallTestDatabase();
  });

  it(`DOPE Logs loads the whole history in under ${BUDGET_MS} ms`, async () => {
    const ms = await timed(() => useDOPEStore.getState().loadDopeLogs());

    expect(useDOPEStore.getState().dopeLogs).toHaveLength(LOG_COUNT);
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it(`loads one rifle's history in under ${BUDGET_MS} ms`, async () => {
    const ms = await timed(() => useDOPEStore.getState().loadDopeLogs(seeded.rifleIds[0]));

    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it(`loads one rifle and load in under ${BUDGET_MS} ms`, async () => {
    const ms = await timed(() =>
      useDOPEStore.getState().loadDopeLogs(seeded.rifleIds[0], seeded.ammoIds[0])
    );

    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it(`finds when a rifle last fired in under ${BUDGET_MS} ms`, async () => {
    const ms = await timed(() => dopeLogRepository.getLastFiredAt(seeded.rifleIds[0]));

    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it(`fetches every candidate log's snapshot in under ${BUDGET_MS} ms`, async () => {
    // What `useSnapshotsFor` does for the results screen and the DOPE curve:
    // one `getById` per distinct snapshot among the rifle and load's logs.
    const logs = await dopeLogRepository.getByRifleAndAmmo(seeded.rifleIds[0], seeded.ammoIds[0]);
    const ids = [...new Set(logs.map((log) => log.environmentId))];

    const ms = await timed(() => Promise.all(ids.map((id) => environmentRepository.getById(id))));

    expect(ids.length).toBeGreaterThan(10);
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it(`reads every snapshot for the CSV export in under ${BUDGET_MS} ms`, async () => {
    const ms = await timed(() => environmentRepository.getAll());

    expect(ms).toBeLessThan(BUDGET_MS);
  });
});
