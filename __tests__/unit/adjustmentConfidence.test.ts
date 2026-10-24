import {
  AGREEMENT_SCALE_MIL,
  DEFAULT_CONFIDENCE_THRESHOLD,
  EVIDENCE_SOFTENING,
  LOW_CONFIDENCE_REASON,
  adjustmentConfidence,
  applyConfidence,
} from '../../src/utils/adjustmentConfidence';
import { adjustElevation } from '../../src/utils/dopeAdjustment';

import type { DOPELogData } from '../../src/models/DOPELog';
import type { Match } from '../../src/utils/dopeMatching';

/**
 * Confidence in the *adjusted recommendation* (#161).
 *
 * Not the per-log confidence #112 already shows: this scores whether the whole
 * offset is worth believing, from how much evidence there is, how well that
 * evidence is itself evidenced, how far the logs agree with each other, and how
 * near they were shot to the distance being asked about.
 *
 * The assertions that matter are the four the issue names — many agreeing logs
 * are confident, scattered ones are not, no logs at all is not a confidence of
 * zero but an absence, and logs only shot far away do not vouch for here. The
 * rest guard the arithmetic that produces them.
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
  // A well-evidenced log by `calculateConfidence`'s reckoning, so the quality
  // factor is not what any of these tests is secretly measuring.
  shotCount: 5,
  hitCount: 5,
  groupSize: 4,
  ...over,
});

const match = (score: number, over: Partial<DOPELogData> = {}): Match<DOPELogData> => ({
  log: log(over),
  score,
  factors: { distance: score, environment: score, recency: score, quality: score },
});

/** A solver that always predicts `mil` MIL, whatever it is asked. */
const predicts = (mil: number) => () => mil;

/** `n` logs that each dialled `mil`, all at `distance`, all fully relevant. */
const agreeing = (n: number, mil: number, distance = 600): Match<DOPELogData>[] =>
  Array.from({ length: n }, (_, i) => match(1, { id: i + 1, elevationCorrection: mil, distance }));

