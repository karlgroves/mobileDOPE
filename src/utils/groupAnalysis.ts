/**
 * Group statistics from marked points of impact (#63, Group analysis).
 *
 * `CLAUDE.md` names "target marking with group size calculation" as an MVP
 * feature. This is the maths half: pure functions over `POIMarker[]`, with no
 * image handling, no gestures and no screen. The viewer, tap-to-mark and
 * pinch-zoom are separate work; these are what that UI will call, and they are
 * testable now without any of it.
 *
 * ## Units
 *
 * Every function works in whatever unit the markers are in and returns the same
 * unit. Callers marking on an image in pixels get pixels back; callers who have
 * already scaled to inches get inches. Nothing here assumes a scale, because
 * only the caller knows the target's real size — and silently assuming one is
 * how a group measured on a phone screen ends up reported as a 40-inch group.
 *
 * `scaleToInches` is provided for the conversion so the assumption has to be
 * made explicitly, in one place, with a known reference length.
 */

import type { POIMarker } from '../models/TargetImage';

/** Everything the group statistics produce, in the markers' own unit. */
export interface GroupStatistics {
  /** Largest centre-to-centre distance between any two shots. */
  extremeSpread: number;
  /** Arithmetic centre of the group. */
  centre: { x: number; y: number };
  /** Widest horizontal separation. */
  horizontalSpread: number;
  /** Widest vertical separation. */
  verticalSpread: number;
  /** Average distance from the group centre. */
  meanRadius: number;
  /** Radius containing half the shots, measured from the centre. */
  circularErrorProbable: number;
  /** How many markers contributed. */
  shotCount: number;
}

const distance = (a: POIMarker, b: POIMarker): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Group centre: the mean of the marked positions.
 *
 * The mean, not the median, and deliberately so — unlike the DOPE analysis in
 * `dopeAnalysis.ts`, a flier here is real data. A shot that went wide still came
 * out of the barrel, and a centre that ignored it would misrepresent where the
 * rifle is actually shooting. Robustness is the right default when filtering
 * mis-keyed entries; it is the wrong one when every value is a genuine
 * observation.
 */
export const calculateGroupCentre = (markers: POIMarker[]): { x: number; y: number } => {
  if (markers.length === 0) return { x: NaN, y: NaN };
  const sum = markers.reduce((a, m) => ({ x: a.x + m.x, y: a.y + m.y }), { x: 0, y: 0 });
  return { x: sum.x / markers.length, y: sum.y / markers.length };
};

/**
 * Extreme spread: the largest centre-to-centre distance between any two shots.
 *
 * The conventional way shooters quote a group, and it is worth being precise
 * that this is CENTRE to centre, not edge to edge. A caller wanting the
 * edge-to-edge figure people sometimes read off a ruler adds one bullet
 * diameter; doing that here would bake in a calibre this module does not know.
 */
export const calculateExtremeSpread = (markers: POIMarker[]): number => {
  if (markers.length < 2) return 0;
  let widest = 0;
  for (let i = 0; i < markers.length; i++) {
    for (let j = i + 1; j < markers.length; j++) {
      widest = Math.max(widest, distance(markers[i], markers[j]));
    }
  }
  return widest;
};

/**
 * Mean radius: average distance from the group centre.
 *
 * A better measure of practical accuracy than extreme spread for anything past
 * three shots, because extreme spread is determined entirely by the two worst
 * shots and throws away everything the rest tell you. Two groups can share an
 * extreme spread while one is a tight cluster with a single flier and the other
 * is evenly scattered.
 */
export const calculateMeanRadius = (markers: POIMarker[]): number => {
  if (markers.length === 0) return 0;
  const centre = calculateGroupCentre(markers);
  return markers.reduce((a, m) => a + distance(m, centre), 0) / markers.length;
};

/**
 * Circular error probable: the radius containing half the shots.
 *
 * Computed empirically — the median distance from the centre — rather than from
 * a closed-form estimate like 1.1774σ. The formula assumes a circular bivariate
 * normal distribution, and real groups are frequently neither circular (vertical
 * stringing from velocity spread) nor normal (a called flier). Taking the median
 * of the actual radii makes no distributional assumption and degrades gracefully
 * when one does not hold.
 *
 * With an even number of shots this interpolates between the two middle radii,
 * which is the usual median convention.
 */
