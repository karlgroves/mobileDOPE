/**
 * Cold-bore bias and heat shift, from the barrel state each log recorded (#165).
 *
 * Two properties of a rifle that the solver cannot model and only the shooter's
 * own history can measure:
 *
 * - **Cold-bore bias** — how much the first shot from a cold barrel departs from
 *   the warm ones. A real and well-known effect, and the one that matters most,
 *   because in the field the first shot is usually the only shot.
 * - **Heat shift** — how far the point of impact walks as a string heats the
 *   barrel, expressed as a change in offset per shot.
 *
 * ## Why both work on offsets, not on logged elevations
 *
 * Every figure here is derived from the **offset against the solver** (#168),
 * never from the raw logged elevation. That is the whole reason shots from
 * different distances can be combined at all: raw elevations at 300 and 900
 * yards differ by the entire trajectory, while their offsets are both "how much
 * the solver was wrong for me". Averaging raw elevations across distances would
 * produce a confident number built from incomparable inputs — and it would look
 * exactly like a correct one.
 *
 * ## Why each half refuses to answer
 *
 * A cold-bore bias from a single cold shot is one group's luck presented as a
 * property of the rifle, and a shooter who dials it is worse off than one who
 * dials nothing. So each half has a minimum that is defined here and tested, and
 * returns `undefined` below it rather than a weakly-supported number. #165 asks
 * for exactly that: "each needs a minimum amount of data (define it and test
 * it), and nothing is shown without it".
 *
 * Pure. No store, no solver — the caller supplies offsets.
 */

/** One log reduced to what barrel-state analysis reads. */
export interface BarrelStateSample {
  /** Logged minus solver-predicted, in the working unit (#168). */
  offset: number;
  /**
   * Whether the shot was a cold bore.
   *
   * `undefined` means nobody recorded it, which migration 007 deliberately
   * preserves as distinct from `false` (#164). It is never read as a cold bore
   * — only an explicit `true` is — but see {@link coldBoreShot} handling in the
   * warm set, which keys off position rather than this flag.
   */
  coldBoreShot?: boolean;
  /** Position in the day's string, 1-based. `undefined` when unrecorded. */
  shotNumberInSession?: number;
}

/** First and last shot of a string that still count as "warm" (#165). */
export const WARM_SHOT_MIN = 2;
export const WARM_SHOT_MAX = 5;

/**
 * Cold and warm samples each needed before a bias is reported.
 *
 * Three, so that a bias rests on more than a pair in either direction. It is a
 * deliberately low bar — a shooter will not have fifty cold-bore shots — but it
 * is above the one-sample case that makes the figure meaningless.
 */
export const MIN_BIAS_SAMPLES = 3;

/** Positioned shots needed before a heat shift is reported. */
export const MIN_HEAT_SHIFT_SHOTS = 6;

/**
 * Distinct shot positions needed before a slope is reported.
 *
 * Three, because two distinct positions make a perfect line through two means.
 * That looks like a confident slope and is not one — there is no residual left
 * to disagree with it.
 */
export const MIN_HEAT_SHIFT_SPREAD = 3;

/** Below this the shift is not stated as a direction (see `describeColdBoreShift`). */
const SHIFT_PRINT_PRECISION = 2;

/** How much the first shot from a cold barrel departs from the warm ones. */
export interface ColdBoreBias {
  /** Cold mean minus warm mean, in the working unit. Positive = dialled more. */
  bias: number;
  coldSamples: number;
  warmSamples: number;
}

/** How far the offset walks per shot as a string heats the barrel. */
export interface HeatShift {
  /** Change in offset per shot, in the working unit. */
  perShot: number;
  /** How many positioned shots the slope was fitted to. */
  shots: number;
}

/** What the history can and cannot say about barrel state. */
export interface BarrelStateAnalysis {
  /** `undefined` when there is not enough cold *and* warm data. */
  coldBore: ColdBoreBias | undefined;
  /** `undefined` when there are too few shots, or too few distinct positions. */
  heatShift: HeatShift | undefined;
}

const mean = (values: number[]): number => values.reduce((sum, v) => sum + v, 0) / values.length;

/** Samples whose offset is a usable number. */
const withUsableOffset = (samples: BarrelStateSample[]): BarrelStateSample[] =>
  samples.filter((s) => Number.isFinite(s.offset));

