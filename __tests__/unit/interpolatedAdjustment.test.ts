import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  INTERPOLATION_SIGMA_YARDS,
  LOW_CONFIDENCE_REASON,
  PROXIMITY_SIGMA_YARDS,
} from '../../src/utils/adjustmentConfidence';
import { adjustByInterpolation } from '../../src/utils/interpolatedAdjustment';
import { COVERAGE_TOLERANCE_YARDS, EXTRAPOLATED_REASON } from '../../src/utils/offsetInterpolation';

import type { DOPELogData } from '../../src/models/DOPELog';

/**
 * The offset at a distance with no log near it, applied to today's solution (#162).
 *
 * `interpolateOffset` was written and tested in PR #182 and then called by
 * nothing, so no shooter ever saw an interpolated recommendation. What is
 * asserted here is the step that was missing: turning the logs into an offset
 * curve, reading today's distance off it, and deciding -- through #161's
 * confidence, not a second notion of trust -- how much of it to apply.
 *
 * The solver is a stand-in that predicts a fixed figure, so every offset below
 * is simply "what was dialled minus that figure" and can be read off the seed.
 */

const SOLVER = 3.0;

/** Predicts {@link SOLVER} MIL for every log, so offset = dialled − 3.0. */
const predict = () => SOLVER;

/** A well-evidenced log, so the quality factor does not muddy the assertions. */
const log = (
  distance: number,
  elevation: number,
  over: Partial<DOPELogData> = {}
): DOPELogData => ({
  rifleId: 1,
  ammoId: 1,
  environmentId: 1,
  distance,
  distanceUnit: 'yards',
  elevationCorrection: elevation,
  windageCorrection: 0,
  correctionUnit: 'MIL',
  targetType: 'steel',
  shotCount: 5,
  hitCount: 5,
  groupSize: 2,
  ...over,
});

/** `n` agreeing logs at one distance, each `offset` above the solver. */
const logsAt = (distance: number, offset: number, n = 3): DOPELogData[] =>
  Array.from({ length: n }, (_, i) => log(distance, SOLVER + offset, { id: distance * 10 + i }));

describe('adjustByInterpolation (#162)', () => {
  it('returns undefined with no usable logs, so the caller falls back to the solver', () => {
    expect(adjustByInterpolation([], predict, 500, SOLVER, 'MIL')).toBeUndefined();
    // A log the solver cannot predict says nothing, rather than "the solver is right".
    expect(
      adjustByInterpolation(logsAt(500, 0.3), () => undefined, 500, SOLVER, 'MIL')
    ).toBeUndefined();
  });

  describe('between two logged distances', () => {
    const logs = [...logsAt(450, 0.2), ...logsAt(550, 0.4)];

    it('interpolates the offset, not the elevation, and says between which logs', () => {
      const result = adjustByInterpolation(logs, predict, 500, SOLVER, 'MIL')!;

      expect(result.interpolation.source).toBe('interpolated');
      expect(result.interpolation.offset).toBeCloseTo(0.3, 6);
      expect(result.interpolation.from).toEqual([450, 550]);
      expect(result.caption).toBe('Interpolated between your 450 and 550 yd logs');
    });

    it('applies the interpolated offset scaled by its confidence', () => {
      const result = adjustByInterpolation(logs, predict, 500, SOLVER, 'MIL')!;

      expect(result.solverOnly).toBe(false);
      expect(result.confidence.score).toBeGreaterThanOrEqual(DEFAULT_CONFIDENCE_THRESHOLD);
      expect(result.offset).toBeCloseTo(0.3 * result.confidence.score, 6);
      expect(result.adjustedElevation).toBeCloseTo(SOLVER + result.offset, 6);
      expect(result.solverElevation).toBe(SOLVER);
    });

    it('counts only the logs at the two distances it drew on', () => {
      const result = adjustByInterpolation(
        [...logs, ...logsAt(900, 1.5)],
        predict,
        500,
        SOLVER,
        'MIL'
      )!;

      expect(result.confidence.contributingLogs).toBe(6);
    });

    it('is less confident the further today is from a logged distance', () => {
      // Same bracket width, today's distance moved from beside a log to the middle.
      const wide = [...logsAt(400, 0.2), ...logsAt(600, 0.4)];
      const near = adjustByInterpolation(wide, predict, 410, SOLVER, 'MIL')!;
      const middle = adjustByInterpolation(wide, predict, 500, SOLVER, 'MIL')!;

      expect(near.confidence.nearestLogYards).toBe(10);
      expect(middle.confidence.nearestLogYards).toBe(100);
      expect(middle.confidence.score).toBeLessThan(near.confidence.score);
    });

    it('withholds the offset across a gap wider than is worth interpolating', () => {
      // A gap is "worth practising" past COVERAGE_TOLERANCE_YARDS (DopeCoverage).
      // In the middle of one twice that wide, the app must not dial a guess.
      const gap = COVERAGE_TOLERANCE_YARDS * 2;
      const result = adjustByInterpolation(
        [...logsAt(300, 0.2), ...logsAt(300 + gap, 0.4)],
        predict,
        300 + gap / 2,
        SOLVER,
        'MIL'
      )!;

      expect(result.solverOnly).toBe(true);
      expect(result.reason).toBe(LOW_CONFIDENCE_REASON);
      expect(result.offset).toBe(0);
      expect(result.adjustedElevation).toBe(SOLVER);
    });

    it('is less confident when the logs at a distance disagree with each other', () => {
      const agreeing = adjustByInterpolation(logs, predict, 500, SOLVER, 'MIL')!;
      const disagreeing = adjustByInterpolation(
        [
          log(450, SOLVER - 0.4, { id: 1 }),
          log(450, SOLVER + 0.8, { id: 2 }),
          log(450, SOLVER + 0.2, { id: 3 }),
          ...logsAt(550, 0.4),
        ],
        predict,
        500,
        SOLVER,
        'MIL'
      )!;

      expect(disagreeing.confidence.factors.agreement).toBeLessThan(
        agreeing.confidence.factors.agreement
      );
      expect(disagreeing.confidence.score).toBeLessThan(agreeing.confidence.score);
    });
  });

  describe('past both ends of the logged range', () => {
    const logs = [...logsAt(400, 0.2), ...logsAt(600, 0.4)];

    it('holds the nearest end and says it extrapolated', () => {
      const short = adjustByInterpolation(logs, predict, 380, SOLVER, 'MIL')!;
      const long = adjustByInterpolation(logs, predict, 620, SOLVER, 'MIL')!;

      expect(short.interpolation.source).toBe('extrapolated');
      expect(short.interpolation.offset).toBeCloseTo(0.2, 6);
      expect(long.interpolation.source).toBe('extrapolated');
      expect(long.interpolation.offset).toBeCloseTo(0.4, 6);
      expect(long.extrapolated).toBe(true);
      expect(long.caption).toBe(`${EXTRAPOLATED_REASON}: nearest is 600 yd, 20 yd away`);
    });

    it('trusts an extrapolation less than an interpolation the same distance from a log', () => {
      // 30 yd past the end, against 30 yd inside a bracket: the bracket has a
      // second measurement to lean toward, the end does not.
      const outside = adjustByInterpolation(logs, predict, 630, SOLVER, 'MIL')!;
      const inside = adjustByInterpolation(logs, predict, 570, SOLVER, 'MIL')!;

      expect(outside.confidence.nearestLogYards).toBe(30);
      expect(inside.confidence.nearestLogYards).toBe(30);
      expect(outside.confidence.score).toBeLessThan(inside.confidence.score);
    });

    it('falls back to the solver well past the last log', () => {
      const result = adjustByInterpolation(logs, predict, 800, SOLVER, 'MIL')!;

      expect(result.solverOnly).toBe(true);
      expect(result.adjustedElevation).toBe(SOLVER);
    });
  });

  describe('with a single logged distance', () => {
    it('extrapolates from it either side', () => {
      const logs = logsAt(500, 0.3);
      const short = adjustByInterpolation(logs, predict, 490, SOLVER, 'MIL')!;
      const long = adjustByInterpolation(logs, predict, 510, SOLVER, 'MIL')!;

      expect(short.interpolation.source).toBe('extrapolated');
      expect(long.interpolation.source).toBe('extrapolated');
      expect(short.interpolation.offset).toBeCloseTo(0.3, 6);
      expect(long.interpolation.offset).toBeCloseTo(0.3, 6);
    });
  });

  it('works in the shooter’s unit, converting logs recorded in the other one', () => {
    // 0.3 MIL is 1.03 MOA. A MOA log must not be read as a MIL figure (#125).
    const logs = [
      ...logsAt(450, 0.3),
      ...Array.from({ length: 3 }, (_, i) =>
        log(550, (SOLVER + 0.3) * 3.43774677, { id: 900 + i, correctionUnit: 'MOA' })
      ),
    ];
    const result = adjustByInterpolation(logs, predict, 500, SOLVER, 'MIL')!;

    expect(result.interpolation.offset).toBeCloseTo(0.3, 2);
  });
});