export const calculateCircularErrorProbable = (markers: POIMarker[]): number => {
  if (markers.length === 0) return 0;
  const centre = calculateGroupCentre(markers);
  const radii = markers.map((m) => distance(m, centre)).sort((a, b) => a - b);
  const mid = Math.floor(radii.length / 2);
  return radii.length % 2 === 0 ? (radii[mid - 1] + radii[mid]) / 2 : radii[mid];
};

/** Every statistic in one pass. */
export const analyseGroup = (markers: POIMarker[]): GroupStatistics => {
  const xs = markers.map((m) => m.x);
  const ys = markers.map((m) => m.y);

  return {
    extremeSpread: calculateExtremeSpread(markers),
    centre: calculateGroupCentre(markers),
    horizontalSpread: markers.length === 0 ? 0 : Math.max(...xs) - Math.min(...xs),
    verticalSpread: markers.length === 0 ? 0 : Math.max(...ys) - Math.min(...ys),
    meanRadius: calculateMeanRadius(markers),
    circularErrorProbable: calculateCircularErrorProbable(markers),
    shotCount: markers.length,
  };
};

/**
 * How close a called shot was to where it actually landed.
 *
 * "Shot calling" is the shooter predicting, from what the sight picture looked
 * like at the break, where the round will land. It is the skill that separates a
 * rifle problem from a shooter problem: a called flier is a known error, an
 * uncalled one is not.
 *
 * Returns the distance between each called and actual position, and the mean —
 * the smaller the mean, the better the shooter is reading their own shots.
 *
 * Pairs by `shotNumber` where both sides have one, because the arrays are not
 * necessarily in the same order and index-pairing would silently compare
 * unrelated shots. Falls back to index order only when neither side numbers its
 * markers.
 */
export const analyseShotCalling = (
  called: POIMarker[],
  actual: POIMarker[]
): { pairs: { shotNumber?: number; error: number }[]; meanError: number } => {
  const numbered =
    called.every((m) => m.shotNumber !== undefined) &&
    actual.every((m) => m.shotNumber !== undefined);

  const pairs: { shotNumber?: number; error: number }[] = [];

  if (numbered) {
    const actualByShot = new Map(actual.map((m) => [m.shotNumber, m]));
    for (const call of called) {
      const match = actualByShot.get(call.shotNumber);
      if (match) pairs.push({ shotNumber: call.shotNumber, error: distance(call, match) });
    }
  } else {
    for (let i = 0; i < Math.min(called.length, actual.length); i++) {
      pairs.push({ shotNumber: called[i].shotNumber, error: distance(called[i], actual[i]) });
    }
  }

  const meanError = pairs.length === 0 ? 0 : pairs.reduce((a, p) => a + p.error, 0) / pairs.length;

  return { pairs, meanError };
};

/**
 * Converts marker-space measurements to inches using a known reference length.
 *
 * `referenceLength` is a real distance on the target — the width of a scoring
 * ring, the diagonal of the sheet — and `referencePixels` is that same distance
 * measured in marker space. Both come from the caller because only the caller
 * knows which target is in the photograph.
 *
 * Returns undefined rather than guessing when the reference is unusable. A
 * silently wrong scale is the worst failure mode available here: it produces a
 * confident, plausible, wrong number, and a 0.6 MOA group reported as 6 MOA
 * sends someone to re-bed a rifle that is shooting fine.
 */
export const scaleToInches = (
  value: number,
  referenceLength: number,
  referencePixels: number
): number | undefined => {
  if (referenceLength <= 0 || referencePixels <= 0) return undefined;
  if (!Number.isFinite(referenceLength) || !Number.isFinite(referencePixels)) return undefined;
  return value * (referenceLength / referencePixels);
};

/**
 * Group size in MOA, from a size in inches and the distance it was shot at.
 *
 * Uses the true minute of angle — 1.0472 inches per 100 yards — rather than the
 * "shooter's MOA" approximation of exactly 1 inch. The difference is 4.7%, which
 * is invisible on a 100-yard group and is a quarter-inch at 500.
 */
export const toMOA = (inches: number, distanceYards: number): number | undefined => {
  if (distanceYards <= 0 || !Number.isFinite(distanceYards)) return undefined;
  return inches / (1.0472 * (distanceYards / 100));
};
