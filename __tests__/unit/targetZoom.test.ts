import {
  FULL_VIEW,
  MAX_ZOOM,
  PAN_STEP,
  ZOOM_STEP,
  describeZoom,
  panBy,
  panByDrag,
  toFramePoint,
  toImagePoint,
  zoomAbout,
  zoomOf,
} from '../../src/utils/targetZoom';

import type { TargetWindow } from '../../src/utils/targetZoom';

/**
 * Zoom, pan, and the tap mapping that goes with them (#63).
 *
 * The mapping is the part worth testing rather than looking at. A marking
 * surface whose tap mapping is wrong by a few per cent produces a group that
 * looks entirely plausible on screen and measures wrong -- and the measurement
 * is what the shooter acts on. Every case below is a round trip or an exact
 * figure, because "about right" is the failure mode.
 */

const at = (left: number, top: number, size: number): TargetWindow => ({ left, top, size });

describe('the window stays inside the target (#63)', () => {
  it('starts on the whole target', () => {
    expect(FULL_VIEW).toEqual({ left: 0, top: 0, size: 1 });
    expect(zoomOf(FULL_VIEW)).toBe(1);
  });

  it('cannot pan a target that is entirely on screen', () => {
    // Otherwise the shooter drags the target off the edge and wonders where it
    // went. At 1x there is nothing off screen to pan to.
    expect(panBy(FULL_VIEW, 1, 1)).toEqual(FULL_VIEW);
    expect(panBy(FULL_VIEW, -1, -1)).toEqual(FULL_VIEW);
    expect(panByDrag(FULL_VIEW, 0.5, 0.5)).toEqual(FULL_VIEW);
  });

  it('cannot zoom out past the whole target', () => {
    expect(zoomAbout(FULL_VIEW, 1 / ZOOM_STEP)).toEqual(FULL_VIEW);
  });

  it('cannot zoom in past the stated maximum', () => {
    let window = FULL_VIEW;
    for (let i = 0; i < 20; i += 1) window = zoomAbout(window, ZOOM_STEP);

    expect(zoomOf(window)).toBeCloseTo(MAX_ZOOM, 10);
  });

  it('pins the window to the edge rather than past it', () => {
    const atRightEdge = panBy(at(0, 0, 0.25), 10, 10);

    expect(atRightEdge.left).toBeCloseTo(0.75, 10);
    expect(atRightEdge.top).toBeCloseTo(0.75, 10);
    // And the far side: the window's right edge is exactly the image's.
    expect(atRightEdge.left + atRightEdge.size).toBeCloseTo(1, 10);
  });

  it('pins to the near edge too', () => {
    const atLeftEdge = panBy(at(0.4, 0.4, 0.25), -10, -10);

    expect(atLeftEdge).toEqual({ left: 0, top: 0, size: 0.25 });
  });

  it('survives a non-finite size or offset rather than drawing nothing', () => {
    // A NaN that reached a style would render an empty frame with no error, so
    // each is replaced by the safe end of its range rather than passed through.
    expect(zoomAbout(at(0, 0, 0.5), Number.NaN)).toEqual(at(0, 0, 0.5));
    expect(panBy(at(Number.NaN, 0, 0.5), 1, 0).left).toBe(0);
    expect(panBy(at(0, 0, Number.NaN), 1, 0)).toEqual(FULL_VIEW);
  });
});

