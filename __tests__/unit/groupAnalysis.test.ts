import {
  analyseGroup,
  analyseShotCalling,
  calculateCircularErrorProbable,
  calculateExtremeSpread,
  calculateGroupCentre,
  calculateMeanRadius,
  scaleToInches,
  toMOA,
} from '../../src/utils/groupAnalysis';

import type { POIMarker } from '../../src/models/TargetImage';

/**
 * Group statistics from marked points of impact (#63).
 *
 * Geometry, so these assert exact values where there is a right answer — a
 * 3-4-5 triangle really does have a hypotenuse of 5 — and properties where the
 * statistic is a judgement (mean radius must sit between zero and the extreme
 * spread, CEP must contain half the shots).
 */

const poi = (x: number, y: number, shotNumber?: number): POIMarker => ({ x, y, shotNumber });

describe('calculateGroupCentre', () => {
  it('averages the marked positions', () => {
    expect(calculateGroupCentre([poi(0, 0), poi(10, 0), poi(0, 10), poi(10, 10)])).toEqual({
      x: 5,
      y: 5,
    });
  });

  it('includes a flier rather than discounting it', () => {
    // Unlike the DOPE analysis, a wide shot here is real data: it came out of
    // the barrel and belongs in where the rifle is actually shooting. A centre
    // that ignored it would misrepresent the group.
    const tight = calculateGroupCentre([poi(0, 0), poi(2, 0), poi(0, 2)]);
    const withFlier = calculateGroupCentre([poi(0, 0), poi(2, 0), poi(0, 2), poi(60, 0)]);

    expect(withFlier.x).toBeGreaterThan(tight.x);
  });

  it('returns NaN for an empty group rather than a misleading origin', () => {
    // {x: 0, y: 0} is a real coordinate; returning it would put an empty group
    // at the top-left corner of the target.
    const centre = calculateGroupCentre([]);
    expect(Number.isNaN(centre.x)).toBe(true);
    expect(Number.isNaN(centre.y)).toBe(true);
  });
});

describe('calculateExtremeSpread', () => {
  it('measures the widest pair, not the first or last', () => {
    // The widest pair here is the 3-4-5 triangle's hypotenuse.
    expect(calculateExtremeSpread([poi(0, 0), poi(3, 4), poi(1, 1)])).toBeCloseTo(5, 6);
  });

  it('is zero for a single shot and for none', () => {
    expect(calculateExtremeSpread([poi(5, 5)])).toBe(0);
    expect(calculateExtremeSpread([])).toBe(0);
  });

  it('does not depend on the order the shots were marked', () => {
    const markers = [poi(0, 0), poi(3, 4), poi(1, 1), poi(2, 2)];
    const reversed = [...markers].reverse();

    expect(calculateExtremeSpread(reversed)).toBeCloseTo(calculateExtremeSpread(markers), 9);
  });
});

describe('calculateMeanRadius', () => {
  it('measures the average distance from centre', () => {
    // Four shots at distance 5 from a centre at the origin.
    const markers = [poi(5, 0), poi(-5, 0), poi(0, 5), poi(0, -5)];
    expect(calculateMeanRadius(markers)).toBeCloseTo(5, 6);
  });

  it('distinguishes a cluster-plus-flier from an even scatter of the same extreme spread', () => {
    // This is the reason mean radius exists. Extreme spread is set entirely by
    // the two worst shots and cannot tell these apart; mean radius can.
    const clusterWithFlier = [poi(0, 0), poi(1, 0), poi(0, 1), poi(1, 1), poi(20, 20)];
    const evenScatter = [poi(0, 0), poi(20, 0), poi(0, 20), poi(20, 20), poi(10, 10)];

    const spreadA = calculateExtremeSpread(clusterWithFlier);
    const spreadB = calculateExtremeSpread(evenScatter);
    expect(spreadA).toBeCloseTo(spreadB, 6); // same headline figure...

    expect(calculateMeanRadius(clusterWithFlier)).toBeLessThan(calculateMeanRadius(evenScatter));
  });

  it('is zero when every shot is in the same hole', () => {
    expect(calculateMeanRadius([poi(3, 3), poi(3, 3), poi(3, 3)])).toBe(0);
  });
});

describe('calculateCircularErrorProbable', () => {
  it('contains at least half the shots', () => {
    const markers = [poi(0, 0), poi(1, 0), poi(0, 1), poi(10, 0), poi(0, 10)];
    const centre = calculateGroupCentre(markers);
    const cep = calculateCircularErrorProbable(markers);

    const within = markers.filter(
      (m) => Math.hypot(m.x - centre.x, m.y - centre.y) <= cep + 1e-9
    ).length;

    expect(within).toBeGreaterThanOrEqual(Math.ceil(markers.length / 2));
  });

  it('degrades more gracefully than extreme spread or mean radius', () => {
    // Worth being precise about what "robust" means here, because the obvious
    // claim is wrong: CEP is NOT unaffected by a flier. It is measured from the
    // group centre, and the centre is a mean, so one wide shot moves the
    // reference point that every radius is taken from.
    //
    // What IS true is that it degrades least of the three. Measured on this
    // fixture: extreme spread grows 100x, mean radius 69x, CEP 33x. That
    // ordering is the reason to report CEP alongside extreme spread rather than
    // instead of it — and it is a property of the statistics, not of these
    // particular numbers.
    const tight = [poi(0, 0), poi(1, 0), poi(0, 1), poi(1, 1), poi(0.5, 0.5)];
    const withFlier = [...tight, poi(100, 100)];

    const growth = (f: (m: POIMarker[]) => number) => f(withFlier) / f(tight);

    expect(growth(calculateCircularErrorProbable)).toBeLessThan(growth(calculateMeanRadius));
    expect(growth(calculateMeanRadius)).toBeLessThan(growth(calculateExtremeSpread));
  });

  it('is zero for one shot, which has no dispersion to describe', () => {
    expect(calculateCircularErrorProbable([poi(4, 4)])).toBe(0);
  });
});