/**
 * Cold mean minus warm mean, or `undefined` when either side is too thin.
 *
 * "Warm" is a *position*, not the absence of cold: shots {@link WARM_SHOT_MIN}
 * to {@link WARM_SHOT_MAX} of a string, which is #165's own definition. A log
 * flagged `coldBoreShot: false` with no shot number does not qualify — it says
 * the barrel was not cold, but not whether it was warm or twenty rounds hot, and
 * a hot baseline would absorb the very heat shift the other half measures.
 *
 * Because the definition is positional, a shot at position 2–5 whose cold/warm
 * flag was **never recorded** does count as warm: its position already says what
 * the flag would have. Only an explicit `coldBoreShot: true` excludes it. That
 * asymmetry is deliberate — `undefined` is never read *as a cold bore*, but it
 * does not disqualify an otherwise-warm position either, and a mutation test
 * pins it (changing this to `=== false` must fail a test).
 */
const coldBoreBias = (samples: BarrelStateSample[]): ColdBoreBias | undefined => {
  const cold = samples.filter((s) => s.coldBoreShot === true).map((s) => s.offset);

  const warm = samples
    .filter(
      (s) =>
        s.coldBoreShot !== true &&
        s.shotNumberInSession !== undefined &&
        s.shotNumberInSession >= WARM_SHOT_MIN &&
        s.shotNumberInSession <= WARM_SHOT_MAX
    )
    .map((s) => s.offset);

  if (cold.length < MIN_BIAS_SAMPLES || warm.length < MIN_BIAS_SAMPLES) return undefined;

  return {
    bias: mean(cold) - mean(warm),
    coldSamples: cold.length,
    warmSamples: warm.length,
  };
};

/**
 * Least-squares slope of offset against shot number, or `undefined`.
 *
 * Every positioned shot counts, not only those inside the warm window — the
 * whole point is how the offset moves as the string goes on, so shot 18 is the
 * most informative sample there is.
 */
const heatShift = (samples: BarrelStateSample[]): HeatShift | undefined => {
  const positioned = samples.filter(
    (s) => s.shotNumberInSession !== undefined && Number.isFinite(s.shotNumberInSession)
  );

  if (positioned.length < MIN_HEAT_SHIFT_SHOTS) return undefined;

  const xs = positioned.map((s) => s.shotNumberInSession as number);
  const ys = positioned.map((s) => s.offset);

  if (new Set(xs).size < MIN_HEAT_SHIFT_SPREAD) return undefined;

  const xMean = mean(xs);
  const yMean = mean(ys);

  const covariance = xs.reduce((sum, x, i) => sum + (x - xMean) * (ys[i] - yMean), 0);
  const variance = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);

  // Guarded even though the distinct-x check above already rules it out: a
  // slope of NaN reads on screen as a blank rather than as a failure, and this
  // module's entire purpose is to refuse rather than to guess.
  if (!(variance > 0)) return undefined;

  return { perShot: covariance / variance, shots: positioned.length };
};

/** What the shooter's barrel-state history supports, and what it does not. */
export const analyseBarrelState = (samples: BarrelStateSample[]): BarrelStateAnalysis => {
  const usable = withUsableOffset(samples);

  return {
    coldBore: coldBoreBias(usable),
    heatShift: heatShift(usable),
  };
};

/**
 * "Expected cold-bore shift: 0.15 MIL low", in the issue's own words.
 *
 * A positive bias means more elevation was dialled on cold shots, which is to
 * say the shot landed **low** — so that is how it is described, in terms of
 * where the bullet goes rather than which way the turret turns. A shooter reads
 * a point of impact, not a sign convention.
 *
 * A bias that rounds away to nothing at the printed precision is reported as no
 * measurable shift, rather than as "0.00 MIL low" — which would claim a
 * direction the figure does not support at the precision being shown.
 */
export const describeColdBoreShift = (bias: ColdBoreBias, unit: 'MIL' | 'MOA'): string => {
  const magnitude = Math.abs(bias.bias);
  const printed = magnitude.toFixed(SHIFT_PRINT_PRECISION);

  if (Number.parseFloat(printed) === 0) {
    return 'No measurable cold-bore shift';
  }

  return `Expected cold-bore shift: ${printed} ${unit} ${bias.bias > 0 ? 'low' : 'high'}`;
};