describe('zooming keeps the focused point still (#63)', () => {
  it('holds the centre when zooming about the centre', () => {
    const before = toImagePoint(FULL_VIEW, 0.5, 0.5);
    const after = toImagePoint(zoomAbout(FULL_VIEW, 2), 0.5, 0.5);

    expect(after).toEqual(before);
  });

  it('holds an off-centre point when zooming about it', () => {
    // A shooter pinching on a group in the corner expects that group to stay
    // under their fingers, not to fly off screen.
    const window = at(0.2, 0.2, 0.5);
    const focus = { x: 0.25, y: 0.75 };
    const before = toImagePoint(window, focus.x, focus.y);

    const after = toImagePoint(zoomAbout(window, 2, focus.x, focus.y), focus.x, focus.y);

    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it('cannot hold a point the clamp has to move, and clamps rather than drifting', () => {
    // Zooming about the extreme corner would put the window outside the image.
    // It is clamped, so the focused point does move -- but the window stays
    // legal, which is the property that matters.
    const window = zoomAbout(FULL_VIEW, 4, 0, 0);

    expect(window.left).toBe(0);
    expect(window.top).toBe(0);
    expect(window.left + window.size).toBeLessThanOrEqual(1);
  });
});

describe('the tap mapping (#63)', () => {
  it('maps the frame onto the whole target at full view', () => {
    expect(toImagePoint(FULL_VIEW, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(toImagePoint(FULL_VIEW, 0.5, 0.5)).toEqual({ x: 0.5, y: 0.5 });
    expect(toImagePoint(FULL_VIEW, 1, 1)).toEqual({ x: 1, y: 1 });
  });

  it('maps the frame onto the visible window when zoomed', () => {
    // 4x on the middle of the target: the frame now covers 0.375 to 0.625.
    const window = at(0.375, 0.375, 0.25);

    expect(toImagePoint(window, 0, 0)).toEqual({ x: 0.375, y: 0.375 });
    expect(toImagePoint(window, 1, 1)).toEqual({ x: 0.625, y: 0.625 });
    expect(toImagePoint(window, 0.5, 0.5)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('round-trips every window it is given', () => {
    // The property the marking surface rests on: a mark placed by a tap must be
    // drawn back under that tap. Checked across zooms and offsets rather than
    // at one convenient value.
    for (const size of [1, 0.5, 0.25, 1 / MAX_ZOOM]) {
      for (const offset of [0, 0.1, 1 - size]) {
        const window = at(offset, offset, size);
        for (const frame of [0, 0.25, 0.5, 0.9, 1]) {
          const image = toImagePoint(window, frame, frame);
          const back = toFramePoint(window, image.x, image.y);
          expect(back.x).toBeCloseTo(frame, 10);
          expect(back.y).toBeCloseTo(frame, 10);
        }
      }
    }
  });

  it('draws a mark outside the window off the frame, not on its edge', () => {
    // Clamping would put a shot that is scrolled out of view on the edge of the
    // target, where it reads as a shot that landed there.
    const window = at(0.5, 0.5, 0.25);

    expect(toFramePoint(window, 0.1, 0.1).x).toBeLessThan(0);
    expect(toFramePoint(window, 0.9, 0.9).x).toBeGreaterThan(1);
  });

  it('separates two marks a zoom level apart, which is why zoom exists', () => {
    // Two shots 2% of the target apart. On a 340-point frame that is 7 points
    // at full view -- inside one marker dot. At 8x it is 54, which a thumb can
    // tell apart.
    const apartAt = (size: number): number => {
      const window = at(0.49, 0.49, size);
      return Math.abs(toFramePoint(window, 0.52, 0.5).x - toFramePoint(window, 0.5, 0.5).x) * 340;
    };

    expect(apartAt(1)).toBeCloseTo(6.8, 1);
    expect(apartAt(1 / MAX_ZOOM)).toBeCloseTo(54.4, 1);
  });
});

describe('panning (#63)', () => {
  it('moves by half the visible window per press', () => {
    const window = panBy(at(0.2, 0.2, 0.4), 1, 0);

    expect(window.left).toBeCloseTo(0.2 + PAN_STEP * 0.4, 10);
    expect(window.top).toBeCloseTo(0.2, 10);
  });

  it('moves less when zoomed further in, so a press is always half a screen', () => {
    // Started near the left edge so neither case meets the clamp: at 2x a press
    // is 0.25 of the image, at 8x it is 0.0625.
    const near = panBy(at(0.05, 0, 0.5), 1, 0).left - 0.05;
    const far = panBy(at(0.05, 0, 0.125), 1, 0).left - 0.05;

    expect(near).toBeCloseTo(0.25, 10);
    expect(far).toBeCloseTo(near / 4, 10);
  });

  it('follows the finger: dragging right reveals what is to the left', () => {
    const window = panByDrag(at(0.5, 0.5, 0.25), 0.4, 0);

    expect(window.left).toBeCloseTo(0.5 - 0.4 * 0.25, 10);
  });
});

describe('describeZoom (#63)', () => {
  it('says whole target rather than 1.0x', () => {
    expect(describeZoom(FULL_VIEW)).toBe('Whole target');
  });

  it('names the factor once zoomed', () => {
    expect(describeZoom(at(0, 0, 0.5))).toBe('2.0x');
    expect(describeZoom(at(0, 0, 0.25))).toBe('4.0x');
  });

  it('does not report a rounding artefact as a zoom', () => {
    // A size a hair under 1 after a clamp must not read as "1.0x", which would
    // claim the shooter has zoomed when they have not.
    expect(describeZoom(at(0, 0, 0.9999))).toBe('Whole target');
  });
});
