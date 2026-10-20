import {
  MAX_MATCH_WEIGHT,
  NO_DATA_REASON,
  adjustElevationWithDope,
} from '../../src/utils/dopeAssistedElevation';

import type { DOPELogData } from '../../src/models/DOPELog';
import type { Match } from '../../src/utils/dopeMatching';

/**
 * Adjusting the solver's elevation by the shooter's own DOPE (#168).
 *
 * The second half of DOPE-assisted aiming, and the half with the quiet failure
 * modes: a wrong offset still produces a plausible number, and the shooter dials
 * it. So the tests here are about the arithmetic being right for stated reasons
 * rather than about the function returning something.
 */

const log = (over: Partial<DOPELogData> = {}): DOPELogData => ({
  id: 1,
  rifleId: 1,
  ammoId: 1,
  environmentId: 1,
  distance: 500,
  distanceUnit: 'yards',
  elevationCorrection: 3.0,
  windageCorrection: 0,
  correctionUnit: 'MIL',
  targetType: 'steel',
  ...over,
});

/** A scored log as `rankMatches` returns one. Only `score` matters downstream. */
const match = (logData: DOPELogData, score: number): Match<DOPELogData> => ({
  log: logData,
  score,
  factors: { distance: score, environment: score, recency: score, quality: score },
});

