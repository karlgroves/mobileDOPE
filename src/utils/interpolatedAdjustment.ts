/**
 * Today's elevation, adjusted by an offset interpolated across the distances you
 * have logged (#162).
 *
 * #168 adjusts by the logs *near* the shot. When none is near enough to be
 * trusted, the logs elsewhere still describe how this rifle departs from the
 * solver, and the value at today's distance can be read off that curve.
 * `interpolateOffset` does the reading; this builds the curve it reads, decides
 * through #161's confidence how much of the result to apply, and says in plain
 * words where the number came from.
 *
 * It is the fallback, not a rival. The solution screen tries the matched
 * adjustment first and comes here only when that one was not applied -- a log
 * that was actually shot near this distance, in similar air, is better evidence
 * than a line drawn between two that were not.
 *
 * ## The curve
 *
 * One point per logged distance (rounded to the yard): the median offset of the
 * logs there, each measured against the solver *in that log's own air*, which
 * is the same reduction `compareLogsToSolver` makes for the input suggestions.
 * The median rather than the mean so that one flier at a distance does not drag
 * the whole curve between its neighbours.
 *
 * Only the two points either side of today's distance are ever built. Linear
 * interpolation reads nothing else, and predicting every log in a long history
 * to find two of them is the per-log solve #124 took out of the DOPE curve.
 *
 * Pure. The caller supplies the per-log prediction, as it does to
 * `adjustElevation`.
 */

import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_REASON,
  interpolationConfidence,
} from './adjustmentConfidence';
import { logDistanceInYards } from './distanceUnits';
import { elevationIn } from './dopeAdjustment';
import { EXTRAPOLATED_REASON, interpolateOffset } from './offsetInterpolation';

import type { AdjustmentConfidence, InterpolationSample } from './adjustmentConfidence';
import type { PredictForLog } from './dopeAdjustment';
import type { InterpolatedOffset } from './offsetInterpolation';
import type { DOPELogData } from '../models/DOPELog';

/** An interpolated adjustment, and what the screen needs to explain it. */
export interface InterpolatedAdjustment {
  /** The solver's figure, untouched. */
  solverElevation: number;
  /** `solverElevation + offset`; the solver's own figure when {@link solverOnly}. */
  adjustedElevation: number;
  /** The interpolated offset scaled by confidence, or 0 when withheld. */
  offset: number;
  /** Where the offset was read from, and how far from a log. */
  interpolation: InterpolatedOffset;
  confidence: AdjustmentConfidence;
  /** True when confidence was below the threshold. */
  solverOnly: boolean;
  /** Set only when {@link solverOnly}. */
  reason?: string;
  /** True when the value was held past the end of the logged range. */
  extrapolated: boolean;
  /** "Interpolated between your 450 and 550 yd logs" and the like. */
  caption: string;
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

/** Says where the figure came from, in the words the shooter acts on. */
const describe = ({ source, from, nearestLoggedYards }: InterpolatedOffset): string => {
  if (source === 'interpolated') {
    return `Interpolated between your ${from[0]} and ${from[1]} yd logs`;
  }
  if (source === 'extrapolated') {
    return `${EXTRAPOLATED_REASON}: nearest is ${from[0]} yd, ${nearestLoggedYards} yd away`;
  }
  return `From your logs at ${from[0]} yd`;
};

/**
 * Adjust `solverElevation` by the offset interpolated at `distanceYards`.
 *
 * `undefined` when no log yields an offset -- none for this distance, or none
 * the solver could predict -- which the caller treats as "use the solver", not
 * as an offset of zero.
 */
export const adjustByInterpolation = <T extends DOPELogData>(
  logs: T[],
  predict: PredictForLog<T>,
  distanceYards: number,
  solverElevation: number,
  unit: 'MIL' | 'MOA',
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD
): InterpolatedAdjustment | undefined => {
  if (!(distanceYards > 0)) return undefined;

  // Logs grouped by the yard they were shot at. Nothing is predicted yet.
  const logsByYards = new Map<number, T[]>();
  for (const log of logs) {
    if (!(log.distance > 0)) continue;
    const yards = Math.round(logDistanceInYards(log));
    const atYards = logsByYards.get(yards);
    if (atYards === undefined) logsByYards.set(yards, [log]);
    else atYards.push(log);
  }

  // A distance's offsets, predicted only when it is asked about. Only the
  // logged distances either side of today's are, so a long history costs the
  // logs at two distances rather than a prediction per log (#124).
  const sampled = new Map<number, InterpolationSample[]>();
  const samplesAt = (yards: number): InterpolationSample[] => {
    const cached = sampled.get(yards);
    if (cached !== undefined) return cached;
    const samples = (logsByYards.get(yards) ?? []).flatMap((log) => {
      // At the log's own distance, not the rounded one it is grouped under:
      // the same reduction the matched adjustment makes, so one log yields one
      // offset whichever path reads it. A metric log is rarely a whole yard.
      const predicted = predict(log, logDistanceInYards(log));
      return predicted === undefined || !Number.isFinite(predicted)
        ? []
        : [{ log, offset: elevationIn(log, unit) - predicted }];
    });
    sampled.set(yards, samples);
    return samples;
  };

  // Walk outward from today's distance to the nearest logged distance on each
  // side that has at least one usable offset. A distance whose every log the
  // solver could not predict says nothing, and is stepped over -- exactly what
  // `interpolateOffset` would do with the full curve, without solving it.
  const distances = [...logsByYards.keys()].sort((a, b) => a - b);
  const below = distances.filter((d) => d <= distanceYards).reverse();
  const above = distances.filter((d) => d > distanceYards);
  const lower = below.find((d) => samplesAt(d).length > 0);
  const upper = above.find((d) => samplesAt(d).length > 0);

  const curve = [lower, upper].flatMap((distance) =>
    distance === undefined
      ? []
      : [{ distance, difference: median(samplesAt(distance).map((s) => s.offset)) }]
  );

  const interpolation = interpolateOffset(curve, distanceYards);
  if (interpolation === undefined) return undefined;

  const confidence = interpolationConfidence(
    interpolation,
    interpolation.from.map((distance) => samplesAt(distance)),
    unit
  );

  const common = {
    solverElevation,
    interpolation,
    confidence,
    extrapolated: interpolation.source === 'extrapolated',
    caption: describe(interpolation),
  };

  if (confidence.score < threshold) {
    return {
      ...common,
      adjustedElevation: solverElevation,
      offset: 0,
      solverOnly: true,
      reason: LOW_CONFIDENCE_REASON,
    };
  }

  // Scaled by the score, as `applyConfidence` scales a matched offset: the
  // undamped figure times how much of it is worth believing.
  const offset = interpolation.offset * confidence.score;
  return {
    ...common,
    adjustedElevation: solverElevation + offset,
    offset,
    solverOnly: false,
  };
};