describe('adjustmentConfidence (#161)', () => {
  describe('the four cases the issue names', () => {
    it('is high when many relevant logs agree at the distance being asked about', () => {
      const adjustment = adjustElevation(agreeing(6, 4.4), predicts(4.0), 4.0, 'MIL');

      const confidence = adjustmentConfidence(adjustment, 600, 'MIL');

      expect(confidence.score).toBeGreaterThan(0.7);
      expect(confidence.score).toBeGreaterThan(DEFAULT_CONFIDENCE_THRESHOLD);
      expect(confidence.factors.agreement).toBeCloseTo(1, 6);
      expect(confidence.factors.proximity).toBeCloseTo(1, 6);
    });

    it('is low when the logs scatter, however many of them there are', () => {
      // Six logs at the same distance, equally relevant, equally well evidenced
      // -- and saying wildly different things. Only `agreement` separates this
      // from the case above, which is the point of asserting both.
      const scattered = [4.0, 4.4, 3.6, 4.8, 3.9, 4.5].map((mil, i) =>
        match(1, { id: i + 1, elevationCorrection: mil })
      );
      const adjustment = adjustElevation(scattered, predicts(4.0), 4.0, 'MIL');

      const confidence = adjustmentConfidence(adjustment, 600, 'MIL');

      expect(confidence.factors.agreement).toBeLessThan(0.1);
      expect(confidence.score).toBeLessThan(DEFAULT_CONFIDENCE_THRESHOLD);
      expect(confidence.reasons.join(' ')).toMatch(/disagree/i);
    });

    it('is zero with no logs at all, and says that rather than naming a weak factor', () => {
      const adjustment = adjustElevation([], predicts(4.0), 4.0, 'MIL');

      const confidence = adjustmentConfidence(adjustment, 600, 'MIL');

      expect(confidence.score).toBe(0);
      expect(confidence.contributingLogs).toBe(0);
      expect(confidence.reasons).toEqual(['No relevant logs']);
    });

    it('falls away when the only logs were shot far from the distance asked about', () => {
      const near = adjustElevation(agreeing(6, 4.4, 600), predicts(4.0), 4.0, 'MIL');
      const far = adjustElevation(agreeing(6, 4.4, 555), predicts(4.0), 4.0, 'MIL');

      const atTheLogs = adjustmentConfidence(near, 600, 'MIL');
      const wellAway = adjustmentConfidence(far, 600, 'MIL');

      expect(wellAway.factors.proximity).toBeLessThan(atTheLogs.factors.proximity);
      expect(wellAway.score).toBeLessThan(atTheLogs.score);
      expect(wellAway.reasons.join(' ')).toMatch(/nearest log/i);
    });
  });

  describe('each factor is visible, so the UI can say why confidence is low', () => {
    it('reports all four factors and the log count', () => {
      const adjustment = adjustElevation(agreeing(3, 4.4), predicts(4.0), 4.0, 'MIL');

      const confidence = adjustmentConfidence(adjustment, 600, 'MIL');

      expect(Object.keys(confidence.factors).sort()).toEqual([
        'agreement',
        'evidence',
        'proximity',
        'quality',
      ]);
      expect(confidence.contributingLogs).toBe(3);
      for (const factor of Object.values(confidence.factors)) {
        expect(factor).toBeGreaterThanOrEqual(0);
        expect(factor).toBeLessThanOrEqual(1);
      }
    });

    it('names the weak factor rather than only the number', () => {
      // One thinly evidenced log: no shot count, no group size, so
      // `calculateConfidence` marks it down and `evidence` is at its thinnest.
      const thin = [
        {
          log: log({ id: 1, elevationCorrection: 4.4, shotCount: undefined, groupSize: undefined }),
          score: 1,
          factors: { distance: 1, environment: 1, recency: 1, quality: 1 },
        },
      ];
      const adjustment = adjustElevation(thin, predicts(4.0), 4.0, 'MIL');

      const confidence = adjustmentConfidence(adjustment, 600, 'MIL');

      expect(confidence.reasons.join(' ')).toMatch(/1 log/);
      expect(confidence.reasons.length).toBeGreaterThan(0);
    });

    it('says so plainly when every factor is strong', () => {
      const adjustment = adjustElevation(agreeing(8, 4.4), predicts(4.0), 4.0, 'MIL');

      const confidence = adjustmentConfidence(adjustment, 600, 'MIL');

      expect(confidence.reasons.join(' ')).toMatch(/8 logs/);
    });
  });

  describe('evidence', () => {
    it('saturates, so a seventh log adds less than a second one', () => {
      const score = (n: number) =>
        adjustmentConfidence(
          adjustElevation(agreeing(n, 4.4), predicts(4.0), 4.0, 'MIL'),
          600,
          'MIL'
        ).factors.evidence;

      const firstStep = score(2) - score(1);
      const laterStep = score(7) - score(6);

      expect(firstStep).toBeGreaterThan(laterStep);
      expect(score(1)).toBeCloseTo(1 / (1 + EVIDENCE_SOFTENING), 10);
    });

    it('counts relevance, not logs: four half-relevant logs weigh two full ones', () => {
      const half = Array.from({ length: 4 }, (_, i) =>
        match(0.5, { id: i + 1, elevationCorrection: 4.4 })
      );

      const fromHalves = adjustmentConfidence(
        adjustElevation(half, predicts(4.0), 4.0, 'MIL'),
        600,
        'MIL'
      );
      const fromWholes = adjustmentConfidence(
        adjustElevation(agreeing(2, 4.4), predicts(4.0), 4.0, 'MIL'),
        600,
        'MIL'
      );

      expect(fromHalves.factors.evidence).toBeCloseTo(fromWholes.factors.evidence, 10);
    });
  });

  describe('agreement', () => {
    it('is not measurable from one log, and is not therefore counted against it', () => {
      const one = adjustmentConfidence(
        adjustElevation(agreeing(1, 4.4), predicts(4.0), 4.0, 'MIL'),
        600,
        'MIL'
      );

      // Thinness is `evidence`'s job. Charging it to `agreement` as well would
      // bill a single log twice for being single, and #168 requires that one
      // match still moves the answer.
      expect(one.factors.agreement).toBe(1);
      expect(one.factors.evidence).toBeLessThan(0.5);
    });

    it('reads the spread in the working unit, so MOA is not judged on a MIL scale', () => {
      // The same physical disagreement, logged in MOA. 0.2 MIL is 0.688 MOA, so
      // a MOA spread compared against AGREEMENT_SCALE_MIL unconverted would
      // score this far more disagreeing than it is.
      const inMil = [4.2, 3.8].map((mil, i) => match(1, { id: i + 1, elevationCorrection: mil }));
      const inMoa = [4.2, 3.8].map((mil, i) =>
        match(1, {
          id: i + 1,
          elevationCorrection: mil * 3.4377,
          correctionUnit: 'MOA' as const,
        })
      );

      const milResult = adjustmentConfidence(
        adjustElevation(inMil, predicts(4.0), 4.0, 'MIL'),
        600,
        'MIL'
      );
      const moaResult = adjustmentConfidence(
        adjustElevation(inMoa, predicts(4.0 * 3.4377), 4.0 * 3.4377, 'MOA'),
        600,
        'MOA'
      );

      expect(moaResult.factors.agreement).toBeCloseTo(milResult.factors.agreement, 3);
    });

    it('is perfect when every log says the same thing', () => {
      const confidence = adjustmentConfidence(
        adjustElevation(agreeing(4, 4.4), predicts(4.0), 4.0, 'MIL'),
        600,
        'MIL'
      );

      expect(confidence.factors.agreement).toBe(1);
      expect(AGREEMENT_SCALE_MIL).toBeGreaterThan(0);
    });
  });

  describe('proximity', () => {
    it('is measured to the nearest log, not to the average of them', () => {
      // One log right on the distance and one far from it. The near one
      // vouches for here; averaging would report both as middling.
      const mixed = [
        match(1, { id: 1, elevationCorrection: 4.4, distance: 600 }),
        match(1, { id: 2, elevationCorrection: 4.4, distance: 540 }),
      ];

      const confidence = adjustmentConfidence(
        adjustElevation(mixed, predicts(4.0), 4.0, 'MIL'),
        600,
        'MIL'
      );

      expect(confidence.factors.proximity).toBeCloseTo(1, 6);
    });

    it('reads each log in yards, whatever it was recorded in (#106)', () => {
      // 549 metres is 600.3 yards: on top of the shot. Compared raw it is 51
      // "yards" away, which is outside the default window entirely.
      const metric = [
        match(1, {
          id: 1,
          elevationCorrection: 4.4,
          distance: 549,
          distanceUnit: 'meters' as const,
        }),
      ];

      const confidence = adjustmentConfidence(
        adjustElevation(metric, predicts(4.0), 4.0, 'MIL'),
        600,
        'MIL'
      );

      expect(confidence.factors.proximity).toBeGreaterThan(0.99);
    });
  });

  describe('quality', () => {
    it('weights each log by relevance, so an irrelevant poor log is not held against it', () => {
      const strong = match(1, { id: 1, elevationCorrection: 4.4 });
      const weakAndPoor = match(0.05, {
        id: 2,
        elevationCorrection: 4.4,
        shotCount: 1,
        hitCount: 0,
        groupSize: undefined,
      });

      const withPoor = adjustmentConfidence(
        adjustElevation([strong, weakAndPoor], predicts(4.0), 4.0, 'MIL'),
        600,
        'MIL'
      );
      const alone = adjustmentConfidence(
        adjustElevation([strong], predicts(4.0), 4.0, 'MIL'),
        600,
        'MIL'
      );

      expect(withPoor.factors.quality).toBeGreaterThan(alone.factors.quality - 0.05);
    });
  });
});

