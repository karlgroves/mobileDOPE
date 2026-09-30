import { calculateBallisticSolution, calculateTrajectory } from '../../src/utils/ballistics';

import type { AmmoConfig, RifleConfig, ShotParameters } from '../../src/types/ballistic.types';
import type { AtmosphericConditions } from '../../src/utils/atmospheric';

/**
 * The solver is fast enough to feel instant (#68, "performance test for
 * real-time calculation speed").
 *
 * ## What this is, and what it deliberately is not
 *
 * It is a **regression tripwire**, not a benchmark. The thresholds are an order
 * of magnitude above what the solver actually takes, so this fails when someone
 * turns the RK4 step count up by 100x or drops an O(n^2) lookup into the drag
 * model -- the changes that make a field app stop feeling instant -- and not
 * when the CI box is busy.
 *
 * A tight threshold here would be worse than no test: it would fail on a loaded
 * machine, get marked flaky, and then not fail when it mattered. Wall-clock
 * assertions earn their place only by being loose enough to mean something when
 * they trip.
 *
 * ## Why this file is not in `npm test`
 *
 * That warning turned out to be about this file. It lived in the default suite
 * and flaked: roughly one failure in ten full-suite runs, while ten instrumented
 * runs put the scaling ratio between 2.235 and 2.657 against a threshold of 4.5.
 * It never came close on any run that was looked at, and failed anyway -- a rare
 * scheduling stall on one half of one measurement, not a threshold set too
 * tight.
 *
 * Loosening the number would not have been principled. A threshold high enough
 * to swallow that tail is high enough to miss the quadratic regression this test
 * exists for, which shows up at about 7.5. The problem is not the number; it is
 * that elapsed time is a property of the code AND of whatever else the machine is
 * doing, and inside a 71-suite parallel run that second term is noise the test
 * cannot see.
 *
 * So it runs alone and in band:
 *
 *     npm run test:perf
 *
 * `jest.performance.config.js` holds the config, `docs/RELEASE.md` step 4 puts it
 * in the release sequence, and `__tests__/unit/performanceSuiteWired.test.ts`
 * fails the normal suite if any of those goes missing. A suite nobody runs is a
 * suite that rots; this one is now run on purpose.
 *
 * Reported as a MEDIAN of several runs. A mean is dragged around by one
 * unlucky sample and a single run is almost pure noise, so both would make the
 * threshold a lottery rather than a statement about the code.
 */
