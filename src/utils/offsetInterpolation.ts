/**
 * The offset at a distance you have not logged (#162).
 *
 * #168 derives a correction from logs near the shot in front of you. When
 * nothing is near it, there is still something to say: the offsets you *have*
 * measured describe a curve, and the value between two of them can be filled in.
 *
 * **The offset is interpolated, never the raw logged elevation.** The solver
 * already supplies the shape of the drop curve; only this rifle's departure from
 * it has to be guessed at. That is a far smaller and far safer thing to
 * interpolate than a trajectory, and it is why #70 §3's α-blend of splined raw
 * DOPE against the solver is not implemented — splining raw elevations would
 * reinvent the trajectory the solver already computes, and then blend two
 * answers to the same question.
 *
 * ## Linear, not a spline
 *
 * #162 asks for linear interpolation between the nearest logged distances either
 * side, with a cubic spline only if tests show it better on real data. Linear is
 * what this does. A spline through three or four sparse points invents curvature
 * between them that no measurement supports, and overshoots: a cubic through
 * offsets of 0.2, 0.25 and 0.9 will dip *below* 0.2 before rising. The offset
 * curve is also much flatter than the drop curve it corrects — it is scope and
 * velocity error, not ballistics — so there is little curvature for a spline to
 * capture in the first place.
 *
 * ## Past the ends: hold, do not decay
 *
 * Two answers are defensible outside the logged range. This holds the nearest
 * end's offset and marks the result `extrapolated`.
 *
 * Decaying toward zero would need a decay *rate* — a second invented number on
 * top of an already unevidenced one. And the offset is not noise to be faded out:
 * it is a measured departure from the solver for this rifle and load, from a
 * muzzle velocity that is slightly off, a scope that does not track exactly 0.1
 * MIL per click, or a BC that is optimistic downrange. None of those stop
 * applying past the last log, and the BC one gets worse. Decaying to zero would
 * assert that the solver becomes correct again out there, which is the opposite
 * of what is likely.
 *
 * What *should* shrink past the last log is how much the figure is trusted, and
 * that already happens elsewhere: #161's `proximity` factor is a Gaussian on the
 * gap to the nearest log, so an extrapolated value is damped exactly once, in the
 * module that owns trust. Decaying the offset here as well would damp it twice —
 * the same error as stacking #161's confidence on top of #168's `trust`, which
 * that work deliberately avoided.
 */

/** A measured offset at a distance, as `compareLogsToSolver` produces it. */
export interface OffsetPoint {
  /** Yards. */
  distance: number;
  /** Logged minus solver-predicted, in the working unit. */
  difference: number;
}

/** Where a returned offset came from. */
export type OffsetSource = 'logged' | 'interpolated' | 'extrapolated';

/** An offset for one distance, and how much of it was measured. */
export interface InterpolatedOffset {
  /** The offset to apply, in the working unit. */
  offset: number;
  source: OffsetSource;
  /** Yards from the distance asked about to the nearest distance with logs. */
  nearestLoggedYards: number;
  /** The logged distances the value was drawn from, in ascending order. */
  from: number[];
}

/** Shown when the value was held past the end of the logged range. */
export const EXTRAPOLATED_REASON = 'Extrapolated beyond your logged distances';

/**
 * Within this many yards, a request is the same distance as a logged one.
 *
 * The curve's distances are rounded to whole yards upstream, so anything inside
 * half a yard is the same shot rather than something to interpolate across.
 */
const SAME_DISTANCE_YARDS = 0.5;

/** The curve, sorted, finite, and with one entry per distance. */
const usablePoints = (curve: OffsetPoint[]): OffsetPoint[] => {
  const byDistance = new Map<number, OffsetPoint>();

  for (const point of curve) {
    // A non-finite offset is a solve that went wrong, and a non-positive
    // distance is not a shot. Either would poison the linear term with a NaN,
    // which the shooter reads as a blank adjustment rather than as a failure.
    if (!Number.isFinite(point.difference) || !(point.distance > 0)) continue;
    // Last writer wins on a duplicate distance: two points at the same x make
    // the interpolation's denominator zero.
    byDistance.set(point.distance, point);
  }

  return [...byDistance.values()].sort((a, b) => a.distance - b.distance);
};

