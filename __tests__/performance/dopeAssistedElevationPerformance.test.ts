import { adjustElevationWithDope } from '../../src/utils/dopeAssistedElevation';
import { rankMatches } from '../../src/utils/dopeMatching';

import type { DOPELogData } from '../../src/models/DOPELog';
import type { Match } from '../../src/utils/dopeMatching';

/**
 * The DOPE-assisted offset for 1,000 logs, under 100 ms (#168).
 *
 * This runs on the render path of `BallisticSolutionResults`: a shooter arrives
 * at a solution and the adjustment has to already be there. A thousand logs is a
 * few seasons of serious shooting, so it is the size worth defending.
 *
 * ## In this suite, not `npm test`
 *
 * Same reason as `solverPerformance.test.ts`: a wall-clock assertion inside a
 * 70-suite parallel run measures the machine as much as the code. This suite
 * runs alone and in band via `npm run test:perf`.
 *
 * ## What is and is not timed
 *
 * `predict` is a stub returning a number, because the function under test does
 * not solve -- it takes the prediction as an argument, and the real caller shares
 * one `elevationTable` per environment for exactly that reason. Timing a real
 * solve here would measure `ballistics.ts`, which `solverPerformance.test.ts`
 * already covers, and would hide a regression in this module behind it.
 *
 * The threshold is the issue's 100 ms, which is loose against what the function
 * actually takes (sub-millisecond for 1,000 matches). That is deliberate: it
 * trips on a quadratic scan or a solve-per-log creeping into the loop, not on a
 * busy machine. The scaling check below is the sharper instrument.
 */
describe('DOPE-assisted elevation performance', () => {
  const medianMs = (work: () => unknown, runs = 9): number => {
    for (let i = 0; i < 3; i++) work();

    const samples: number[] = [];
    for (let i = 0; i < runs; i++) {
      const started = performance.now();
      work();
      samples.push(performance.now() - started);
    }
    samples.sort((a, b) => a - b);
    return samples[Math.floor(samples.length / 2)];
  };

  /** `count` logs spread across the distances and conditions a season produces. */
  const logs = (count: number): DOPELogData[] =>
    Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      rifleId: 1,
      ammoId: 1,
      environmentId: (i % 40) + 1,
      distance: 100 + (i % 20) * 50,
      distanceUnit: i % 3 === 0 ? ('meters' as const) : ('yards' as const),
      elevationCorrection: i % 4 === 0 ? 10.3 + (i % 7) * 0.1 : 3.0 + (i % 7) * 0.03,
      windageCorrection: 0.2,
      correctionUnit: i % 4 === 0 ? ('MOA' as const) : ('MIL' as const),
      targetType: 'steel' as const,
      groupSize: 1.2,
      hitCount: 4,
      shotCount: 5,
      timestamp: new Date(Date.UTC(2026, 0, 1 + (i % 300))).toISOString(),
      environment: {
        temperature: 40 + (i % 50),
        pressure: 27 + (i % 3),
        altitude: (i % 10) * 500,
      },
    }));

  /** A match per log, so the whole set reaches the function under test. */
  const matchesFor = (count: number): Match<DOPELogData>[] =>
    logs(count).map((log, i) => ({
      log,
      score: 0.2 + ((i % 8) / 8) * 0.8,
      factors: { distance: 0.9, environment: 0.8, recency: 0.7, quality: 0.6 },
    }));

  /** Cheap, and deliberately so -- see the file comment. */
  const predict = (_log: DOPELogData, yards: number): number => yards / 180;

  const offsetFor = (matches: Match<DOPELogData>[]) => () =>
    adjustElevationWithDope({ matches, predict, solverElevation: 3.4, unit: 'MIL' });

  it('combines 1,000 logs into an offset in under 100 ms', () => {
    const matches = matchesFor(1000);

    expect(medianMs(offsetFor(matches))).toBeLessThan(100);
  });

  it('is still under 100 ms when the matcher has to rank the 1,000 first', () => {
    // What the screen actually does: rank, then adjust. The matcher's own
    // filtering means it normally hands over a handful, so this measures the
    // realistic worst case -- a thousand candidates every one of which is near
    // the shot.
    const all = logs(1000).map((log) => ({
      ...log,
      distance: 500,
      distanceUnit: 'yards' as const,
    }));

    const elapsed = medianMs(() =>
      adjustElevationWithDope({
        matches: rankMatches(all, {
          rifleId: 1,
          ammoId: 1,
          distance: 500,
          timestamp: '2026-10-20T00:00:00.000Z',
        }),
        predict,
        solverElevation: 3.4,
        unit: 'MIL',
      })
    );

    expect(elapsed).toBeLessThan(100);
  });

  it('scales linearly in the number of matches', () => {
    // The sharper instrument. Ten times the logs should cost about ten times as
    // much; a quadratic scan over the matches would cost a hundred. Paired
    // samples, for the reason solverPerformance.test.ts sets out: timing the two
    // sizes in separate windows carries the machine's mood into the ratio.
    const small = offsetFor(matchesFor(100));
    const large = offsetFor(matchesFor(1000));

    for (let i = 0; i < 3; i++) {
      small();
      large();
    }

    const ratios: number[] = [];
    for (let i = 0; i < 9; i++) {
      const startedSmall = performance.now();
      small();
      const smallMs = performance.now() - startedSmall;

      const startedLarge = performance.now();
      large();
      const largeMs = performance.now() - startedLarge;

      // Guards against a zero denominator on a fast clock.
      ratios.push(largeMs / Math.max(smallMs, 0.0005));
    }
    ratios.sort((a, b) => a - b);

    // Linear is 10. Quadratic is 100. 30 leaves generous room for the fixed
    // per-call cost dominating at 100 matches while still failing a quadratic.
    expect(ratios[Math.floor(ratios.length / 2)]).toBeLessThan(30);
  });

  it('actually did the work it timed', () => {
    // Guards the guard: an early return would make every threshold above pass
    // and mean nothing.
    const result = adjustElevationWithDope({
      matches: matchesFor(1000),
      predict,
      solverElevation: 3.4,
      unit: 'MIL',
    });

    expect(result.contributions).toHaveLength(1000);
    expect(Number.isFinite(result.offset)).toBe(true);
    expect(result.offset).not.toBe(0);
  });
});
