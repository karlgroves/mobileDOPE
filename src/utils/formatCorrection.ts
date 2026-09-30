/**
 * A correction to one decimal place, as the DOPE Curve prints it.
 *
 * The solver returns a hair below zero at the zero range, and toFixed keeps
 * the sign, so the Drop Table's zero-range row read "-0.0".
 */
export const formatCorrection = (value: number): string => {
  const text = value.toFixed(1);
  return text === '-0.0' ? '0.0' : text;
};
