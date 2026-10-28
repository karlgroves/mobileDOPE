/**
 * The stored settings for DOPE-assisted aiming, and their bounds (#167).
 *
 * #70 §10 asked for a settings screen. This holds the part that is neither the
 * screen nor the store: what the legal range of each value is, and what to do
 * with a stored value that falls outside it.
 *
 * ## Why the bounds are enforced here rather than at the control
 *
 * The settings are persisted to AsyncStorage as JSON, so a value can reach the
 * app from a previous version, a restored backup, or a corrupted write -- not
 * only from the slider that produced it. Two of these three feed arithmetic that
 * fails quietly rather than loudly:
 *
 * - a distance delta of 0 matches no log at all, so the shooter silently loses
 *   DOPE-assisted aiming with no indication why;
 * - a negative or NaN delta is handed to `distanceSimilarity`, whose own guard
 *   turns it into a score of 0 for every log but one;
 * - a confidence threshold above 1 can never be cleared, so the adjustment is
 *   permanently off with the reason "Confidence too low".
 *
 * None of those produce an error. They produce a correct-looking solver figure
 * and no explanation, which is the failure mode this repository has filed
 * issues about before. So the clamp lives next to the bounds, is exported, and
 * is applied on load -- `barometerOffsetInHg` already works this way.
 */

/** The distance window the matcher searches, in yards. #70 §10's range. */
export const MIN_DISTANCE_DELTA_YARDS = 25;
export const MAX_DISTANCE_DELTA_YARDS = 100;

/** Confidence below which the solver's own figure stands alone. */
export const MIN_CONFIDENCE_THRESHOLD = 0;
export const MAX_CONFIDENCE_THRESHOLD = 1;

/**
 * Whether a stored distance delta is usable.
 *
 * @param value - The stored value, of unknown provenance.
 * @returns True when it is a number inside the documented range.
 */
export const isValidDistanceDelta = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= MIN_DISTANCE_DELTA_YARDS &&
  value <= MAX_DISTANCE_DELTA_YARDS;

/**
 * Whether a stored confidence threshold is usable.
 *
 * @param value - The stored value, of unknown provenance.
 * @returns True when it is a number in [0, 1].
 */
export const isValidConfidenceThreshold = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= MIN_CONFIDENCE_THRESHOLD &&
  value <= MAX_CONFIDENCE_THRESHOLD;

/**
 * The confidence threshold as a whole percentage, for a slider and a label.
 *
 * The stored value is a fraction because that is what `applyConfidence`
 * compares against, and the screen shows a percentage because that is what the
 * confidence badge shows. Converting in one place keeps the two from disagreeing
 * about whether 0.4 is "40%" or "0.4%".
 */
export const thresholdPercent = (threshold: number): number => Math.round(threshold * 100);

/** The inverse of {@link thresholdPercent}. */
export const percentToThreshold = (percent: number): number => percent / 100;
