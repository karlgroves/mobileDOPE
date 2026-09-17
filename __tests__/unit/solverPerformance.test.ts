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

  it('scales with distance rather than exploding', () => {
    // The shape matters more than any single figure. Integration to 2000 yards
    // is more work than to 500, but it must not be dramatically superlinear --
    // that is the signature of an accidental O(n^2) in the step loop.
    const near = medianMs(() => calculateTrajectory(rifle, ammo, shot(500), atmosphere));
    const far = medianMs(() => calculateTrajectory(rifle, ammo, shot(2000), atmosphere));

    // 4x the distance must not cost more than 4.5x the time.
    //
    // Every number here was measured against a deliberately quadratic solver,
    // not reasoned about. Five repeats of each, warmed:
    //
    //   baseline   2.47  2.51  2.48  2.52  2.50
    //   quadratic  7.51  7.52  7.26  7.56  7.52
    //
    // 4.5 sits between them with 1.8x headroom over the baseline. The ratio is
    // far more stable than any absolute timing, because both halves take the
    // same machine load and it divides out.
    //
    // Two earlier attempts at this line were wrong, which is why the numbers are
    // written down. 40x was the original, with a comment claiming it caught
    // quadratic -- it cannot, since 16 < 40. Then 8x, from arithmetic: baseline
    // 2.5, quadratic "would be" 16. Also wrong. A real quadratic term mixes with
    // the linear work that is still there, so the observed ratio is ~7.5, not
    // 16, and 8x would have missed it by a hair. Only running it showed that.
    expect(far).toBeLessThan(Math.max(near, 0.5) * 4.5);
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