describe('solver performance', () => {
  const rifle: RifleConfig = {
    zeroDistance: 100,
    sightHeight: 1.5,
    twistRate: '1:10',
    barrelLength: 24,
    caliber: '.308 Win',
  };

  const ammo: AmmoConfig = {
    bulletWeight: 168,
    ballisticCoefficient: 0.462,
    dragModel: 'G1',
    muzzleVelocity: 2650,
  };

  const atmosphere: AtmosphericConditions = {
    temperature: 59,
    pressure: 29.92,
    humidity: 50,
    altitude: 0,
    densityAltitude: 0,
  };

  const shot = (distance: number): ShotParameters => ({
    distance,
    angle: 0,
    windSpeed: 10,
    windDirection: 90,
  });

  /**
   * Median wall-clock milliseconds over `runs` executions, after warm-up.
   *
   * The warm-up is not politeness -- it is what makes the ratio test below able
   * to see anything. Without it the first workload measured absorbs JIT
   * compilation and reads slower than it is, which inflates the denominator and
   * flattens the ratio. Measured: a deliberately quadratic solver showed a ratio
   * of 4.39 cold and 7.5 warmed, against a baseline of 2.5 either way.
   */
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

  it('solves a 1000 yard shot well inside a frame budget', () => {
    // 250 ms is roughly 15x a 16 ms frame. The solver is far quicker than this;
    // the number exists to catch an order-of-magnitude regression.
    const elapsed = medianMs(() => calculateBallisticSolution(rifle, ammo, shot(1000), atmosphere));

    expect(elapsed).toBeLessThan(250);
  });

  it('stays responsive at the far edge of its range', () => {
    const elapsed = medianMs(() => calculateBallisticSolution(rifle, ammo, shot(2000), atmosphere));

    expect(elapsed).toBeLessThan(500);
  });

  /**
   * The median of PAIRED near/far ratios, rather than a ratio of two medians.
   *
   * This distinction is the difference between a test and a flake. Timing 500
   * yards nine times and then 2000 yards nine times measures them in two
   * different windows, and under a full parallel run those windows have
   * different neighbours competing for the machine. Dividing the results
   * carries that difference into the ratio.
   *
   * Measuring near and far back to back, and taking the median of the
   * per-pair ratios, keeps both halves inside the same window. Whatever the
   * machine was doing, it was doing it to both.
   *
   * Learned the hard way: the 4.5 threshold below passed in isolation and
   * failed inside the full suite, which is exactly the failure mode this file's
   * own header warns about.
   */
  const medianRatio = (near: () => unknown, far: () => unknown, pairs = 9): number => {
    for (let i = 0; i < 3; i++) {
      near();
      far();
    }

    const ratios: number[] = [];
    for (let i = 0; i < pairs; i++) {
      const nearStart = performance.now();
      near();
      const nearMs = performance.now() - nearStart;

      const farStart = performance.now();
      far();
      const farMs = performance.now() - farStart;

      ratios.push(farMs / Math.max(nearMs, 0.001));
    }
    ratios.sort((a, b) => a - b);
    return ratios[Math.floor(ratios.length / 2)];
  };

  it('scales with distance rather than exploding', () => {
    // The shape matters more than any single figure. Integration to 2000 yards
    // is more work than to 500, but it must not be dramatically superlinear --
    // that is the signature of an accidental O(n^2) in the step loop.
    const ratio = medianRatio(
      () => calculateTrajectory(rifle, ammo, shot(500), atmosphere),
      () => calculateTrajectory(rifle, ammo, shot(2000), atmosphere)
    );

    // 4x the distance must not cost more than 4.5x the time.
    //
    // Every number here was measured against a deliberately quadratic solver,
    // not reasoned about. Five repeats of each, warmed:
    //
    //   baseline   2.47  2.51  2.48  2.52  2.50
    //   quadratic  7.51  7.52  7.26  7.56  7.52
    //
    // 4.5 sits between them with 1.8x headroom over the baseline.
    //
    // Three earlier attempts at this line were wrong, which is why the numbers
    // are written down. 40x was the original, with a comment claiming it caught
    // quadratic -- it cannot, since 16 < 40. Then 8x, from arithmetic: baseline
    // 2.5, quadratic "would be" 16. Also wrong, because a real quadratic term
    // mixes with the linear work still present, so the observed ratio is ~7.5.
    // Then 4.5 computed from two separately-medianed timings, which was right
    // about the number and wrong about how to measure it -- see medianRatio.
    expect(ratio).toBeLessThan(4.5);
  });

  it('builds a full DOPE card in one go without stalling', () => {
    // What the card generator actually does: a solve per distance band. This is
    // the heaviest thing the app asks of the solver in one user action.
    const distances = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

    const elapsed = medianMs(
      () => distances.map((d) => calculateBallisticSolution(rifle, ammo, shot(d), atmosphere)),
      5
    );

    expect(elapsed).toBeLessThan(2000);
  });

  it('actually did the work it timed', () => {
    // Guards the guard. If the solver ever returned early, every threshold above
    // would pass gloriously and mean nothing.
    const result = calculateBallisticSolution(rifle, ammo, shot(1000), atmosphere);

    expect(Number.isFinite(result.drop)).toBe(true);
    expect(result.drop).not.toBe(0);
    expect(calculateTrajectory(rifle, ammo, shot(1000), atmosphere).length).toBeGreaterThan(1);
  });
});
