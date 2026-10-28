import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { TargetView } from '../../src/components/TargetView';
import { MAX_ZOOM } from '../../src/utils/targetZoom';
import { renderWithProviders } from '../helpers/renderWithProviders';

import type { POIMarker } from '../../src/models/TargetImage';

/**
 * Zooming the marking surface, and marking through the zoom (#63).
 *
 * `targetZoom.test.ts` holds the arithmetic. What is asserted here is that the
 * surface uses it in both directions: a tap while zoomed is stored where the
 * shooter aimed it, and a stored mark is drawn back under that tap.
 *
 * The buttons are driven rather than the pinch gesture, deliberately -- they
 * are the single-pointer alternative WCAG 2.5.1 requires, they run the same
 * code, and a gesture-handler pinch cannot be synthesised in this renderer.
 */

const FRAME = 300;

/** Gives the surface a size, as a device does on layout. */
const layOut = (view: ReturnType<typeof renderWithProviders>) =>
  fireEvent(view.getByTestId('target'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: FRAME, height: FRAME } },
  });

/** Taps the surface at a point in frame points. */
const tapAt = (view: ReturnType<typeof renderWithProviders>, x: number, y: number) =>
  fireEvent.press(view.getByTestId('target'), {
    nativeEvent: { locationX: x, locationY: y },
  });

const render = (markers: POIMarker[] = [], onMark = jest.fn()) => {
  const view = renderWithProviders(
    <TargetView
      background={{ kind: 'bullseye' }}
      markers={markers}
      onMark={onMark}
      testID="target"
    />
  );
  layOut(view);
  return { view, onMark };
};

/**
 * The marker dot's own flattened style.
 *
 * Two levels up from the number, not one: the label is a `<Text>` whose own
 * style carries the font, and the position is on the `<View>` around it. The
 * first version of this helper read the `<Text>`, found no `width` and happily
 * asserted `undefined === undefined` -- a test that passed while measuring
 * nothing, which is worth more words than it looks.
 */
const markerStyle = (
  view: ReturnType<typeof renderWithProviders>,
  label: string
): { left: number; top: number; width: number; height: number } => {
  const dot = view.getByText(label).parent?.parent;
  const style = dot?.props.style as object[] | undefined;
  if (!Array.isArray(style)) throw new Error(`No style on marker "${label}"`);
  const flat = Object.assign({}, ...style.filter(Boolean));
  if (typeof flat.left !== 'number' || typeof flat.width !== 'number') {
    throw new Error(`Marker "${label}" has no position: ${JSON.stringify(flat)}`);
  }
  return flat;
};

/** The marker dot's left offset in frame points. */
const markerLeft = (view: ReturnType<typeof renderWithProviders>, label: string): number =>
  markerStyle(view, label).left;

describe('the zoom controls (#63)', () => {
  it('starts on the whole target, with nothing to pan or reset', () => {
    const { view } = render();

    expect(view.getByTestId('target-zoom-level').props.children).toBe('Whole target');
    expect(view.getByTestId('target-zoom-out').props.accessibilityState.disabled).toBe(true);
    expect(view.getByTestId('target-pan-left').props.accessibilityState.disabled).toBe(true);
    expect(view.getByTestId('target-zoom-reset').props.accessibilityState.disabled).toBe(true);
  });

  it('zooms in a step at a time and says so in words', () => {
    const { view } = render();

    fireEvent.press(view.getByTestId('target-zoom-in'));
    expect(view.getByTestId('target-zoom-level').props.children).toBe('2.0x');

    fireEvent.press(view.getByTestId('target-zoom-in'));
    expect(view.getByTestId('target-zoom-level').props.children).toBe('4.0x');
  });

  it('enables panning once there is something off screen', () => {
    const { view } = render();

    fireEvent.press(view.getByTestId('target-zoom-in'));

    expect(view.getByTestId('target-pan-left').props.accessibilityState.disabled).toBe(false);
    expect(view.getByTestId('target-zoom-out').props.accessibilityState.disabled).toBe(false);
  });

  it('stops at the stated maximum rather than silently going further', () => {
    const { view } = render();

    for (let i = 0; i < 10; i += 1) fireEvent.press(view.getByTestId('target-zoom-in'));

    expect(view.getByTestId('target-zoom-level').props.children).toBe(`${MAX_ZOOM.toFixed(1)}x`);
    expect(view.getByTestId('target-zoom-in').props.accessibilityState.disabled).toBe(true);
  });

  it('returns to the whole target in one press', () => {
    const { view } = render();

    fireEvent.press(view.getByTestId('target-zoom-in'));
    fireEvent.press(view.getByTestId('target-zoom-in'));
    fireEvent.press(view.getByTestId('target-pan-right'));
    fireEvent.press(view.getByTestId('target-zoom-reset'));

    expect(view.getByTestId('target-zoom-level').props.children).toBe('Whole target');
  });

  it('offers every control at the 44pt floor', () => {
    const { view } = render();

    for (const id of [
      'target-zoom-in',
      'target-zoom-out',
      'target-pan-left',
      'target-pan-right',
      'target-pan-up',
      'target-pan-down',
      'target-zoom-reset',
    ]) {
      const style = view.getByTestId(id).props.style as { width: number; height: number }[];
      const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
      expect(flat.width).toBeGreaterThanOrEqual(44);
      expect(flat.height).toBeGreaterThanOrEqual(44);
    }
  });

  it('carries the zoom in the accessible label, not only in how big it looks', () => {
    const { view } = render();

    fireEvent.press(view.getByTestId('target-zoom-in'));

    expect(view.getByTestId('target').props.accessibilityLabel).toBe(
      'Target, 0 shots marked, 2.0x'
    );
  });
});

