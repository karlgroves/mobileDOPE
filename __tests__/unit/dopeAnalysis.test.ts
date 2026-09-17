import {
  buildDropCurve,
  calculateConfidence,
  compareToCalculated,
  detectOutliers,
  suggestBallisticCoefficient,
  suggestMuzzleVelocity,
} from '../../src/utils/dopeAnalysis';

import type { DOPELogData } from '../../src/models/DOPELog';

/**
 * The analysis layer over logged DOPE (#64).
 *
 * These assert behaviour that any correct implementation must have — an outlier
 * is found, a tighter group scores higher, a bias that grows with distance
 * points at BC rather than velocity — rather than the exact numbers this
 * implementation happens to produce. The scaling factors in the suggestions are
 * first-order approximations and will be refined; tests that pinned them would
 * fail on every refinement while saying nothing about correctness.
 */

const log = (overrides: Partial<DOPELogData> = {}): DOPELogData => ({
  rifleId: 1,
  ammoId: 1,
  environmentId: 1,
  distance: 500,
  distanceUnit: 'yards',
  elevationCorrection: 3.0,
  windageCorrection: 0,
  correctionUnit: 'MIL',
  targetType: 'steel',
  ...overrides,
});

/** A clean linear set: 1 MIL per 100 yards. */
const linearSet = (distances: number[], perHundred = 1): DOPELogData[] =>
  distances.map((distance) =>
    log({ distance, elevationCorrection: (distance / 100) * perHundred })
  );

describe("group size in MOA respects the log's unit", () => {
  /**
   * A log holds its distance in its own unit (#106). The MOA figure is
   * `groupSize / (distanceYards / 100)`, so reading 600 metres as 600 yards
   * divides by a distance 9% too short and reports a group 9% *worse* than it
   * is -- a metric shooter's whole history rated down, in the one number they
   * have no independent way to check.
   *
   * Group sizes here are chosen to land inside a band `calculateConfidence`
   * actually reports on; between 1 and 3 MOA it says nothing, so there would be
   * nothing to assert against.
   */

  /** The MOA figure calculateConfidence put in its reasons, if it gave one. */
  const reportedMoa = (over: Partial<DOPELogData>): number | undefined => {
    const reason = calculateConfidence(log(over)).reasons.find((r) => r.includes('MOA'));
    return reason === undefined ? undefined : Number.parseFloat(reason);
  };

  it('rates the same physical group the same way in either unit', () => {
    // 600 m is 656.168 yd. A 5.5 inch group at that range is the same group
    // however the shooter wrote the distance down.
    const metric = reportedMoa({ distance: 600, distanceUnit: 'meters', groupSize: 5.5 });
    const imperial = reportedMoa({ distance: 656.168, distanceUnit: 'yards', groupSize: 5.5 });

    expect(metric).toBeDefined();
    expect(metric).toBeCloseTo(imperial as number, 2);
  });

  it('does not rate a metric group worse than it is', () => {
    // The defect as the shooter sees it. `calculateConfidence` formats the
    // figure to one decimal, so these are the printed values, not the raw ones
    // -- 0.838 and 0.917 before rounding. Asserting the rounded pair is the
    // point: it is what appears on screen, and the two differ there.
    const correct = reportedMoa({ distance: 600, distanceUnit: 'meters', groupSize: 5.5 });
    const naive = reportedMoa({ distance: 600, distanceUnit: 'yards', groupSize: 5.5 });

    expect(correct).toBe(0.8);
    expect(naive).toBe(0.9);
  });

  it('treats a log with no recorded unit as yards', () => {
    const untagged = reportedMoa({ distance: 600, distanceUnit: undefined, groupSize: 5.5 });
    const explicit = reportedMoa({ distance: 600, distanceUnit: 'yards', groupSize: 5.5 });

    expect(untagged).toBeDefined();
    expect(untagged).toBeCloseTo(explicit as number, 4);
  });
});

