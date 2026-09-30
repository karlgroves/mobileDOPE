import {
  MAX_ZOOM,
  clampView,
  counterScale,
  PAN_STEP,
  ZOOM_STEP,
  panBy,
  resetView,
  zoomBy,
  type ChartView,
} from '../../src/utils/chartZoom';

/**
 * The DOPE Curve's horizontal zoom and pan (#64), as buttons drive it.
 *
 * The chart's pinch and pan gestures need a single-tap alternative (WCAG
 * 2.5.1), and both have to keep the curve on screen: a view scaled below 1x
 * leaves empty chart, and a translate past either end scrolls the curve out of
 * sight with no way to tell where it went.
 */

const WIDTH = 300;
const at = (scale: number, translate: number): ChartView => ({ scale, translate });

describe('zoomBy', () => {
  it('zooms in by one step around the centre of what is showing', () => {
    const view = zoomBy(resetView(), ZOOM_STEP, WIDTH);

    expect(view.scale).toBe(ZOOM_STEP);
    // The centre (150) stays at the centre: 150 * scale + translate = 150.
    expect(150 * view.scale + view.translate).toBeCloseTo(150, 10);
  });

  it('keeps the point at the centre fixed when already zoomed and panned', () => {
    const start = at(2, -200); // showing content x from 100 to 250
    const centre = (WIDTH / 2 - start.translate) / start.scale; // content x at mid-screen

    const view = zoomBy(start, 2, WIDTH);

    expect(centre * view.scale + view.translate).toBeCloseTo(WIDTH / 2, 10);
  });

  it('never zooms out past the whole curve', () => {
    expect(zoomBy(resetView(), 1 / ZOOM_STEP, WIDTH)).toEqual(resetView());
    expect(zoomBy(at(1.5, -100), 1 / 4, WIDTH)).toEqual(resetView());
  });

  it('stops at the maximum zoom', () => {
    const view = zoomBy(at(MAX_ZOOM, -WIDTH), ZOOM_STEP, WIDTH);

    expect(view.scale).toBe(MAX_ZOOM);
  });
});

describe('panBy', () => {
  it('moves along the distance axis by one step of the visible width', () => {
    const view = panBy(at(2, -150), PAN_STEP, WIDTH);

    expect(view.translate).toBeCloseTo(-150 - PAN_STEP * WIDTH, 10);
    expect(view.scale).toBe(2);
  });

  it('cannot pan past the start of the curve', () => {
    expect(panBy(at(2, -10), -PAN_STEP, WIDTH).translate).toBe(0);
  });

  it('cannot pan past the end of the curve', () => {
    // At 2x the content is 600 wide; the furthest it can move is -300.
    expect(panBy(at(2, -290), PAN_STEP, WIDTH).translate).toBe(-300);
  });

  it('does nothing at 1x, where the whole curve already shows', () => {
    expect(panBy(resetView(), PAN_STEP, WIDTH)).toEqual(resetView());
  });
});

describe('resetView', () => {
  it('shows the whole curve', () => {
    expect(resetView()).toEqual({ scale: 1, translate: 0 });
  });
});

describe('counterScale', () => {
  /**
   * Zoom scales everything inside the chart, markers included, so at 2x a
   * round marker drew as an oval twice as wide (seen on the iOS Simulator).
   * Each marker is drawn under the inverse horizontal scale to stay round.
   */
  it('undoes the horizontal zoom', () => {
    expect(counterScale(2)).toEqual([{ scaleX: 0.5 }]);
    expect(counterScale(8)).toEqual([{ scaleX: 0.125 }]);
  });

  it('leaves a marker alone at 1x', () => {
    expect(counterScale(1)).toEqual([{ scaleX: 1 }]);
  });

  it('never divides by zero or a non-number', () => {
    expect(counterScale(0)).toEqual([{ scaleX: 1 }]);
    expect(counterScale(Number.NaN)).toEqual([{ scaleX: 1 }]);
  });
});

describe('clampView', () => {
  /**
   * victory-native's pinch and pan have no limits. On the iOS Simulator a
   * pinch zoomed out past 1x, squeezing the curve into the left half of an
   * otherwise empty chart. The chart snaps back to this when a gesture ends.
   */
  it('brings a view zoomed out past the whole curve back to 1x', () => {
    expect(clampView(at(0.4, 30), WIDTH)).toEqual(resetView());
  });

  it('caps a pinch past the maximum zoom', () => {
    expect(clampView(at(20, -1000), WIDTH).scale).toBe(MAX_ZOOM);
  });

  it('pulls a view panned off either end back onto the curve', () => {
    expect(clampView(at(2, 80), WIDTH)).toEqual(at(2, 0));
    expect(clampView(at(2, -900), WIDTH)).toEqual(at(2, -300));
  });

  it('leaves a view that is already in range alone', () => {
    expect(clampView(at(3, -250), WIDTH)).toEqual(at(3, -250));
  });

  it('keeps the whole curve when it does not know the width yet', () => {
    expect(clampView(at(3, -250), 0)).toEqual(resetView());
  });
});
