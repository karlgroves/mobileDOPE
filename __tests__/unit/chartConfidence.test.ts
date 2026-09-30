import { confidenceOpacity, MIN_CONFIDENCE_OPACITY } from '../../src/utils/chartConfidence';

/**
 * The DOPE Curve shades each logged point by its confidence (#64). Opacity is
 * the whole encoding, so the mapping has to keep an order and never erase a
 * point: a weak point is still a point the shooter logged.
 */
describe('confidenceOpacity', () => {
  it('is fully opaque at full confidence', () => {
    expect(confidenceOpacity(1)).toBe(1);
  });

  it('never fades a point out entirely', () => {
    expect(confidenceOpacity(0)).toBe(MIN_CONFIDENCE_OPACITY);
    expect(MIN_CONFIDENCE_OPACITY).toBeGreaterThanOrEqual(0.2);
  });

  it('gets fainter as confidence falls', () => {
    const steps = [1, 0.8, 0.6, 0.4, 0.2, 0].map(confidenceOpacity);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeLessThan(steps[i - 1]);
    }
  });

  it('clamps scores outside 0-1 and treats a non-number as no confidence', () => {
    expect(confidenceOpacity(1.4)).toBe(1);
    expect(confidenceOpacity(-0.3)).toBe(MIN_CONFIDENCE_OPACITY);
    expect(confidenceOpacity(Number.NaN)).toBe(MIN_CONFIDENCE_OPACITY);
  });
});
