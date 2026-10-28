/**
 * Device barometer reading to stored station pressure (#62).
 *
 * WHICH PRESSURE. The pressure field on a snapshot is STATION pressure in inHg:
 * the absolute pressure of the air where the shooter is standing. The solver
 * consumes it unmodified as the `P` in `calculateAirDensity(temperature, P)`,
 * an ideal-gas density, so it must be the real local pressure -- not the
 * sea-level "altimeter setting" a weather report or METAR gives (#89, and the
 * field's own help text in `STATION_PRESSURE_HELP`).
 *
 * WHAT THE PHONE GIVES. expo-sensors' `Barometer` reports hPa. On iOS it is
 * `CMAltitudeData.pressure` (kPa, which the module multiplies by 10); on
 * Android it is `Sensor.TYPE_PRESSURE`. Both are the raw absolute pressure at
 * the handset. Neither platform corrects it to sea level -- that correction
 * needs the altitude, and is something barometer *apps* do for display.
 *
 * SO THE CONVERSION IS A UNIT CHANGE AND NOTHING ELSE. Station hPa becomes
 * station inHg by dividing by 33.8639. Applying a sea-level correction here
 * would be wrong twice over: at 5,000 ft it turns ~24.9 inHg into ~29.9, so the
 * solver would compute air about 18% denser than the shooter is in, and the
 * elevation the correction added back would no longer be in the pressure that
 * every downstream calculation assumes carries it.
 *
 * CALIBRATION. Phone barometers are precise but not always accurate: a given
 * handset can sit a hPa or two off true. The user may set a fixed offset in
 * Settings, found by comparing the phone against a trusted station-pressure
 * source such as a Kestrel. It is in inHg -- the unit the user compares in --
 * and is added after conversion, to the sensor reading only. A pressure typed by
 * hand is never adjusted; the offset describes this phone's sensor, not the
 * user's typing.
 */

/** Hectopascals in one inch of mercury (3386.389 Pa, at 0 °C and standard gravity). */
export const HPA_PER_INHG = 33.8638866667;

/**
 * The largest calibration offset, either way, in inHg.
 *
 * A working phone barometer is good to a hPa or two (0.03-0.06 inHg). One inch
 * of mercury is about a thousand feet of altitude; an offset that size is not a
 * sensor correction but somebody entering the difference between station
 * pressure and an altimeter setting, which this offset must not be used for.
 */
export const MAX_BAROMETER_OFFSET_INHG = 1;

/**
 * The station pressures a snapshot can store, in inHg.
 *
 * Matches `EnvironmentSnapshot`'s validation. A reading outside it is a faulty
 * sensor, and filling the field with it would only fail on save.
 */
const MIN_STATION_INHG = 20;
const MAX_STATION_INHG = 35;

/** Converts a pressure in hPa to inHg. Basis is unchanged: station in, station out. */
export const hPaToInHg = (hPa: number): number => hPa / HPA_PER_INHG;

/** Whether `offset` (inHg) is a usable barometer calibration. */
export const isValidBarometerOffset = (offset: number): boolean =>
  Number.isFinite(offset) && Math.abs(offset) <= MAX_BAROMETER_OFFSET_INHG;

/**
 * The station pressure to fill in from a set of barometer samples.
 *
 * @param samplesHpa - Raw sensor readings in hPa. Non-finite values are dropped.
 * @param offsetInHg - The user's calibration offset, added after conversion.
 * @returns Station pressure in inHg, rounded to the hundredth the field shows,
 *   or `null` when there is no usable sample or the calibrated result is outside
 *   what a snapshot can store.
 */
export const stationPressureFromSensor = (
  samplesHpa: readonly number[],
  offsetInHg: number
): number | null => {
  const usable = samplesHpa.filter((s) => Number.isFinite(s));
  if (usable.length === 0) return null;

  const meanHpa = usable.reduce((sum, s) => sum + s, 0) / usable.length;
  const calibrated = Math.round((hPaToInHg(meanHpa) + offsetInHg) * 100) / 100;

  if (calibrated < MIN_STATION_INHG || calibrated > MAX_STATION_INHG) return null;
  return calibrated;
};
