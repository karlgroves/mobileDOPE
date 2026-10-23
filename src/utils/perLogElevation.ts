import { logDistanceInYards } from './distanceUnits';
import { elevationTable } from './solverInputs';

/**
 * The solver's elevation for each of a set of logs, in the conditions each was
 * shot in.
 *
 * One trajectory per *snapshot*, not per log. A full solve per log is what made
 * the DOPE curve take 660 ms for 60 logs (#124), and several logs from the same
 * range session share a snapshot, so the tables are reused.
 *
 * Logs whose snapshot is missing get `undefined` -- their offset is unknowable,
 * not zero, and both callers drop them rather than counting them as agreeing
 * with the solver.
 *
 * ## Why this is not in `solverInputs`
 *
 * It was, and it broke `DOPECurve.test.tsx`. That suite swaps the real solver
 * for a fast stand-in by mocking `elevationTable`, and a helper living in the
 * same module is reached through `jest.requireActual`'s spread -- so it closed
 * over the *real* `elevationTable` and quietly ran real ballistics inside a
 * test that had asked for a stand-in. Importing `elevationTable` from here
 * means the mock applies, which is what the suite is entitled to expect.
 *
 * Shared by `compareLogsToSolver`'s callers (#64) and `adjustElevation` (#168);
 * two copies of this caching is how the third one comes to be wrong.
 */
export const perLogElevation = <
  T extends { distance: number; distanceUnit?: 'yards' | 'meters'; environmentId: number },
>(
  logs: T[],
  rifle: Parameters<typeof elevationTable>[0],
  ammo: Parameters<typeof elevationTable>[1],
  environmentById: Map<number, NonNullable<Parameters<typeof elevationTable>[2]>>,
  unit: 'MIL' | 'MOA'
): ((log: T, yards: number) => number | undefined) => {
  // Out to the furthest log shot in each snapshot, so no trajectory is longer
  // than it has to be.
  const furthest = new Map<number, number>();
  for (const log of logs) {
    if (!environmentById.has(log.environmentId)) continue;
    const yards = Math.round(logDistanceInYards(log));
    furthest.set(log.environmentId, Math.max(furthest.get(log.environmentId) ?? 0, yards));
  }

  const tables = new Map(
    [...furthest].map(([id, maxYards]) => [
      id,
      elevationTable(rifle, ammo, environmentById.get(id), maxYards, unit),
    ])
  );

  return (log, yards) => tables.get(log.environmentId)?.(yards);
};
