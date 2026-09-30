/**
 * Comparing the conditions between range sessions (#62).
 *
 * The question a shooter actually asks is "why did today not match my DOPE?",
 * and the answer is usually that the air was different. Every log since
 * environment snapshots landed carries the data to answer it. Nothing reads it
 * back.
 *
 * ## Why this reports one number and not seven
 *
 * Temperature, pressure, humidity and altitude all changed between any two
 * sessions. Listing four deltas is not an answer — it is the raw data again,
 * and it leaves the shooter to work out which of them mattered.
 *
 * Density altitude is the one the trajectory responds to, and it is exactly the
 * combination of the others. So that is the headline, with the individual
 * readings kept alongside to explain where it came from rather than to be
 * interpreted independently.
 *
 * Wind is deliberately NOT folded in. It does not change the drop; it changes
 * the windage. A combined "conditions differ by X" figure that included wind
 * would have a shooter adjusting elevation for a crosswind.
 *
 * Pure — no store, no database.
 */

import { calculateDensityAltitude } from './atmospheric';

/** The readings a comparison needs. A subset of `EnvironmentSnapshotData`. */
export interface ComparableConditions {
  temperature: number;
  pressure: number;
  humidity?: number;
  altitude: number;
  densityAltitude?: number;
  windSpeed?: number;
  windDirection?: number;
}

/** One side of a comparison, with the density altitude resolved. */
export interface ConditionsSummary {
  densityAltitude?: number;
  temperature?: number;
  pressure?: number;
  windSpeed?: number;
}

/**
 * How much thinner or denser the air got, and how much of everything else moved.
 *
 * Deltas are `later - earlier`, so a positive density-altitude delta means the
 * air got thinner. Undefined where a side had nothing to compare.
 */
export interface EnvironmentDelta {
  densityAltitudeDelta?: number;
  temperatureDelta?: number;
  pressureDelta?: number;
  windSpeedDelta?: number;
  direction: 'thinner' | 'denser' | 'same' | 'unknown';
  /** Whether the change is large enough to be worth the shooter's attention. */
  significant: boolean;
}

/**
 * Density altitude difference, in feet, at which a change is worth mentioning.
 *
 * Below this the trajectory difference is inside the spread of a decent group at
 * any distance a shooter is dialling for, so calling it out would be noise —
 * and a flag that fires on every pair of sessions is a flag nobody reads.
 */
const SIGNIFICANT_DENSITY_ALTITUDE_FT = 500;

/** Wind speed change, in mph, worth mentioning on its own. */
const SIGNIFICANT_WIND_MPH = 5;

/**
 * The density altitude for a set of conditions.
 *
 * Prefers the stored figure: it is what the shooter saw at the time. Derives one
 * otherwise, because snapshots written before the field existed still carry the
 * inputs, and refusing to compare them would exclude exactly the older sessions
 * someone wants to look back at.
 */
export const summariseConditions = (
  conditions: ComparableConditions | undefined
): ConditionsSummary => {
  if (!conditions) return {};

  return {
    densityAltitude:
      conditions.densityAltitude ??
      calculateDensityAltitude(conditions.temperature, conditions.pressure, conditions.altitude),
    temperature: conditions.temperature,
    pressure: conditions.pressure,
    windSpeed: conditions.windSpeed,
  };
};

const delta = (later: number | undefined, earlier: number | undefined): number | undefined =>
  later !== undefined && earlier !== undefined ? later - earlier : undefined;

/** What changed between two sets of conditions. */
export const compareEnvironments = (
  earlier: ComparableConditions | undefined,
  later: ComparableConditions | undefined
): EnvironmentDelta => {
  const a = summariseConditions(earlier);
  const b = summariseConditions(later);

  const densityAltitudeDelta = delta(b.densityAltitude, a.densityAltitude);
  const windSpeedDelta = delta(b.windSpeed, a.windSpeed);

  let direction: EnvironmentDelta['direction'] = 'unknown';
  if (densityAltitudeDelta !== undefined) {
    if (densityAltitudeDelta > 0) direction = 'thinner';
    else if (densityAltitudeDelta < 0) direction = 'denser';
    else direction = 'same';
  }

  const significant =
    (densityAltitudeDelta !== undefined &&
      Math.abs(densityAltitudeDelta) >= SIGNIFICANT_DENSITY_ALTITUDE_FT) ||
    (windSpeedDelta !== undefined && Math.abs(windSpeedDelta) >= SIGNIFICANT_WIND_MPH);

  return {
    densityAltitudeDelta,
    temperatureDelta: delta(b.temperature, a.temperature),
    pressureDelta: delta(b.pressure, a.pressure),
    windSpeedDelta,
    direction,
    significant,
  };
};

/** One line a shooter can read, rather than a table they have to interpret. */
export const describeEnvironmentDelta = (change: EnvironmentDelta): string => {
  if (change.densityAltitudeDelta === undefined) {
    return 'One of these sessions has no recorded conditions, so they cannot be compared.';
  }

  const parts: string[] = [];

  if (Math.abs(change.densityAltitudeDelta) >= SIGNIFICANT_DENSITY_ALTITUDE_FT) {
    parts.push(
      `Air is ${Math.abs(Math.round(change.densityAltitudeDelta))} ft ${change.direction} ` +
        '(density altitude)'
    );
  }

  if (
    change.windSpeedDelta !== undefined &&
    Math.abs(change.windSpeedDelta) >= SIGNIFICANT_WIND_MPH
  ) {
    const more = change.windSpeedDelta > 0 ? 'more' : 'less';
    parts.push(`${Math.abs(Math.round(change.windSpeedDelta))} mph ${more} wind`);
  }

  if (parts.length === 0) return 'Conditions are effectively the same.';
  return `${parts.join('; ')}.`;
};