describe('marking through the zoom (#63)', () => {
  it('stores a tap at full view as the fraction of the target it landed on', () => {
    const { view, onMark } = render();

    tapAt(view, FRAME / 2, FRAME / 4);

    expect(onMark).toHaveBeenCalledWith({ x: 0.5, y: 0.25 });
  });

  it('stores a tap while zoomed as the point under the finger, not the frame', () => {
    // This is the defect zoom would otherwise introduce. At 2x centred, the
    // frame shows 0.25 to 0.75 of the target, so the middle of the frame is
    // still 0.5 -- but a tap a quarter of the way across the frame is 0.375 of
    // the target, not 0.25.
    const { view, onMark } = render();

    fireEvent.press(view.getByTestId('target-zoom-in'));
    tapAt(view, FRAME / 4, FRAME / 4);

    expect(onMark).toHaveBeenCalledWith({ x: 0.375, y: 0.375 });
  });

  it('stores a tap after panning from the point the pan moved to', () => {
    const { view, onMark } = render();

    fireEvent.press(view.getByTestId('target-zoom-in'));
    // Half a screen right at 2x is 0.25 of the target, so the window is
    // 0.5 to 1.0. The middle of the frame is now 0.75.
    fireEvent.press(view.getByTestId('target-pan-right'));
    tapAt(view, FRAME / 2, FRAME / 2);

    expect(onMark).toHaveBeenCalledWith({ x: 0.75, y: 0.5 });
  });

  it('ignores a tap outside the frame rather than storing a mark off the target', () => {
    const { view, onMark } = render();

    tapAt(view, -5, FRAME / 2);
    tapAt(view, FRAME + 5, FRAME / 2);

    expect(onMark).not.toHaveBeenCalled();
  });

  it('draws a stored mark back under the tap that placed it', () => {
    // The round trip, through the component rather than the module: a mark
    // stored from a tap at 2x must be drawn at that same frame position.
    const onMark = jest.fn();
    const { view } = render([], onMark);

    fireEvent.press(view.getByTestId('target-zoom-in'));
    tapAt(view, FRAME / 4, FRAME / 4);
    const stored = onMark.mock.calls[0][0] as POIMarker;
    view.unmount();

    const redrawn = renderWithProviders(
      <TargetView
        background={{ kind: 'bullseye' }}
        markers={[{ ...stored, shotNumber: 1 }]}
        onMark={jest.fn()}
        testID="target"
      />
    );
    layOut(redrawn);
    fireEvent.press(redrawn.getByTestId('target-zoom-in'));

    // Marker dots are centred on the point, so the left offset is the point
    // less half the 24pt dot.
    expect(markerLeft(redrawn, '1')).toBeCloseTo(FRAME / 4 - 12, 6);
  });

  it('moves a mark off the frame when it scrolls out of view', () => {
    // Clamping it to the edge would read as a shot that landed on the edge of
    // the target.
    const { view } = render([{ x: 0.05, y: 0.05, shotNumber: 1 }]);

    expect(markerLeft(view, '1')).toBeCloseTo(0.05 * FRAME - 12, 6);

    fireEvent.press(view.getByTestId('target-zoom-in'));
    fireEvent.press(view.getByTestId('target-pan-right'));
    fireEvent.press(view.getByTestId('target-pan-down'));

    expect(markerLeft(view, '1')).toBeLessThan(0);
  });

  it('keeps the marker dot the same size however far in it zooms', () => {
    // A dot that grew with the zoom would cover the very separation the zoom
    // was for. It is positioned on the frame, not inside the scaled content.
    const { view } = render([{ x: 0.5, y: 0.5, shotNumber: 1 }]);

    const before = markerStyle(view, '1').width;
    expect(before).toBeGreaterThan(0);

    fireEvent.press(view.getByTestId('target-zoom-in'));
    fireEvent.press(view.getByTestId('target-zoom-in'));

    expect(markerStyle(view, '1').width).toBe(before);
  });
});