/**
 * The offset to apply at `distanceYards`, from the offsets already measured.
 *
 * `undefined` when there is nothing usable to draw on — which the caller must
 * treat as "fall back to the solver", not as an offset of zero. Zero is a claim
 * that the solver is right here, and an empty history does not support it.
 */
export const interpolateOffset = (
  curve: OffsetPoint[],
  distanceYards: number
): InterpolatedOffset | undefined => {
  if (!(distanceYards > 0)) return undefined;

  const points = usablePoints(curve);
  if (points.length === 0) return undefined;

  const exact = points.find((p) => Math.abs(p.distance - distanceYards) <= SAME_DISTANCE_YARDS);
  if (exact !== undefined) {
    return {
      offset: exact.difference,
      source: 'logged',
      nearestLoggedYards: 0,
      from: [exact.distance],
    };
  }

  const first = points[0];
  const last = points[points.length - 1];

  // Past either end there is no second point to lean toward, so the nearest
  // measurement is held. See "Past the ends" above for why it is not decayed.
  if (distanceYards < first.distance) {
    return {
      offset: first.difference,
      source: 'extrapolated',
      nearestLoggedYards: Math.round(first.distance - distanceYards),
      from: [first.distance],
    };
  }
  if (distanceYards > last.distance) {
    return {
      offset: last.difference,
      source: 'extrapolated',
      nearestLoggedYards: Math.round(distanceYards - last.distance),
      from: [last.distance],
    };
  }

  const above = points.findIndex((p) => p.distance > distanceYards);
  const lower = points[above - 1];
  const upper = points[above];

  const span = upper.distance - lower.distance;
  const along = (distanceYards - lower.distance) / span;

  return {
    offset: lower.difference + along * (upper.difference - lower.difference),
    source: 'interpolated',
    nearestLoggedYards: Math.round(
      Math.min(distanceYards - lower.distance, upper.distance - distanceYards)
    ),
    from: [lower.distance, upper.distance],
  };
};

/**
 * Gaps narrower than this are close enough to interpolate across; wider ones are
 * worth a practice session.
 *
 * Lives here rather than in `DopeCoverage`, which used to own it, because the
 * solution screen's interpolation now reads it too (#162): the distance the
 * coverage summary calls "close enough to interpolate between" and the distance
 * over which an interpolated offset keeps its confidence are the same claim, and
 * two constants for one claim is how they come to disagree.
 */
export const COVERAGE_TOLERANCE_YARDS = 150;

/** A stretch of distance with no logged DOPE in it. */
export interface CoverageGap {
  /** The logged distance below the gap, in yards. */
  from: number;
  /** The logged distance above it. */
  to: number;
  /** `to − from`. */
  span: number;
}

/**
 * The stretches between logged distances wide enough to be worth practising.
 *
 * #162 asks which distances for this rifle and ammo have logs and which gaps are
 * worth filling. The logged distances are the curve's own x values; this reports
 * the holes between them, so the shooter is told where to go and shoot rather
 * than only that a recommendation was interpolated.
 *
 * A gap is only reported when it is wider than `toleranceYards` — inside that,
 * interpolating between neighbours is sound and there is nothing to practise.
 *
 * Takes anything carrying a `distance`, because the two callers hold different
 * shapes: the solution screen has an offset curve, and the DOPE Curve screen has
 * `DropCurvePoint`s whose second field is a correction rather than a difference.
 * Only the x values matter here, and widening the parameter is honest about that
 * — passing a correction as a `difference` to satisfy a type would not be.
 */
export const coverageGaps = (
  points: { distance: number }[],
  toleranceYards: number
): CoverageGap[] => {
  const distances = [...new Set(points.map((p) => p.distance).filter((d) => d > 0))].sort(
    (a, b) => a - b
  );

  return distances.slice(1).flatMap((distance, index) => {
    const previous = distances[index];
    const span = distance - previous;
    return span > toleranceYards ? [{ from: previous, to: distance, span }] : [];
  });
};
