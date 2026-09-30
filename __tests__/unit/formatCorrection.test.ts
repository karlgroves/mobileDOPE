import { formatCorrection } from '../../src/utils/formatCorrection';

/**
 * A correction as the DOPE Curve prints it. Seen on the iOS Simulator: the Drop
 * Table's 100 yd row read "-0.0", because the solver returns a hair below zero
 * at the zero range and toFixed keeps the sign.
 */
describe('formatCorrection', () => {
  it('prints one decimal place', () => {
    expect(formatCorrection(3.14159)).toBe('3.1');
    expect(formatCorrection(-1.25)).toBe('-1.3');
  });

  it('never prints a negative zero', () => {
    expect(formatCorrection(-0.0001)).toBe('0.0');
    expect(formatCorrection(-0.04)).toBe('0.0');
    expect(formatCorrection(-0)).toBe('0.0');
  });

  it('keeps a real negative that rounds away from zero', () => {
    expect(formatCorrection(-0.05)).toBe('-0.1');
  });
});
