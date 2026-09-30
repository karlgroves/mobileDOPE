import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';

import type { useChartTransformState } from 'victory-native';

/** victory-native's zoom/pan state, which it does not export by name. */
type ChartTransformState = ReturnType<typeof useChartTransformState>['state'];

/** How far a finger must travel before the gesture decides what it is, in pt. */
const DECIDE_AFTER = 10;

/**
 * Where a 4x4 transform keeps its X translation: the slot victory-native's own
 * `setTranslate` writes. Written directly so this module does not import
 * victory-native, which Jest cannot load.
 */
const TRANSLATE_X = 3;

/**
 * A one-finger pan along the DOPE Curve's distance axis (#64).
 *
 * Replaces victory-native's own pan, which claims every drag on the chart
 * whatever its direction: a vertical drag on the chart did not scroll the page
 * (seen on the iOS Simulator), leaving a dead zone in the middle of a scrolling
 * screen. This one activates only on a horizontal drag and fails on a vertical
 * one, so the scroll view underneath takes it.
 *
 * It writes the same matrix victory-native's pinch does, and flags `panActive`
 * so the chart's snap-back waits until the finger lifts.
 */
export const useHorizontalChartPan = (state: ChartTransformState) =>
  useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-DECIDE_AFTER, DECIDE_AFTER])
        .failOffsetY([-DECIDE_AFTER, DECIDE_AFTER])
        .onStart(() => {
          state.panActive.value = true;
        })
        .onChange((e) => {
          const next = [...state.matrix.value];
          next[TRANSLATE_X] += e.changeX;
          state.matrix.value = next as unknown as typeof state.matrix.value;
        })
        .onEnd(() => {
          state.panActive.value = false;
        }),
    [state]
  );
