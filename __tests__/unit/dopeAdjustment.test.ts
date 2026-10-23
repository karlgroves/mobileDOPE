import {
  adjustElevation,
  SINGLE_LOG_SOFTENING,
  SOLVER_ONLY_REASON,
} from '../../src/utils/dopeAdjustment';
import { rankMatches } from '../../src/utils/dopeMatching';

import type { DOPELogData } from '../../src/models/DOPELog';
import type { Match } from '../../src/utils/dopeMatching';

/**
 * Adjusting the solver's elevation by the shooter's own DOPE (#168).
 *
 * Every assertion here is about one of three things: that the offset is the
 * weighted mean of what the logs actually say, that thin evidence moves the
 * answer less than thick evidence does, and that mixed units do not corrupt
 * either. The last is the one with teeth — #125 found the trap, and a wrong
 * answer here looks exactly like a right one.
 */

const log = (over: Partial<DOPELogData> = {}): DOPELogData => ({
  rifleId: 1,
  ammoId: 1,
  environmentId: 1,
  distance: 600,
  distanceUnit: 'yards',
  elevationCorrection: 4.0,
  windageCorrection: 0,
  correctionUnit: 'MIL',
  targetType: 'steel',
  ...over,
});

/** A match at a chosen weight, bypassing the scorer so weighting is isolated. */
const match = (score: number, over: Partial<DOPELogData> = {}): Match<DOPELogData> => ({
  log: log(over),
  score,
  factors: { distance: score, environment: score, recency: score, quality: score },
});

/** A solver that always predicts `mil` MIL, whatever it is asked. */
const predicts = (mil: number) => () => mil;

