/**
 * Horizontal zoom and pan for the DOPE Curve (#64), as its buttons drive it.
 *
 * The chart also takes pinch and pan gestures, which need a single-tap
 * alternative (WCAG 2.5.1). Both work on the same view: a scale along the
 * distance axis and a translate, in chart pixels, of the scaled content. A
 * point at content x is drawn at `x * scale + translate`.
 *
 * Every result is clamped so the curve stays on screen: never below 1x, where
 * the whole curve already shows, and never translated past either end.
 */

/** A horizontal zoom and pan: scale along distance, and translate in chart pixels. */
export interface ChartView {
  scale: number;
  translate: number;
}

/** How far in the chart can zoom. 8x shows about 100 yards of a 1000-yard curve. */
export const MAX_ZOOM = 8;

/** One press of Zoom in or Zoom out. */
export const ZOOM_STEP = 2;

/** One press of Earlier or Later, as a fraction of the visible width. */
export const PAN_STEP = 0.5;

export const resetView = (): ChartView => ({ scale: 1, translate: 0 });

/** Keep the scaled content covering the chart: translate in [width * (1 - scale), 0]. */
const clampTranslate = ({ scale, translate }: ChartView, width: number): ChartView => {
  const t = Math.min(0, Math.max(width * (1 - scale), translate));
  return { scale, translate: t === 0 ? 0 : t };
};

/** Zoom by `factor`, keeping the point at the centre of the chart where it is. */
export const zoomBy = (view: ChartView, factor: number, width: number): ChartView => {
  const centre = width / 2;
  const contentAtCentre = (centre - view.translate) / view.scale;
  const scale = Math.min(MAX_ZOOM, Math.max(1, view.scale * factor));
  return clampTranslate({ scale, translate: centre - contentAtCentre * scale }, width);
};

/**
 * Pan by `steps` of the visible width: positive shows longer distances,
 * negative shorter.
 */
export const panBy = (view: ChartView, steps: number, width: number): ChartView =>
  clampTranslate({ scale: view.scale, translate: view.translate - steps * width }, width);

/**
 * The transform that keeps a marker round at horizontal zoom `scale`.
 *
 * Zoom scales everything inside the chart, so at 2x a round marker drew as an
 * oval twice as wide. Drawing it under the inverse horizontal scale, around its
 * own centre, undoes that. Runs on the UI thread as the zoom changes.
 */
export const counterScale = (scale: number): { scaleX: number }[] => {
  'worklet';
  return [{ scaleX: scale > 0 && Number.isFinite(scale) ? 1 / scale : 1 }];
};

/**
 * Any view, brought back into range: 1x to MAX_ZOOM, and never panned past
 * either end. victory-native's pinch and pan have no limits of their own, so
 * the chart snaps to this when a gesture ends. Until the chart has reported its
 * width there is nothing to measure against, so the whole curve shows.
 */
export const clampView = (view: ChartView, width: number): ChartView => {
  'worklet';
  if (!(width > 0)) return { scale: 1, translate: 0 };
  const scale = Math.min(MAX_ZOOM, Math.max(1, view.scale));
  const translate = Math.min(0, Math.max(width * (1 - scale), view.translate));
  return { scale, translate: translate === 0 ? 0 : translate };
};
