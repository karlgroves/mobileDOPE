/**
 * The distances the distance selectors offer (#227).
 *
 * The Start Session, active session and Ballistic Calculator distance pickers
 * list `settings.distancePresets`. They used to ship as 100 to 1000 in 100-yard
 * steps, which left no way to pick 325 or 650 without first adding it as a
 * preset in Settings. The shipped list is now 100 to 1000 in 25-yard steps.
 *
 * The numbers carry no unit of their own: the calculator labels them in its
 * current distance unit, so in meters the same list is 100 to 1000 in 25-meter
 * steps.
 */

const STEP = 25;
const FIRST = 100;
const LAST = 1000;

export const DEFAULT_DISTANCE_PRESETS: number[] = Array.from(
  { length: (LAST - FIRST) / STEP + 1 },
  (_, i) => FIRST + i * STEP
);

/** The list every install shipped with before #227. */
const PREVIOUS_DEFAULT_PRESETS: readonly number[] = [
  100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
];

const sameList = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * The presets to use for a stored list.
 *
 * `updateSettings` saves the whole settings object, so anyone who changed any
 * setting has the old default list stored too, without ever having chosen it.
 * A stored list that is exactly the old default is therefore read as "never
 * customised" and moves to the new default. Any other list is the shooter's own
 * and is kept. Anything that is not a list of numbers falls back to the default.
 */
export function upgradeDistancePresets(stored: unknown): number[] {
  if (
    !Array.isArray(stored) ||
    stored.length === 0 ||
    !stored.every((v) => typeof v === 'number' && Number.isFinite(v))
  ) {
    return [...DEFAULT_DISTANCE_PRESETS];
  }
  const presets = stored as number[];
  return sameList(presets, PREVIOUS_DEFAULT_PRESETS) ? [...DEFAULT_DISTANCE_PRESETS] : presets;
}