describe('adjustElevation (#168)', () => {
  describe('with no matches', () => {
    it('returns the solver solution unchanged, and says why', () => {
      const result = adjustElevation([], predicts(4), 4.0, 'MIL');

      expect(result.adjustedElevation).toBe(4.0);
      expect(result.offset).toBe(0);
      expect(result.reason).toBe(SOLVER_ONLY_REASON);
      expect(result.contributions).toEqual([]);
    });
  });

  describe('with agreeing logs', () => {
    it('offsets by what they agree on, damped for the amount of evidence', () => {
      // Six logs, each dialled 0.4 MIL more than the solver predicted for them.
      // The raw weighted mean offset is therefore exactly 0.4.
      const matches = Array.from({ length: 6 }, (_, i) =>
        match(1, { id: i + 1, elevationCorrection: 4.4 })
      );

      const result = adjustElevation(matches, predicts(4.0), 4.0, 'MIL');

      expect(result.rawOffset).toBeCloseTo(0.4, 10);
      // trust = 6 / (6 + 1) -- see SINGLE_LOG_SOFTENING.
      expect(result.trust).toBeCloseTo(6 / 7, 10);
      expect(result.offset).toBeCloseTo(0.4 * (6 / 7), 10);
      expect(result.adjustedElevation).toBeCloseTo(4.0 + 0.4 * (6 / 7), 10);
    });

    it('reports every contributing log with its weight and its own offset', () => {
      const matches = [
        match(1, { id: 1, elevationCorrection: 4.4 }),
        match(0.5, { id: 2, elevationCorrection: 4.2 }),
      ];

      const result = adjustElevation(matches, predicts(4.0), 4.0, 'MIL');

      expect(result.contributions).toEqual([
        { log: matches[0].log, weight: 1, offset: expect.closeTo(0.4, 10) },
        { log: matches[1].log, weight: 0.5, offset: expect.closeTo(0.2, 10) },
      ]);
    });

    it('weights by relevance, so a closer match pulls harder', () => {
      // 1.0 at +0.6 and 0.2 at -0.6: the weighted mean leans to the heavy one.
      const matches = [
        match(1, { id: 1, elevationCorrection: 4.6 }),
        match(0.2, { id: 2, elevationCorrection: 3.4 }),
      ];

      const result = adjustElevation(matches, predicts(4.0), 4.0, 'MIL');

      expect(result.rawOffset).toBeCloseTo((0.6 - 0.12) / 1.2, 10);
      expect(result.rawOffset).toBeGreaterThan(0);
    });
  });

  describe('thin evidence', () => {
    it('lets one log move the answer less than several agreeing logs would', () => {
      // #168: "its weight is limited so that one log can't move the answer as
      // far as several agreeing logs would". Same offset, different counts.
      const one = adjustElevation(
        [match(1, { id: 1, elevationCorrection: 4.5 })],
        predicts(4),
        4,
        'MIL'
      );
      const five = adjustElevation(
        Array.from({ length: 5 }, (_, i) => match(1, { id: i + 1, elevationCorrection: 4.5 })),
        predicts(4),
        4,
        'MIL'
      );

      expect(one.rawOffset).toBeCloseTo(five.rawOffset, 10);
      expect(Math.abs(one.offset)).toBeLessThan(Math.abs(five.offset));
      expect(one.trust).toBeCloseTo(1 / (1 + SINGLE_LOG_SOFTENING), 10);
    });

    it('still applies something, rather than discarding a single log', () => {
      const one = adjustElevation(
        [match(1, { id: 1, elevationCorrection: 4.5 })],
        predicts(4),
        4,
        'MIL'
      );

      expect(one.offset).toBeGreaterThan(0);
      expect(one.adjustedElevation).toBeGreaterThan(4);
    });

    it('never damps past the raw offset, however much evidence there is', () => {
      const many = adjustElevation(
        Array.from({ length: 200 }, (_, i) => match(1, { id: i + 1, elevationCorrection: 4.5 })),
        predicts(4),
        4,
        'MIL'
      );

      expect(many.trust).toBeLessThan(1);
      expect(Math.abs(many.offset)).toBeLessThan(Math.abs(many.rawOffset));
    });
  });

  describe('mixed units (#125)', () => {
    // 1 mil is 3.4377467707849396 MOA, per `unitConversions`. Spelled out
    // rather than rounded: a 13.75 here would leave a 0.001 MOA residue and
    // the test would be asserting the rounding, not the conversion.
    const FOUR_MIL_IN_MOA = 4 * 3.4377467707849396;

    it('converts a MOA log before differencing it against a MIL prediction', () => {
      // Against a 4.0 MIL prediction the offset is zero. Subtracting the raw
      // numbers would give -9.75, which is enormous and silently wrong.
      const matches = [
        match(1, { id: 1, elevationCorrection: FOUR_MIL_IN_MOA, correctionUnit: 'MOA' }),
      ];

      const result = adjustElevation(matches, predicts(4.0), 4.0, 'MIL');

      expect(result.contributions[0].offset).toBeCloseTo(0, 10);
      expect(result.adjustedElevation).toBeCloseTo(4.0, 10);
    });

    it('works the other way round, in MOA', () => {
      const matches = [match(1, { id: 1, elevationCorrection: 4.0, correctionUnit: 'MIL' })];

      const result = adjustElevation(matches, predicts(FOUR_MIL_IN_MOA), FOUR_MIL_IN_MOA, 'MOA');

      expect(result.contributions[0].offset).toBeCloseTo(0, 10);
    });

    it('would be badly wrong if the conversion were skipped', () => {
      // The discriminating case: without `elevationIn`, the offset is the raw
      // numeric difference. 9.75 MIL at 600 yards is off the target by a
      // comfortable margin, and nothing about the output would look unusual.
      const matches = [
        match(1, { id: 1, elevationCorrection: FOUR_MIL_IN_MOA, correctionUnit: 'MOA' }),
      ];

      const result = adjustElevation(matches, predicts(4.0), 4.0, 'MIL');

      expect(result.contributions[0].offset).not.toBeCloseTo(FOUR_MIL_IN_MOA - 4.0, 1);
    });

    it('asks the solver for the log distance in yards, whatever the log recorded', () => {
      // 500 m is 546.8 yd. Predicting at "500" would compare the log against
      // the solver's answer for a shot 47 yards shorter.
      const asked: number[] = [];
      const matches = [match(1, { id: 1, distance: 500, distanceUnit: 'meters' })];

      adjustElevation(
        matches,
        (_log, yards) => {
          asked.push(yards);
          return 4.0;
        },
        4.0,
        'MIL'
      );

      expect(asked).toHaveLength(1);
      expect(asked[0]).toBeCloseTo(546.8, 0);
    });
  });

  describe('logs the solver cannot predict', () => {
    it('drops a log the solver has no answer for, rather than treating it as zero', () => {
      // An undefined prediction past the trajectory's end is not an offset of
      // zero -- counting it as one would drag the mean toward the solver.
      const matches = [
        match(1, { id: 1, elevationCorrection: 4.4 }),
        match(1, { id: 2, elevationCorrection: 4.4, distance: 2000 }),
      ];

      const result = adjustElevation(
        matches,
        (log) => (log.distance === 2000 ? undefined : 4.0),
        4.0,
        'MIL'
      );

      expect(result.contributions).toHaveLength(1);
      expect(result.rawOffset).toBeCloseTo(0.4, 10);
    });

    it('falls back to solver-only when no log can be predicted', () => {
      const result = adjustElevation([match(1, { id: 1 })], () => undefined, 4.0, 'MIL');

      expect(result.adjustedElevation).toBe(4.0);
      expect(result.reason).toBe(SOLVER_ONLY_REASON);
    });

    it('drops a non-finite prediction the same way', () => {
      const result = adjustElevation([match(1, { id: 1 })], () => NaN, 4.0, 'MIL');

      expect(result.adjustedElevation).toBe(4.0);
      expect(result.reason).toBe(SOLVER_ONLY_REASON);
    });
  });

  describe('degenerate weights', () => {
    it('ignores matches scored zero rather than dividing by their total', () => {
      const result = adjustElevation(
        [match(0, { id: 1, elevationCorrection: 4.4 })],
        predicts(4.0),
        4.0,
        'MIL'
      );

      expect(result.adjustedElevation).toBe(4.0);
      expect(result.reason).toBe(SOLVER_ONLY_REASON);
    });
  });

  describe('thinner or denser air than today', () => {
    it('needs no separate density-altitude term', () => {
      // Each offset is measured against the solver in *that log's* air, so the
      // difference between then and now is already in the prediction rather
      // than in the offset. #70 §4 asked for a ΔDA model; this is why #168
      // says it is unnecessary.
      //
      // A mountain log dialled 3.6 where the solver said 3.6 for that thin air,
      // and a sea-level log dialled 4.2 where the solver said 4.2 for that
      // dense air, both have an offset of zero. Today's solution stands.
      const matches = [
        match(1, { id: 1, elevationCorrection: 3.6 }),
        match(1, { id: 2, elevationCorrection: 4.2 }),
      ];

      const result = adjustElevation(matches, (log) => log.elevationCorrection, 4.0, 'MIL');

      expect(result.rawOffset).toBeCloseTo(0, 10);
      expect(result.adjustedElevation).toBeCloseTo(4.0, 10);
    });
  });

  describe('with the real matcher', () => {
    it('takes rankMatches output directly', () => {
      // The contract that matters in the app: whatever `rankMatches` returns is
      // what this consumes, with no reshaping in between.
      const logs: DOPELogData[] = [
        log({ id: 1, distance: 600, elevationCorrection: 4.3 }),
        log({ id: 2, distance: 610, elevationCorrection: 4.3 }),
        log({ id: 3, distance: 100, elevationCorrection: 0.1 }),
      ];

      const matches = rankMatches(logs, { rifleId: 1, ammoId: 1, distance: 600 });
      const result = adjustElevation(matches, predicts(4.0), 4.0, 'MIL');

      // The 100 yd log is outside the default 50 yd window, so it contributes
      // nothing and cannot drag the offset toward its own much smaller dial.
      expect(result.contributions.map((c) => c.log.id)).toEqual([1, 2]);
      expect(result.rawOffset).toBeCloseTo(0.3, 10);
    });
  });
});
