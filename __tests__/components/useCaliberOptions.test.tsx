import { act, renderHook } from '@testing-library/react-native';

import { CALIBER_OPTIONS } from '../../src/constants/calibers';
import { useCaliberOptions } from '../../src/hooks/useCaliberOptions';
import { useAppStore } from '../../src/store/useAppStore';

/**
 * Every caliber picker offers the shooter's own calibers beside the built-in
 * ones (#67), and picks up a change without the form being reopened.
 */

const setCustom = (customCalibers: { name: string; diameter: number }[]) =>
  useAppStore.setState((s) => ({ settings: { ...s.settings, customCalibers } }));

afterEach(() => setCustom([]));

it('offers only the built-in calibers until the shooter adds one', () => {
  setCustom([]);
  const { result } = renderHook(() => useCaliberOptions());
  expect(result.current).toEqual(CALIBER_OPTIONS);
});

it('adds custom calibers after the built-in ones, and follows changes', () => {
  setCustom([{ name: '6.5 Wildcat', diameter: 0.264 }]);
  const { result } = renderHook(() => useCaliberOptions());
  expect(result.current.at(-1)).toEqual({ label: '6.5 Wildcat (custom)', value: '6.5 Wildcat' });

  act(() => setCustom([]));
  expect(result.current).toHaveLength(CALIBER_OPTIONS.length);
});

it('keeps the same array between renders while nothing changes', () => {
  setCustom([{ name: '6.5 Wildcat', diameter: 0.264 }]);
  const { result, rerender } = renderHook(() => useCaliberOptions());
  const first = result.current;
  rerender({});
  expect(result.current).toBe(first);
});
