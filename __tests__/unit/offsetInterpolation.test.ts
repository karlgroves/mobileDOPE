import {
  EXTRAPOLATED_REASON,
  coverageGaps,
  interpolateOffset,
} from '../../src/utils/offsetInterpolation';

/**
 * Filling in the offset at distances with no logs near them (#162).
 *
 * The *offset* is interpolated, never the raw logged elevation. The solver
 * already supplies the shape of the drop curve; only the correction between
 * logged distances has to be filled in, which is a much smaller and much
 * safer thing to guess at than a trajectory.
 *
 * The point with teeth is the boundary: past the furthest log there is no
 * evidence at all, and the tests below pin which of the two defensible
 * answers was chosen and why.
 */

/** A point on the offset curve, as `compareLogsToSolver` produces it. */
const at = (distance: number, difference: number) => ({ distance, difference });

describe('interpolateOffset (#162)', () => {
  describe('with nothing to go on', () => {
    it('returns undefined for an empty curve rather than an offset of zero', () => {
      // Zero is a claim -- "the solver is right here" -- and an empty history
      // does not support it. The caller must fall back to the solver knowingly.
      expect(interpolateOffset([], 500)).toBeUndefined();
    });

    it('returns undefined for a distance that is not a usable number', () => {
      expect(interpolateOffset([at(500, 0.3)], Number.NaN)).toBeUndefined();
      expect(interpolateOffset([at(500, 0.3)], 0)).toBeUndefined();
      expect(interpolateOffset([at(500, 0.3)], -100)).toBeUndefined();
    });
  });

  describe('at a distance that has logs', () => {
    it('uses the logged offset and says so', () => {
      const result = interpolateOffset([at(300, 0.2), at(500, 0.4)], 500);

      expect(result).toEqual({
        offset: 0.4,
        source: 'logged',
        nearestLoggedYards: 0,
        from: [500],
      });
    });

    it('treats a sub-yard difference as the same distance', () => {
      // The curve's distances are rounded to whole yards upstream, so a
      // request at 500.4 is the same shot as a log at 500.
      expect(interpolateOffset([at(500, 0.4)], 500.4)?.source).toBe('logged');
    });
  });

  describe('between two logged distances', () => {
    it('interpolates linearly and names both ends', () => {
      const result = interpolateOffset([at(400, 0.2), at(600, 0.6)], 500);

      expect(result).toEqual({
        offset: expect.closeTo(0.4, 10),
        source: 'interpolated',
        nearestLoggedYards: 100,
        from: [400, 600],
      });
    });

    it('lands proportionally, not at the midpoint', () => {
      // 450 is a quarter of the way from 400 to 600, so the offset is a
      // quarter of the way from 0.2 to 0.6.
      expect(interpolateOffset([at(400, 0.2), at(600, 0.6)], 450)?.offset).toBeCloseTo(0.3, 10);
    });

    it('brackets with the immediate neighbours, not the outermost pair', () => {
      const curve = [at(200, 0), at(400, 0.2), at(600, 0.6), at(800, 2)];

      const result = interpolateOffset(curve, 500);

      expect(result?.from).toEqual([400, 600]);
      expect(result?.offset).toBeCloseTo(0.4, 10);
    });

    it('reports the distance to the nearer end, not to both', () => {
      expect(interpolateOffset([at(400, 0.2), at(600, 0.6)], 420)?.nearestLoggedYards).toBe(20);
      expect(interpolateOffset([at(400, 0.2), at(600, 0.6)], 580)?.nearestLoggedYards).toBe(20);
    });

    it('handles an unsorted curve', () => {
      // `compareLogsToSolver` sorts, but this is exported and a caller that
      // builds a curve by hand should not get a silently wrong answer.
      const result = interpolateOffset([at(600, 0.6), at(200, 0), at(400, 0.2)], 500);

      expect(result?.from).toEqual([400, 600]);
      expect(result?.offset).toBeCloseTo(0.4, 10);
    });
  });

  describe('outside the logged range', () => {
    /**
     * The documented decision, and the reason the alternative was rejected.
     *
     * Two answers are defensible past the last log: hold the nearest end's
     * offset, or decay it toward zero so the solver takes over. **Hold** is
     * what this implements.
     *
     * Decaying would need a decay *rate*, which is a second invented number on
     * top of an already unevidenced one -- and the offset is not noise. It is
     * this rifle's measured departure from the solver: a muzzle velocity that
     * is slightly off, a scope that does not track exactly 0.1 MIL per click,
     * a BC that is optimistic downrange. None of those stop applying past 600
     * yards; the BC one gets worse. Decaying to zero asserts the solver
     * becomes right again out there, which is the opposite of what is likely.
     *
     * The thing that *should* shrink is how much the figure is trusted, and
     * that already happens: #161's proximity factor is a Gaussian on the gap
     * to the nearest log, so an extrapolated value is damped exactly once, in
     * the module that owns trust. Decaying the offset here as well would damp
     * it twice -- the same mistake as stacking #161's confidence on #168's
     * `trust`, which that work deliberately avoided.
     */
    it('holds the nearest end rather than decaying toward zero', () => {
      const curve = [at(400, 0.2), at(600, 0.6)];

      expect(interpolateOffset(curve, 900)?.offset).toBe(0.6);
      expect(interpolateOffset(curve, 100)?.offset).toBe(0.2);
    });

    it('marks it extrapolated so the UI can warn', () => {
      const result = interpolateOffset([at(400, 0.2), at(600, 0.6)], 900);

      expect(result?.source).toBe('extrapolated');
      expect(result?.from).toEqual([600]);
      expect(result?.nearestLoggedYards).toBe(300);
      expect(EXTRAPOLATED_REASON).toMatch(/extrapolat/i);
    });

    it('does not pretend the held value came from the distance asked about', () => {
      // `nearestLoggedYards` is what #161 reads. Reporting 0 here would make
      // an extrapolation 300 yards out look as well-supported as a direct hit.
      expect(interpolateOffset([at(600, 0.6)], 900)?.nearestLoggedYards).toBe(300);
    });
  });

  describe('with a single logged distance', () => {
    it('uses it at that distance', () => {
      expect(interpolateOffset([at(500, 0.4)], 500)).toEqual({
        offset: 0.4,
        source: 'logged',
        nearestLoggedYards: 0,
        from: [500],
      });
    });

    it('holds it everywhere else, marked extrapolated in both directions', () => {
      // One point cannot describe a slope, so there is nothing to interpolate
      // along -- every other distance is an extrapolation from it, near or far.
      const near = interpolateOffset([at(500, 0.4)], 520);
      const far = interpolateOffset([at(500, 0.4)], 200);

      expect(near).toMatchObject({ offset: 0.4, source: 'extrapolated', nearestLoggedYards: 20 });
      expect(far).toMatchObject({ offset: 0.4, source: 'extrapolated', nearestLoggedYards: 300 });
    });
  });

  describe('degenerate curves', () => {
    it('ignores points that carry an unusable offset', () => {
      const result = interpolateOffset(
        [at(400, Number.NaN), at(500, 0.4), at(600, Number.POSITIVE_INFINITY)],
        500
      );

      expect(result).toMatchObject({ offset: 0.4, source: 'logged' });
    });

    it('returns undefined when every point is unusable', () => {
      expect(interpolateOffset([at(400, Number.NaN)], 500)).toBeUndefined();
    });

    it('does not divide by zero on duplicate distances', () => {
      // Two points at the same distance would make the linear term 0/0. The
      // curve is deduplicated upstream, but a NaN offset here would read as a
      // blank adjustment rather than as a failure.
      const result = interpolateOffset([at(500, 0.4), at(500, 0.6), at(700, 1)], 600);

      expect(Number.isFinite(result?.offset ?? Number.NaN)).toBe(true);
    });
  });
});

describe('coverageGaps (#162)', () => {
  it('finds the stretches between logged distances worth practising', () => {
    const gaps = coverageGaps([at(100, 0), at(200, 0.1), at(600, 0.6)], 150);

    // 100→200 is inside the tolerance; 200→600 is not.
    expect(gaps).toEqual([{ from: 200, to: 600, span: 400 }]);
  });

  it('is empty when every neighbouring pair is close enough', () => {
    expect(coverageGaps([at(100, 0), at(200, 0.1), at(300, 0.2)], 150)).toEqual([]);
  });

  it('needs two points before it can describe a gap', () => {
    expect(coverageGaps([at(500, 0.4)], 100)).toEqual([]);
    expect(coverageGaps([], 100)).toEqual([]);
  });

  it('sorts and deduplicates before measuring, so a gap is never negative', () => {
    const gaps = coverageGaps([at(600, 0.6), at(100, 0), at(600, 0.7)], 150);

    expect(gaps).toEqual([{ from: 100, to: 600, span: 500 }]);
  });
});