describe('calculateConfidence', () => {
  it('rates a well-evidenced point above a thin one', () => {
    const solid = calculateConfidence(
      log({ shotCount: 5, hitCount: 5, groupSize: 2.5, distance: 500 })
    );
    const thin = calculateConfidence(log({ shotCount: 1, distance: 500 }));

    expect(solid.score).toBeGreaterThan(thin.score);
  });

  it('penalises a poor hit rate', () => {
    const hits = calculateConfidence(log({ shotCount: 5, hitCount: 5, groupSize: 2.5 }));
    const misses = calculateConfidence(log({ shotCount: 5, hitCount: 1, groupSize: 2.5 }));

    expect(misses.score).toBeLessThan(hits.score);
  });

  it('penalises a wide group for the distance', () => {
    // 2.5" at 500yd is 0.5 MOA; 25" at 500yd is 5 MOA.
    const tight = calculateConfidence(log({ shotCount: 5, groupSize: 2.5, distance: 500 }));
    const wide = calculateConfidence(log({ shotCount: 5, groupSize: 25, distance: 500 }));

    expect(wide.score).toBeLessThan(tight.score);
  });

  it('stays within 0 and 1 at both extremes', () => {
    const best = calculateConfidence(
      log({ shotCount: 20, hitCount: 20, groupSize: 0.5, distance: 1000 })
    );
    const worst = calculateConfidence(log({ shotCount: 1, hitCount: 0, groupSize: 60 }));

    for (const c of [best, worst]) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(1);
    }
  });

  it('explains itself', () => {
    const { reasons } = calculateConfidence(log({ shotCount: 5, hitCount: 5, groupSize: 2.5 }));
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.join(' ')).toMatch(/shot|hit|MOA/i);
  });

  it('does not reward or punish agreement with a model', () => {
    // Two identical observations at the same distance with wildly different
    // corrections must score the same: confidence is about the evidence behind
    // the point, not whether it matches a prediction. A log that disagrees with
    // the solver is often the most valuable one in the set.
    const a = calculateConfidence(
      log({ shotCount: 5, hitCount: 5, groupSize: 2, elevationCorrection: 3.0 })
    );
    const b = calculateConfidence(
      log({ shotCount: 5, hitCount: 5, groupSize: 2, elevationCorrection: 9.9 })
    );

    expect(a.score).toBe(b.score);
  });
});

describe('detectOutliers', () => {
  it('finds a point that disagrees with the trend', () => {
    const logs = [
      ...linearSet([100, 200, 300, 400, 600, 700, 800]),
      log({ distance: 500, elevationCorrection: 12.0 }), // should be ~5.0
    ];

    const outliers = detectOutliers(logs);

    expect(outliers).toHaveLength(1);
    expect(outliers[0].log.distance).toBe(500);
    expect(outliers[0].actual).toBe(12.0);
    expect(outliers[0].expected).toBeCloseTo(5.0, 0);
  });

  it('finds nothing in a clean set', () => {
    expect(detectOutliers(linearSet([100, 200, 300, 400, 500, 600]))).toEqual([]);
  });

  it('is not fooled by a single extreme value inflating the spread', () => {
    // The reason for median/MAD over mean/stdev: with a mean-based test, one
    // very large residual raises the threshold enough to hide itself.
    const logs = [
      ...linearSet([100, 200, 300, 400, 500, 600, 700]),
      log({ distance: 800, elevationCorrection: 80 }), // should be ~8.0
    ];

    const outliers = detectOutliers(logs);

    expect(outliers.map((o) => o.log.distance)).toContain(800);
  });

  it('returns nothing below four points, where removing one leaves a perfect fit', () => {
    expect(detectOutliers(linearSet([100, 200, 300]))).toEqual([]);
  });

  it('returns nothing when every log is at the same distance', () => {
    // No line to fit. Spread at one distance is a grouping question, not a
    // trend question, and dividing by a zero denominator would throw or produce
    // Infinity scores for the whole set.
    const logs = [3.0, 3.2, 3.1, 9.0].map((c) => log({ distance: 500, elevationCorrection: c }));

    expect(detectOutliers(logs)).toEqual([]);
  });

  it('ranks the worst offender first', () => {
    const logs = [
      ...linearSet([100, 200, 300, 400, 700, 800]),
      log({ distance: 500, elevationCorrection: 11 }),
      log({ distance: 600, elevationCorrection: 30 }),
    ];

    const outliers = detectOutliers(logs);

    expect(outliers.length).toBeGreaterThanOrEqual(2);
    expect(outliers[0].score).toBeGreaterThanOrEqual(outliers[1].score);
  });
});

