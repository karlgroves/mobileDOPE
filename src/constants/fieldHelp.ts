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
