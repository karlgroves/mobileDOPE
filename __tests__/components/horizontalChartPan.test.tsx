import { renderHook } from '@testing-library/react-native';

import { useHorizontalChartPan } from '../../src/hooks/useHorizontalChartPan';

/**
 * The DOPE Curve's one-finger pan (#64).
 *
 * victory-native's own pan claims every drag on the chart, whatever its
 * direction. Seen on the iOS Simulator: a vertical drag on the chart did not
 * scroll the page, leaving a dead zone about 280 pt tall in the middle of a
 * scrolling screen. This pan starts only on a horizontal drag and gives way on
 * a vertical one, so the page underneath can scroll.
 */

type Handlers = {
  onStart: () => void;
  onChange: (e: { changeX: number; changeY: number }) => void;
  onEnd: () => void;
};

const state = () => ({
  matrix: { value: [2, 0, 0, -100, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
  panActive: { value: false },
  zoomActive: { value: false },
  origin: { value: { x: 0, y: 0 } },
  offset: { value: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
});

const gestureFor = (s: ReturnType<typeof state>) =>
  renderHook(() => useHorizontalChartPan(s as never)).result.current as unknown as {
    config: Record<string, number>;
    handlers: Handlers;
  };

describe('useHorizontalChartPan', () => {
  it('starts only once a drag is clearly horizontal', () => {
    const { config } = gestureFor(state());

    expect(config.activeOffsetXStart).toBeLessThan(0);
    expect(config.activeOffsetXEnd).toBeGreaterThan(0);
  });

  it('gives way to the page scroll on a vertical drag', () => {
    const { config } = gestureFor(state());

    expect(config.failOffsetYStart).toBeLessThan(0);
    expect(config.failOffsetYEnd).toBeGreaterThan(0);
  });

  it('moves the chart along the distance axis only', () => {
    const s = state();
    const { handlers } = gestureFor(s);

    handlers.onStart();
    handlers.onChange({ changeX: 30, changeY: 12 });

    expect(s.matrix.value[3]).toBe(-70); // translate X
    expect(s.matrix.value[7]).toBe(0); // translate Y untouched
    expect(s.matrix.value[0]).toBe(2); // zoom untouched
  });

  it('marks the pan active while it runs, so the snap-back waits for it', () => {
    const s = state();
    const { handlers } = gestureFor(s);

    handlers.onStart();
    expect(s.panActive.value).toBe(true);
    handlers.onEnd();
    expect(s.panActive.value).toBe(false);
  });
});
