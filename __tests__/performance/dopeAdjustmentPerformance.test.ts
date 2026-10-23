import { adjustElevation } from '../../src/utils/dopeAdjustment';
import { rankMatches } from '../../src/utils/dopeMatching';

import type { DOPELogData } from '../../src/models/DOPELog';

/**
 * The offset for a large history is computed fast enough to be on the render
 * path (#168: "offset for 1,000 logs in under 100 ms").
 *
 * Out of band, in `jest.performance.config.js`, for the reason written up in
 * that file and in `solverPerformance.test.ts`: elapsed time is a property of
 * the code *and* of whatever else the machine is doing, and inside a parallel
 * run the second term is noise the assertion cannot see.
 *
 * Like its neighbour this is a **regression tripwire**, not a benchmark. #168
 * sets 100 ms; the measured figure on this machine is well under 10 ms, so the
 * threshold is left where the issue put it and still has an order of magnitude
 * of headroom. It trips if someone puts a full trajectory solve inside the
 * per-log loop — which is exactly the mistake #124 found on the DOPE curve, at
 * 660 ms for 60 logs.
 *
 * The solver is a stand-in. What is being measured is the ranking and the
 * offset arithmetic, not the ballistics; the real solver has its own budget in
 * `solverPerformance.test.ts`, and calling it here would measure that instead.
 */

const BUDGET_MS = 100;
const LOG_COUNT = 1000;

/** A thousand logs spread over distances, conditions and dates, as a real history is. */
const history = (): (DOPELogData & {
  environment: { temperature: number; pressure: number; altitude: number };
})[] =>
  Array.from({ length: LOG_COUNT }, (_, i) => ({
    id: i + 1,
    rifleId: 1,
    ammoId: 1,
    environmentId: i + 1,
    // 100-1000 yards, so a good share fall inside any one query window.
    distance: 100 + (i % 37) * 25,
    distanceUnit: (i % 5 === 0 ? 'meters' : 'yards') as 'meters' | 'yards',
    elevationCorrection: 1 + (i % 37) * 0.2,
    windageCorrection: 0.1,
    correctionUnit: (i % 7 === 0 ? 'MOA' : 'MIL') as 'MOA' | 'MIL',
    targetType: 'steel' as const,
    groupSize: 0.5 + (i % 4) * 0.3,
    timestamp: new Date(Date.UTC(2026, 0, 1) - i * 3_600_000).toISOString(),
    environment: {
      temperature: 40 + (i % 50),
      pressure: 28 + (i % 3),
      altitude: (i % 20) * 250,
    },
  }));

const elapsed = (work: () => void): number => {
  const started = performance.now();
  work();
  return performance.now() - started;
};

describe('DOPE adjustment performance (#168)', () => {
  const logs = history();
  const context = {
    rifleId: 1,
    ammoId: 1,
    distance: 600,
    environment: { temperature: 59, pressure: 29.92, altitude: 0 },
    timestamp: new Date(Date.UTC(2026, 0, 1)).toISOString(),
  };

  it(`ranks and adjusts ${LOG_COUNT} logs in under ${BUDGET_MS} ms`, () => {
    // Warm once, then measure: the first call pays for JIT and for the
    // module's first-touch costs, neither of which repeats on the render path.
    rankMatches(logs, context);

    const ms = elapsed(() => {
      const matches = rankMatches(logs, context);
      adjustElevation(matches, (log) => log.elevationCorrection - 0.3, 4.2, 'MIL');
    });

    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('does not call the solver once per log in the history', () => {
    // The cost that matters is not the arithmetic, it is how many predictions
    // are asked for. `rankMatches` keeps at most its limit, so the prediction
    // count must be bounded by that and not by the size of the history --
    // 1,000 real solves is the #124 defect.
    let predictions = 0;
    const matches = rankMatches(logs, context);

    adjustElevation(
      matches,
      (log) => {
        predictions++;
        return log.elevationCorrection - 0.3;
      },
      4.2,
      'MIL'
    );

    expect(predictions).toBeLessThanOrEqual(matches.length);
    expect(predictions).toBeLessThan(20);
  });
});