describe('adjustElevationWithDope', () => {
  describe('with no usable matches', () => {
    it('leaves the solver alone and says why', () => {
      const result = adjustElevationWithDope({
        matches: [],
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
      });

      expect(result.adjustedElevation).toBe(3.4);
      expect(result.solverElevation).toBe(3.4);
      expect(result.offset).toBe(0);
      expect(result.contributions).toEqual([]);
      expect(result.reason).toBe(NO_DATA_REASON);
    });

    it('treats a match the solver cannot predict as no data', () => {
      // `elevationTable` returns undefined past the trajectory it computed. A
      // log the solver has no opinion about yields no offset, and inventing one
      // from the logged value alone would read the whole correction as error.
      const result = adjustElevationWithDope({
        matches: [match(log(), 0.9)],
        predict: () => undefined,
        solverElevation: 3.4,
        unit: 'MIL',
      });

      expect(result.adjustedElevation).toBe(3.4);
      expect(result.contributions).toEqual([]);
      expect(result.reason).toBe(NO_DATA_REASON);
    });

    it('drops a log the solver predicts as NaN but keeps the rest', () => {
      const result = adjustElevationWithDope({
        matches: [match(log({ id: 1 }), 0.5), match(log({ id: 2 }), 0.5)],
        predict: (entry) => (entry.id === 1 ? NaN : 2.8),
        solverElevation: 3.4,
        unit: 'MIL',
      });

      expect(result.contributions.map((c) => c.log.id)).toEqual([2]);
      expect(result.combinedOffset).toBeCloseTo(0.2, 10);
    });
  });

  describe('a known set of logs giving a known offset', () => {
    it('adds the offset the logs agree on', () => {
      // Three logs, each dialled 0.2 MIL more than the solver predicted for its
      // own shot. The combined offset is that 0.2, whatever the weights are,
      // because a weighted mean of identical values is that value.
      const matches = [
        match(log({ id: 1, elevationCorrection: 3.2 }), 0.9),
        match(log({ id: 2, elevationCorrection: 3.2 }), 0.8),
        match(log({ id: 3, elevationCorrection: 3.2 }), 0.7),
      ];

      const result = adjustElevationWithDope({
        matches,
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
      });

      expect(result.combinedOffset).toBeCloseTo(0.2, 10);
      expect(result.appliedShare).toBe(1);
      expect(result.offset).toBeCloseTo(0.2, 10);
      expect(result.adjustedElevation).toBeCloseTo(3.6, 10);
      expect(result.contributions).toHaveLength(3);
      expect(result.unit).toBe('MIL');
    });

    it('reports each contributing log, its offset and its weight', () => {
      const result = adjustElevationWithDope({
        matches: [
          match(log({ id: 1, elevationCorrection: 3.2 }), 0.5),
          match(log({ id: 2, elevationCorrection: 2.8 }), 0.5),
        ],
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
      });

      expect(result.contributions.map((c) => c.log.id)).toEqual([1, 2]);
      expect(result.contributions.map((c) => Number(c.offset.toFixed(10)))).toEqual([0.2, -0.2]);
      expect(result.contributions.map((c) => c.logged)).toEqual([3.2, 2.8]);
      expect(result.contributions.map((c) => c.predicted)).toEqual([3.0, 3.0]);
      expect(result.contributions.map((c) => c.distanceYards)).toEqual([500, 500]);
      // Equal scores, equal weights, and the shares sum to one.
      expect(result.contributions[0].weight).toBeCloseTo(0.5, 10);
      expect(result.contributions[1].weight).toBeCloseTo(0.5, 10);
      // Opposite offsets cancel: the logs disagree, so the solver stands.
      expect(result.offset).toBeCloseTo(0, 10);
      expect(result.adjustedElevation).toBeCloseTo(3.4, 10);
    });

    it('averages disagreeing offsets rather than taking the nearest', () => {
      const result = adjustElevationWithDope({
        matches: [
          match(log({ id: 1, elevationCorrection: 3.4 }), 0.6),
          match(log({ id: 2, elevationCorrection: 3.2 }), 0.6),
          match(log({ id: 3, elevationCorrection: 3.0 }), 0.6),
        ],
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
      });

      // Offsets 0.4, 0.2 and 0.0 at equal weight.
      expect(result.combinedOffset).toBeCloseTo(0.2, 10);
    });
  });

  describe('weighting', () => {
    it('lets a heavily weighted log dominate several weak ones', () => {
      // One strongly relevant log says +1.0; two barely relevant ones say -1.0.
      // The answer must follow the strong log -- that is what the relevance
      // score is for -- without the weak ones being ignored outright.
      const result = adjustElevationWithDope({
        matches: [
          match(log({ id: 1, elevationCorrection: 4.0 }), 0.95),
          match(log({ id: 2, elevationCorrection: 2.0 }), 0.05),
          match(log({ id: 3, elevationCorrection: 2.0 }), 0.05),
        ],
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
      });

      expect(result.combinedOffset).toBeGreaterThan(0.5);
      const dominant = result.contributions.find((c) => c.log.id === 1);
      expect(dominant?.weight).toBeGreaterThan(0.8);
      // Not the whole answer: the dissenters still pulled it below +1.0.
      expect(result.combinedOffset).toBeLessThan(1.0);
    });

    it('caps one log so a single match moves the answer less than several', () => {
      const one = adjustElevationWithDope({
        matches: [match(log({ id: 1, elevationCorrection: 4.0 }), 1)],
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
      });

      const several = adjustElevationWithDope({
        matches: [
          match(log({ id: 1, elevationCorrection: 4.0 }), 1),
          match(log({ id: 2, elevationCorrection: 4.0 }), 1),
          match(log({ id: 3, elevationCorrection: 4.0 }), 1),
        ],
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
      });

      // Same offset in both: the logs agree on +1.0 MIL.
      expect(one.combinedOffset).toBeCloseTo(1.0, 10);
      expect(several.combinedOffset).toBeCloseTo(1.0, 10);

      // But a single log carries only part of it.
      expect(one.appliedShare).toBeCloseTo(MAX_MATCH_WEIGHT, 10);
      expect(one.offset).toBeCloseTo(MAX_MATCH_WEIGHT, 10);
      expect(several.appliedShare).toBe(1);
      expect(several.offset).toBeCloseTo(1.0, 10);
      expect(Math.abs(one.offset)).toBeLessThan(Math.abs(several.offset));
    });

    it('still uses a single match rather than discarding it', () => {
      const result = adjustElevationWithDope({
        matches: [match(log({ elevationCorrection: 3.4 }), 0.8)],
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
      });

      expect(result.contributions).toHaveLength(1);
      expect(result.offset).toBeGreaterThan(0);
      expect(result.adjustedElevation).toBeGreaterThan(3.4);
      expect(result.reason).not.toBe(NO_DATA_REASON);
    });

    it('weights by relevance, not by how many logs happen to agree', () => {
      // Two logs at the cap weigh the same as three, so the applied share is
      // full in both cases; what differs is the offset they imply.
      const result = adjustElevationWithDope({
        matches: [
          match(log({ id: 1, elevationCorrection: 3.4 }), 1),
          match(log({ id: 2, elevationCorrection: 3.0 }), 1),
        ],
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
      });

      expect(result.appliedShare).toBe(1);
      expect(result.combinedOffset).toBeCloseTo(0.2, 10);
    });

    it('falls back to equal weights when every score is zero', () => {
      // `scoreRelevance` maps a non-finite weighted score to 0 on purpose, so a
      // set of all-zero scores is reachable. Dividing by their sum would make
      // every offset NaN, which the shooter would see as a blank adjustment
      // rather than as a failure.
      const result = adjustElevationWithDope({
        matches: [
          match(log({ id: 1, elevationCorrection: 3.4 }), 0),
          match(log({ id: 2, elevationCorrection: 3.0 }), 0),
        ],
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
      });

      expect(result.combinedOffset).toBeCloseTo(0.2, 10);
      expect(Number.isFinite(result.adjustedElevation)).toBe(true);
    });
  });

  describe('mixed units (#125)', () => {
    it('asks the solver in yards for a log recorded in metres', () => {
      const asked: number[] = [];

      adjustElevationWithDope({
        matches: [match(log({ distance: 500, distanceUnit: 'meters' }), 0.9)],
        predict: (_entry, yards) => {
          asked.push(yards);
          return 3.0;
        },
        solverElevation: 3.4,
        unit: 'MIL',
      });

      // 500 m is 546.8 yd. Passing the raw 500 would ask the solver about a
      // target 47 yards nearer than the one that was shot.
      expect(asked).toHaveLength(1);
      expect(asked[0]).toBeCloseTo(546.807, 2);
    });

    it('converts a log recorded in MOA before taking its offset', () => {
      // 10.314 MOA is 3.0 MIL. Against a 3.0 MIL prediction the offset is zero;
      // read raw, it would look like 7.3 MIL of error.
      const result = adjustElevationWithDope({
        matches: [match(log({ elevationCorrection: 10.314, correctionUnit: 'MOA' }), 0.9)],
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
      });

      expect(result.contributions[0].logged).toBeCloseTo(3.0, 3);
      expect(result.combinedOffset).toBeCloseTo(0, 3);
      expect(result.adjustedElevation).toBeCloseTo(3.4, 3);
    });

    it('reports in MOA when MOA is asked for', () => {
      // The same shooter bias of 0.2 MIL is 0.688 MOA. Both the logged value and
      // the offset come back in the requested unit.
      const result = adjustElevationWithDope({
        matches: [match(log({ elevationCorrection: 3.2 }), 1)],
        predict: () => 10.314, // 3.0 MIL in MOA
        solverElevation: 11.69,
        unit: 'MOA',
      });

      expect(result.unit).toBe('MOA');
      expect(result.contributions[0].logged).toBeCloseTo(11.0, 1);
      expect(result.combinedOffset).toBeCloseTo(0.688, 2);
    });

    it('mixes metric MOA logs with imperial MIL ones on one scale', () => {
      // Both logs are 0.2 MIL above their own prediction, recorded differently.
      // Any missed conversion makes them disagree and halves the offset.
      const result = adjustElevationWithDope({
        matches: [
          match(log({ id: 1, elevationCorrection: 3.2 }), 1),
          match(
            log({
              id: 2,
              distance: 457.2,
              distanceUnit: 'meters',
              elevationCorrection: 11.0016, // 3.2 MIL in MOA
              correctionUnit: 'MOA',
            }),
            1
          ),
        ],
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
      });

      expect(result.contributions[0].offset).toBeCloseTo(0.2, 3);
      expect(result.contributions[1].offset).toBeCloseTo(0.2, 3);
      expect(result.combinedOffset).toBeCloseTo(0.2, 3);
    });
  });

  describe('logs from much thinner or denser air than today', () => {
    it('keeps the shooter bias and discards the density-altitude difference', () => {
      // The point of measuring each offset against the solver in that log's own
      // air (#168): one log was shot at 12,000 ft of density altitude needing
      // 2.6 MIL, another at sea level needing 3.4. Both were 0.2 MIL above what
      // the solver predicted for them. The offset is that 0.2 -- not the 0.8 MIL
      // of air between the two days.
      const predictions: Record<number, number> = { 1: 2.4, 2: 3.2 };

      const result = adjustElevationWithDope({
        matches: [
          match(log({ id: 1, elevationCorrection: 2.6 }), 0.9),
          match(log({ id: 2, elevationCorrection: 3.4 }), 0.9),
        ],
        predict: (entry) => predictions[entry.id ?? 0],
        solverElevation: 3.0,
        unit: 'MIL',
      });

      expect(result.contributions.map((c) => Number(c.offset.toFixed(10)))).toEqual([0.2, 0.2]);
      expect(result.combinedOffset).toBeCloseTo(0.2, 10);
      expect(result.adjustedElevation).toBeCloseTo(3.2, 10);
    });

    it('does not let a thin-air log inflate the offset', () => {
      // Read without a per-log prediction -- against today's solution instead --
      // the thin-air log alone would read as -0.4 MIL of error.
      const result = adjustElevationWithDope({
        matches: [match(log({ id: 1, elevationCorrection: 2.6 }), 1)],
        predict: () => 2.6,
        solverElevation: 3.0,
        unit: 'MIL',
      });

      expect(result.combinedOffset).toBeCloseTo(0, 10);
      expect(result.adjustedElevation).toBeCloseTo(3.0, 10);
    });
  });

  describe('the reason it gives', () => {
    it('names the offset, the unit and how many logs are behind it', () => {
      const result = adjustElevationWithDope({
        matches: [
          match(log({ id: 1, elevationCorrection: 3.2 }), 1),
          match(log({ id: 2, elevationCorrection: 3.2 }), 1),
        ],
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
      });

      expect(result.reason).toContain('2 logs');
      expect(result.reason).toContain('0.20');
      expect(result.reason).toContain('MIL');
    });

    it('says a single log is only partly applied', () => {
      const result = adjustElevationWithDope({
        matches: [match(log({ elevationCorrection: 3.2 }), 1)],
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
      });

      expect(result.reason).toContain('1 log');
      expect(result.reason).toContain('50%');
    });
  });

  describe('guards', () => {
    it('skips a log with no usable distance', () => {
      const result = adjustElevationWithDope({
        matches: [match(log({ distance: 0 }), 0.9)],
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
      });

      expect(result.contributions).toEqual([]);
      expect(result.reason).toBe(NO_DATA_REASON);
    });

    it('skips a log whose own correction is not a number', () => {
      const result = adjustElevationWithDope({
        matches: [match(log({ elevationCorrection: NaN }), 0.9)],
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
      });

      expect(result.contributions).toEqual([]);
    });

    it('leaves the solver alone when its own elevation is not a number', () => {
      const result = adjustElevationWithDope({
        matches: [match(log({ elevationCorrection: 3.2 }), 1)],
        predict: () => 3.0,
        solverElevation: NaN,
        unit: 'MIL',
      });

      expect(Number.isNaN(result.adjustedElevation)).toBe(true);
      expect(result.offset).toBe(0);
      expect(result.contributions).toEqual([]);
    });

    it('accepts an overridden cap', () => {
      const result = adjustElevationWithDope({
        matches: [match(log({ elevationCorrection: 4.0 }), 1)],
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
        maxMatchWeight: 1,
      });

      expect(result.appliedShare).toBe(1);
      expect(result.offset).toBeCloseTo(1.0, 10);
    });

    it('ignores a nonsensical cap rather than returning NaN', () => {
      const result = adjustElevationWithDope({
        matches: [match(log({ elevationCorrection: 4.0 }), 1)],
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
        maxMatchWeight: 0,
      });

      expect(Number.isFinite(result.adjustedElevation)).toBe(true);
      expect(result.appliedShare).toBeCloseTo(MAX_MATCH_WEIGHT, 10);
    });

    it('does not mutate the logs it was given', () => {
      const entry = log({ elevationCorrection: 10.314, correctionUnit: 'MOA' });

      adjustElevationWithDope({
        matches: [match(entry, 1)],
        predict: () => 3.0,
        solverElevation: 3.4,
        unit: 'MIL',
      });

      expect(entry.elevationCorrection).toBe(10.314);
      expect(entry.correctionUnit).toBe('MOA');
    });
  });
});
