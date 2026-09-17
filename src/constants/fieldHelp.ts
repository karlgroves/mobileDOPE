/**
 * Helper text for inputs where the obvious answer is the wrong one.
 *
 * Shared rather than inlined so the two screens asking for the same quantity
 * cannot drift into explaining it differently — a user who reads one and then
 * the other should not have to work out whether the difference is meaningful.
 */

/**
 * Which pressure the solver wants (#89).
 *
 * Weather apps, METARs and most phone barometers report *altimeter setting* —
 * pressure corrected to sea level so pilots can compare readings. The solver
 * derives air density from temperature and pressure and needs the real pressure
 * where the shooter is standing. At 5,000 feet the two differ by roughly 5 inHg,
 * which is not a rounding error.
 *
 * Does not repeat the field label: it sits directly under "Station Pressure",
 * and helper text that restates its own label spends the user's attention
 * without telling them anything.
 */
export const STATION_PRESSURE_HELP =
  "The reading where you are — not the sea-level 'altimeter setting' a weather app reports.";

/**
 * What altitude is actually for (#89).
 *
 * The solver derives air density from temperature and pressure only; altitude
 * is carried through the types and never consumed. With station pressure
 * entered, the elevation information is already in the pressure, and reading
 * altitude as well would correct for it twice.
 *
 * So the field is not required and does not change the solution. It is kept
 * because a DOPE log is a record of the conditions a shot was taken in, and
 * where you were standing is part of that.
 *
 * Deliberately does NOT point at the density altitude display as the reason.
 * `calculatePressureAltitude` adds the altitude to the pressure-derived
 * altitude, which is the standard aviation formula and correct for an ALTIMETER
 * SETTING -- but the field now asks for station pressure, so that display
 * double-counts elevation. At 5,280 ft it reads about 10,300 ft instead of
 * 5,020. That is its own defect, with a second copy of the same formula in
 * `EnvironmentSnapshot`, and it is not fixed here; this text must not send
 * anyone to a number that is wrong.
 */
export const ALTITUDE_HELP =
  'Recorded with the shot. It does not change the solution \u2014 station pressure already carries your elevation.';
