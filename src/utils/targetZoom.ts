/**
 * Zoom and pan for the target image, and the tap mapping that goes with it (#63).
 *
 * Marking a group accurately is the whole point of the target screen, and at
 * full view it cannot be done: a half-inch group on an 8.5-inch target drawn
 * 340 points wide is twenty points across, so five marks land on top of each
 * other and the measured spread is whatever the fat of a thumb decided.
 *
 * ## The visible window, not a transform matrix
 *
 * Zoom is expressed as the part of the image on screen: `left` and `top` are
 * where the window starts as fractions of the image, and `size` is how much of
 * it the window covers, so `size` of 0.25 is 4x. That is the same quantity the
 * marks are already stored in -- fractions of the image, never screen points
 * (see `targetMarking`) -- so mapping a tap back is one multiply and one add
 * rather than inverting a matrix whose composition order has to be guessed.
 *
 * It also means the mapping is pure, and therefore testable on its own. A
 * marking surface whose tap mapping is wrong by a few per cent produces a group
 * that looks plausible and measures wrong, which is the failure worth a test
 * rather than a device.
 *
 * ## Why one `size` for both axes
 *
 * `x` and `y` are fractions of different lengths once the image is not square.
 * The frame is drawn at the image's own aspect ratio, so an equal fraction of
 * each axis is an equal *visual* scale -- which is what a shooter means by
 * zooming in. The real-world measurement is `targetMarking`'s job and reads the
 * aspect ratio there; nothing here needs it.
 */

/** The part of the image on screen: where the window starts, and how much it covers. */
export interface TargetWindow {
  /** Left edge, as a fraction of the image width. */
  left: number;
  /** Top edge, as a fraction of the image height. */
  top: number;
  /** Fraction of the image the window covers on each axis. 1 is the whole target. */
  size: number;
}

/** The whole target, which is where the screen starts. */
export const FULL_VIEW: TargetWindow = { left: 0, top: 0, size: 1 };

/**
 * Closest zoom. 8x puts about an inch of an 8.5-inch target across the screen,
 * which is finer than a shot hole, so going further would only magnify the
 * marker dot.
 */
export const MAX_ZOOM = 8;

/** One press of Zoom in or Zoom out. */
export const ZOOM_STEP = 2;

/** One press of a pan control, as a fraction of the visible window. */
export const PAN_STEP = 0.5;

const MIN_SIZE = 1 / MAX_ZOOM;

/**
 * Keeps the window inside the image.
 *
 * A window larger than the image is pinned to the whole image, which is what
 * makes {@link FULL_VIEW} the only state at 1x: there is no panning a target
 * that is already entirely on screen, and allowing it would let the shooter
 * drag the target off the edge and wonder where it went.
 */
const clamp = ({ left, top, size }: TargetWindow): TargetWindow => {
  const s = Math.min(1, Math.max(MIN_SIZE, Number.isFinite(size) ? size : 1));
  const span = 1 - s;
  const limit = (value: number): number =>
    Math.min(span, Math.max(0, Number.isFinite(value) ? value : 0));
  return { left: limit(left), top: limit(top), size: s };
};

/** The zoom factor a window represents, where 1 is the whole target. */
export const zoomOf = (window: TargetWindow): number => 1 / window.size;

/**
 * Zoom by `factor` about a point, keeping that point where it is on screen.
 *
 * @param window - The window now.
 * @param factor - Above 1 zooms in.
 * @param focusX - Where to zoom about, as a fraction of the *frame* width.
 * @param focusY - As a fraction of the frame height.
 * @returns The new window, clamped to the image.
 */
export const zoomAbout = (
  window: TargetWindow,
  factor: number,
  focusX = 0.5,
  focusY = 0.5
): TargetWindow => {
  if (!Number.isFinite(factor) || factor <= 0) return window;

  // The image point currently under the focus, which must not move.
  const anchor = toImagePoint(window, focusX, focusY);
  const size = Math.min(1, Math.max(MIN_SIZE, window.size / factor));

  return clamp({
    left: anchor.x - focusX * size,
    top: anchor.y - focusY * size,
    size,
  });
};

/**
 * Pan by whole steps of the visible window.
 *
 * @param window - The window now.
 * @param stepsX - Positive moves the view right across the target.
 * @param stepsY - Positive moves the view down.
 * @returns The new window, clamped to the image.
 */
export const panBy = (window: TargetWindow, stepsX: number, stepsY: number): TargetWindow =>
  clamp({
    left: window.left + stepsX * PAN_STEP * window.size,
    top: window.top + stepsY * PAN_STEP * window.size,
    size: window.size,
  });

/**
 * Pan by a drag, measured as a fraction of the frame.
 *
 * The content moves with the finger, so the window moves against it: dragging
 * right reveals what is to the left.
 *
 * @param window - The window now.
 * @param dxFraction - Drag distance right, as a fraction of the frame width.
 * @param dyFraction - Drag distance down, as a fraction of the frame height.
 * @returns The new window, clamped to the image.
 */
export const panByDrag = (
  window: TargetWindow,
  dxFraction: number,
  dyFraction: number
): TargetWindow =>
  clamp({
    left: window.left - dxFraction * window.size,
    top: window.top - dyFraction * window.size,
    size: window.size,
  });

/**
 * Where a point on the frame is on the target.
 *
 * @param window - The visible window.
 * @param frameX - Across the frame, 0 at its left edge and 1 at its right.
 * @param frameY - Down the frame, 0 at its top and 1 at its bottom.
 * @returns The position on the image, as fractions of width and height.
 */
export const toImagePoint = (
  window: TargetWindow,
  frameX: number,
  frameY: number
): { x: number; y: number } => ({
  x: window.left + frameX * window.size,
  y: window.top + frameY * window.size,
});

/**
 * Where a point on the target is on the frame.
 *
 * Can fall outside 0..1, which is correct and load-bearing: a mark that is
 * scrolled off the visible window must be drawn off the frame rather than
 * clamped to its edge, where it would read as a shot on the edge of the target.
 *
 * @param window - The visible window.
 * @param imageX - Across the image, as a fraction of its width.
 * @param imageY - Down the image, as a fraction of its height.
 * @returns Fractions of the frame, which may be negative or above 1.
 */
export const toFramePoint = (
  window: TargetWindow,
  imageX: number,
  imageY: number
): { x: number; y: number } => ({
  x: (imageX - window.left) / window.size,
  y: (imageY - window.top) / window.size,
});

/** "2.0x", or "Whole target" at full view -- what the control reports. */
export const describeZoom = (window: TargetWindow): string => {
  const zoom = zoomOf(window);
  return zoom <= 1.001 ? 'Whole target' : `${zoom.toFixed(1)}x`;
};