describe('buildDropCurve', () => {
  it('orders points by distance and counts the samples', () => {
    const logs = [
      log({ distance: 300, elevationCorrection: 3 }),
      log({ distance: 100, elevationCorrection: 1 }),
      log({ distance: 300, elevationCorrection: 3.2 }),
    ];

    const curve = buildDropCurve(logs);

    expect(curve.map((p) => p.distance)).toEqual([100, 300]);
    expect(curve[1].sampleCount).toBe(2);
  });

  it('uses the median so one mis-keyed entry does not move the curve', () => {
    const logs = [3.0, 3.1, 3.2, 30].map((c) => log({ distance: 500, elevationCorrection: c }));

    // Mean would be ~9.8. Median is 3.15.
    expect(buildDropCurve(logs)[0].correction).toBeCloseTo(3.15, 2);
  });

  it('ignores logs with no usable distance', () => {
    expect(buildDropCurve([log({ distance: 0 })])).toEqual([]);
  });
});

describe('compareToCalculated', () => {
  it('reports the signed gap at each distance', () => {
    const logs = linearSet([100, 200, 300]);
    const comparisons = compareToCalculated(logs, (d) => (d / 100) * 0.9);

    expect(comparisons).toHaveLength(3);
    for (const c of comparisons) {
      expect(c.difference).toBeCloseTo(c.logged - c.calculated, 6);
      expect(c.difference).toBeGreaterThan(0); // logged more than calculated
    }
  });

  it('skips distances the solver cannot answer for', () => {
    const logs = linearSet([100, 200, 300]);
    const comparisons = compareToCalculated(logs, (d) => (d === 200 ? undefined : 1));

    expect(comparisons.map((c) => c.distance)).toEqual([100, 300]);
  });

  it('skips non-finite predictions rather than propagating NaN', () => {
    const comparisons = compareToCalculated(linearSet([100, 200]), () => NaN);
    expect(comparisons).toEqual([]);
  });
});