describe('applyConfidence (#161)', () => {
  it('scales the offset by confidence rather than by #168 trust', () => {
    const adjustment = adjustElevation(agreeing(6, 4.4), predicts(4.0), 4.0, 'MIL');
    const confidence = adjustmentConfidence(adjustment, 600, 'MIL');

    const applied = applyConfidence(adjustment, confidence);

    expect(applied.offset).toBeCloseTo(adjustment.rawOffset * confidence.score, 10);
    expect(applied.adjustedElevation).toBeCloseTo(
      4.0 + adjustment.rawOffset * confidence.score,
      10
    );
    expect(applied.solverOnly).toBe(false);
    // The double-damping this exists to avoid: trust and confidence both
    // measure the amount of evidence, so multiplying by both bills it twice.
    expect(applied.offset).not.toBeCloseTo(adjustment.offset * confidence.score, 4);
  });

  it('falls back to the solver alone below the threshold, and says why', () => {
    const scattered = [4.0, 4.4, 3.6, 4.8, 3.9, 4.5].map((mil, i) =>
      match(1, { id: i + 1, elevationCorrection: mil })
    );
    const adjustment = adjustElevation(scattered, predicts(4.0), 4.0, 'MIL');
    const confidence = adjustmentConfidence(adjustment, 600, 'MIL');

    const applied = applyConfidence(adjustment, confidence);

    expect(applied.solverOnly).toBe(true);
    expect(applied.offset).toBe(0);
    expect(applied.adjustedElevation).toBe(4.0);
    expect(applied.reason).toBe(LOW_CONFIDENCE_REASON);
  });

  it('keeps the solver-only reason from #168 when there was nothing to go on', () => {
    const adjustment = adjustElevation([], predicts(4.0), 4.0, 'MIL');
    const confidence = adjustmentConfidence(adjustment, 600, 'MIL');

    const applied = applyConfidence(adjustment, confidence);

    expect(applied.solverOnly).toBe(true);
    expect(applied.reason).toBe(adjustment.reason);
  });

  it('honours a threshold the caller sets, which is what #167 will configure', () => {
    const adjustment = adjustElevation(agreeing(6, 4.4), predicts(4.0), 4.0, 'MIL');
    const confidence = adjustmentConfidence(adjustment, 600, 'MIL');

    expect(applyConfidence(adjustment, confidence, 0.99).solverOnly).toBe(true);
    expect(applyConfidence(adjustment, confidence, 0).solverOnly).toBe(false);
  });

  it('still lets a single relevant log move the answer, as #168 requires', () => {
    const adjustment = adjustElevation(agreeing(1, 4.4), predicts(4.0), 4.0, 'MIL');
    const confidence = adjustmentConfidence(adjustment, 600, 'MIL');

    const applied = applyConfidence(adjustment, confidence);

    expect(applied.solverOnly).toBe(false);
    expect(applied.offset).toBeGreaterThan(0);
    // ...but by less than six agreeing logs would.
    const many = adjustElevation(agreeing(6, 4.4), predicts(4.0), 4.0, 'MIL');
    const manyApplied = applyConfidence(many, adjustmentConfidence(many, 600, 'MIL'));
    expect(applied.offset).toBeLessThan(manyApplied.offset);
  });
});