describe('analyseGroup', () => {
  it('reports every statistic for a known square group', () => {
    const stats = analyseGroup([poi(0, 0), poi(4, 0), poi(0, 3), poi(4, 3)]);

    expect(stats.shotCount).toBe(4);
    expect(stats.horizontalSpread).toBe(4);
    expect(stats.verticalSpread).toBe(3);
    expect(stats.centre).toEqual({ x: 2, y: 1.5 });
    expect(stats.extremeSpread).toBeCloseTo(5, 6); // the diagonal
  });

  it('keeps mean radius between zero and the extreme spread', () => {
    // A property any correct implementation has: no shot can be further from
    // the centre than the widest pair are from each other.
    const markers = [poi(0, 0), poi(7, 2), poi(3, 9), poi(1, 4), poi(6, 6)];
    const stats = analyseGroup(markers);

    expect(stats.meanRadius).toBeGreaterThan(0);
    expect(stats.meanRadius).toBeLessThanOrEqual(stats.extremeSpread);
  });

  it('handles an empty group without throwing or inventing numbers', () => {
    const stats = analyseGroup([]);

    expect(stats.shotCount).toBe(0);
    expect(stats.extremeSpread).toBe(0);
    expect(stats.horizontalSpread).toBe(0);
    expect(stats.verticalSpread).toBe(0);
    expect(Number.isNaN(stats.centre.x)).toBe(true);
  });
});

describe('analyseShotCalling', () => {
  it('pairs by shot number, not by array order', () => {
    // The arrays are deliberately in different orders. Index-pairing would
    // compare shot 1's call against shot 2's impact and report a large error
    // for a shooter who called both perfectly.
    const called = [poi(0, 0, 1), poi(10, 10, 2)];
    const actual = [poi(10, 10, 2), poi(0, 0, 1)];

    expect(analyseShotCalling(called, actual).meanError).toBeCloseTo(0, 9);
  });

  it('falls back to index order when neither side numbers its shots', () => {
    const { pairs, meanError } = analyseShotCalling([poi(0, 0)], [poi(3, 4)]);

    expect(pairs).toHaveLength(1);
    expect(meanError).toBeCloseTo(5, 6);
  });

  it('reports a larger error for worse calling', () => {
    const called = [poi(0, 0, 1), poi(0, 0, 2)];
    const good = analyseShotCalling(called, [poi(1, 0, 1), poi(0, 1, 2)]);
    const poor = analyseShotCalling(called, [poi(20, 0, 1), poi(0, 20, 2)]);

    expect(poor.meanError).toBeGreaterThan(good.meanError);
  });

  it('ignores a called shot with no matching impact', () => {
    const { pairs } = analyseShotCalling([poi(0, 0, 1), poi(5, 5, 9)], [poi(0, 0, 1)]);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].shotNumber).toBe(1);
  });

  it('returns zero error for nothing to compare rather than NaN', () => {
    expect(analyseShotCalling([], []).meanError).toBe(0);
  });
});

describe('scaleToInches', () => {
  it('converts marker space using a known reference length', () => {
    // A 6-inch scoring ring measured 300 units across, so 150 units is 3 inches.
    expect(scaleToInches(150, 6, 300)).toBeCloseTo(3, 9);
  });

  it('refuses to guess when the reference is unusable', () => {
    // Returning the unscaled value would be the dangerous option: a plausible,
    // confident, wrong number. A 0.6 MOA group reported as 6 MOA sends someone
    // to re-bed a rifle that is shooting fine.
    expect(scaleToInches(150, 0, 300)).toBeUndefined();
    expect(scaleToInches(150, 6, 0)).toBeUndefined();
    expect(scaleToInches(150, -6, 300)).toBeUndefined();
    expect(scaleToInches(150, 6, Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});

describe('toMOA', () => {
  it('uses the true minute of angle, not the 1-inch approximation', () => {
    // 1.0472" at 100yd is exactly 1 MOA. The shooter's-MOA approximation would
    // give 1.0472 here, a 4.7% error.
    expect(toMOA(1.0472, 100)).toBeCloseTo(1, 6);
  });

  it('scales with distance', () => {
    // The same physical group is a smaller angle the further out it was shot.
    expect(toMOA(2, 200)).toBeCloseTo(toMOA(1, 100)!, 6);
  });

  it('refuses a non-positive or non-finite distance', () => {
    expect(toMOA(1, 0)).toBeUndefined();
    expect(toMOA(1, -100)).toBeUndefined();
    expect(toMOA(1, Number.NaN)).toBeUndefined();
  });
});