describe('suggestMuzzleVelocity', () => {
  const comparisons = (difference: number, distances = [300, 500, 700, 900]) =>
    distances.map((distance) => ({
      distance,
      logged: (distance / 100) * 1 + difference,
      calculated: (distance / 100) * 1,
      difference,
    }));

  it('lowers the velocity when more drop is logged than predicted', () => {
    const suggestion = suggestMuzzleVelocity(comparisons(0.4), 2700);

    expect(suggestion).toBeDefined();
    expect(suggestion!.suggested).toBeLessThan(2700);
  });

  it('raises it when less drop is logged than predicted', () => {
    const suggestion = suggestMuzzleVelocity(comparisons(-0.4), 2700);

    expect(suggestion).toBeDefined();
    expect(suggestion!.suggested).toBeGreaterThan(2700);
  });

  it('stays quiet when the bias is inside normal dialling error', () => {
    expect(suggestMuzzleVelocity(comparisons(0.05), 2700)).toBeUndefined();
  });

  it('stays quiet below three comparisons', () => {
    expect(suggestMuzzleVelocity(comparisons(0.5, [300, 500]), 2700)).toBeUndefined();
  });

  it('is more confident about a consistent bias than a scattered one', () => {
    const consistent = suggestMuzzleVelocity(comparisons(0.4), 2700);
    const scattered = suggestMuzzleVelocity(
      [0.1, 0.9, 0.2, 0.8].map((difference, i) => ({
        distance: 300 + i * 200,
        logged: 0,
        calculated: 0,
        difference,
      })),
      2700
    );

    expect(consistent!.confidence).toBeGreaterThan(scattered!.confidence);
  });

  it('says what it is based on and that it needs verifying', () => {
    const { rationale } = suggestMuzzleVelocity(comparisons(0.4), 2700)!;
    expect(rationale).toMatch(/chronograph/i);
  });

  describe('MOA', () => {
    // The unit parameter has its own noise floor and its own scaling, and both
    // were untested until review. An MOA is about 0.29 MIL, so the same NUMBER
    // of units is a smaller angle — the floor has to be higher and the implied
    // velocity change smaller, or a user on MOA turrets gets suggestions from
    // noise and three times too large when they do fire.

    it('uses a higher noise floor, since an MOA is a smaller angle than a MIL', () => {
      // 0.2 is above the MIL floor of 0.1 and below the MOA floor of 0.34.
      expect(suggestMuzzleVelocity(comparisons(0.2), 2700, 'MIL')).toBeDefined();
      expect(suggestMuzzleVelocity(comparisons(0.2), 2700, 'MOA')).toBeUndefined();
    });

    it('implies a smaller velocity change than the same number of MILs', () => {
      const mil = suggestMuzzleVelocity(comparisons(1.0), 2700, 'MIL')!;
      const moa = suggestMuzzleVelocity(comparisons(1.0), 2700, 'MOA')!;

      // Same direction...
      expect(mil.suggested).toBeLessThan(2700);
      expect(moa.suggested).toBeLessThan(2700);
      // ...but 1 MOA is a much smaller error than 1 MIL, so a smaller change.
      expect(2700 - moa.suggested).toBeLessThan(2700 - mil.suggested);
    });

    it('names the unit it was given', () => {
      const { rationale } = suggestMuzzleVelocity(comparisons(1.0), 2700, 'MOA')!;
      expect(rationale).toContain('MOA');
    });
  });
});

describe('suggestBallisticCoefficient', () => {
  /** A gap that grows with distance — the BC signature. */
  const widening = [300, 500, 700, 900].map((distance) => ({
    distance,
    logged: 0,
    calculated: 0,
    difference: (distance - 300) * 0.004,
  }));

  /** A constant gap — the muzzle-velocity signature. */
  const flat = [300, 500, 700, 900].map((distance) => ({
    distance,
    logged: 0,
    calculated: 0,
    difference: 0.4,
  }));

  it('suggests a lower BC when the gap widens with distance', () => {
    const suggestion = suggestBallisticCoefficient(widening, 0.5);

    expect(suggestion).toBeDefined();
    expect(suggestion!.suggested).toBeLessThan(0.5);
  });

  it('stays quiet for a flat bias, which is a velocity signature not a BC one', () => {
    // This is the distinction the whole function exists to make. A constant
    // offset must NOT be attributed to the drag model.
    expect(suggestBallisticCoefficient(flat, 0.5)).toBeUndefined();
  });

  it('stays quiet when the distances span too narrow a band to tell them apart', () => {
    const narrow = [500, 550, 600, 650].map((distance) => ({
      distance,
      logged: 0,
      calculated: 0,
      difference: (distance - 500) * 0.004,
    }));

    expect(suggestBallisticCoefficient(narrow, 0.5)).toBeUndefined();
  });

  it('stays quiet below four comparisons', () => {
    expect(suggestBallisticCoefficient(widening.slice(0, 3), 0.5)).toBeUndefined();
  });

  it('never suggests a physically absurd BC', () => {
    const extreme = [300, 500, 700, 900].map((distance) => ({
      distance,
      logged: 0,
      calculated: 0,
      difference: (distance - 300) * 2,
    }));

    const suggestion = suggestBallisticCoefficient(extreme, 0.5);

    expect(suggestion!.suggested).toBeGreaterThan(0);
  });
});
