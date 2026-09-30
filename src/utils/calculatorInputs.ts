/**
 * Which calculator inputs the solver actually needs (#89).
 *
 * Extracted from `BallisticCalculator` so the rule is something a test can
 * assert rather than a condition buried in a screen. The rule itself is the
 * substance of #89: altitude was in the required set, blocking the solve, while
 * the solver never read it.
 *
 * Required means "the trajectory cannot be computed without it", not "we would
 * like to have it". A field the solver ignores must not stop a shooter getting
 * an answer.
 */

/** The environmental values the calculator collects. */
export interface EnvironmentalInputs {
  angle?: number;
  temperature?: number;
  pressure?: number;
  humidity?: number;
  altitude?: number;
  windSpeed?: number;
  windDirection?: number;
}

/**
 * Fields the solver genuinely needs, in the order they appear on screen.
 *
 * `altitude` is deliberately absent. `calculateAirDensity` takes temperature and
 * pressure only; with station pressure entered, the elevation is already carried
 * by the pressure, and reading altitude as well would correct for it twice.
 * It is still collected and still recorded with the shot -- it just cannot block
 * the solve.
 *
 * `humidity` is kept even though the current drag model makes little use of it:
 * unlike altitude it is a genuine atmospheric input that a future model would
 * consume, and it has a sensible default in the UI rather than being left blank.
 */
const REQUIRED_FIELDS: (keyof EnvironmentalInputs)[] = [
  'angle',
  'temperature',
  'pressure',
  'humidity',
  'windSpeed',
  'windDirection',
];

/** Human-readable names, for telling the user which field is missing. */
const FIELD_LABELS: Record<string, string> = {
  angle: 'Shooting Angle',
  temperature: 'Temperature',
  pressure: 'Station Pressure',
  humidity: 'Humidity',
  windSpeed: 'Wind Speed',
  windDirection: 'Wind Direction',
};

/**
 * The required fields that have no value, by label.
 *
 * Returns the names rather than a boolean so the message can say *which* field
 * is missing. "Please fill in all environmental parameters" on a screen with
 * seven of them is a puzzle, not an error message.
 */
export const missingEnvironmentalInputs = (values: EnvironmentalInputs): string[] =>
  REQUIRED_FIELDS.filter((field) => values[field] === undefined).map(
    (field) => FIELD_LABELS[field] ?? field
  );

/** The required fields, once they are known to be present. */
export type CompleteEnvironmentalInputs = EnvironmentalInputs &
  Required<Pick<EnvironmentalInputs, (typeof REQUIRED_FIELDS)[number]>>;

/**
 * Whether the solver has everything it needs.
 *
 * A type predicate, so the caller gets the narrowing the old inline
 * `angle === undefined || ...` chain used to provide. Without it, extracting the
 * rule would have traded a tested condition for a pile of non-null assertions
 * at the call site -- which is how a required-field change turns into a crash.
 */
export const hasRequiredEnvironmentalInputs = (
  values: EnvironmentalInputs
): values is CompleteEnvironmentalInputs => missingEnvironmentalInputs(values).length === 0;