describe('what it asks the solver (#162, #124)', () => {
  it('predicts only the logs at the two distances either side, not the whole history', () => {
    // A long history at every 25 yards. Interpolating at 510 needs 500 and 525.
    const history = Array.from({ length: 37 }, (_, i) => logsAt(100 + i * 25, 0.2, 5)).flat();
    const asked = new Set<number>();

    adjustByInterpolation(
      history,
      (_log, yards) => {
        asked.add(yards);
        return predict();
      },
      510,
      SOLVER,
      'MIL'
    );

    expect([...asked].sort((a, b) => a - b)).toEqual([500, 525]);
  });

  it('predicts each log at its own distance, not the yard it is grouped under', () => {
    // 400 m is 437.445 yd. The matched adjustment predicts it there; so must this.
    const metric = Array.from({ length: 3 }, (_, i) =>
      log(400, SOLVER + 0.2, { id: 700 + i, distanceUnit: 'meters' })
    );
    const asked: number[] = [];

    adjustByInterpolation(
      [...metric, ...logsAt(600, 0.2)],
      (_log, yards) => {
        asked.push(yards);
        return predict();
      },
      500,
      SOLVER,
      'MIL'
    );

    expect(asked.some((yards) => Math.abs(yards - 400 / 0.9144) < 1e-9)).toBe(true);
    expect(asked).not.toContain(437);
  });

  it('steps over a distance the solver cannot predict to the next one out', () => {
    const logs = [...logsAt(400, 0.2), ...logsAt(450, 9.9), ...logsAt(600, 0.4)];
    const result = adjustByInterpolation(
      logs,
      (_log, yards) => (yards === 450 ? undefined : predict()),
      500,
      SOLVER,
      'MIL'
    )!;

    expect(result.interpolation.from).toEqual([400, 600]);
    expect(result.interpolation.offset).toBeCloseTo(0.3, 6);
  });
});

describe('the proximity widths (#162)', () => {
  it('lets an interpolation reach further than a match, but not across a practice gap', () => {
    expect(INTERPOLATION_SIGMA_YARDS).toBeGreaterThan(PROXIMITY_SIGMA_YARDS);
    expect(INTERPOLATION_SIGMA_YARDS).toBeLessThanOrEqual(COVERAGE_TOLERANCE_YARDS / 2);
  });
});
