/**
 * How the DOPE Curve draws a point's confidence (#64).
 *
 * Opacity is the encoding: a well-evidenced point is solid and a thin one is
 * faint. The floor keeps a zero-confidence point visible -- it is still an
 * entry the shooter logged, and hiding it would hide exactly the data they may
 * need to re-shoot. The chart also draws every point's outline at full opacity,
 * so the floor is about the fill reading as "faint", not about finding the dot.
 */

/** Fill opacity for a point with no supporting evidence. */
export const MIN_CONFIDENCE_OPACITY = 0.25;

/** Fill opacity for a 0–1 confidence score. */
export const confidenceOpacity = (score: number): number => {
  const clamped = Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : 0;
  return MIN_CONFIDENCE_OPACITY + (1 - MIN_CONFIDENCE_OPACITY) * clamped;
};
