/**
 * Coordinate precision policy.
 *
 * The app records where a shot was taken so the ballistic solver can apply a
 * Coriolis correction. That correction consumes latitude only through
 * `sin(latitude)` and `cos(latitude)` (`src/utils/coriolis.ts`), which vary by
 * roughly 1.7% per whole degree -- so a tenth of a degree is already an order of
 * magnitude finer than the model can use.
 *
 * Precision is exactly what makes a coordinate identifying, and a shooting
 * position is sensitive: coordinates are persisted indefinitely and are included
 * in user-initiated exports. Capturing six decimal places (~0.1 m) for a model
 * that cannot distinguish tenths of a degree is a privacy cost with no
 * functional return, so coordinates are coarsened at the point of capture rather
 * than at the point of export.
 *
 * Longitude is not captured at all -- it participates in no calculation in this
 * codebase. See issue #44.
 */

/** Decimal places retained for a stored latitude. ~11 km of north-south extent. */
export const LATITUDE_PRECISION_DP = 1;

const SCALE = 10 ** LATITUDE_PRECISION_DP;

/**
 * Reduce a latitude to the coarsest precision the ballistic model needs.
 *
 * @param latitude - Latitude in degrees.
 * @returns The latitude rounded to {@link LATITUDE_PRECISION_DP} decimal places.
 */
export const coarsenLatitude = (latitude: number): number => {
  const rounded = Math.round(latitude * SCALE) / SCALE;
  // `Math.round(-0.02 * 10) / 10` is -0, which serialises as "-0" and reads as a
  // value distinct from 0. Normalise it away.
  return rounded === 0 ? 0 : rounded;
};
