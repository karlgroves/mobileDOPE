import { fireEvent } from '@testing-library/react-native';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';

import { SegmentedControl } from '../../src/components/SegmentedControl';
import { useAppStore } from '../../src/store';
import { renderWithProviders } from '../helpers/renderWithProviders';

/**
 * Press feedback that cannot get stuck (#145).
 *
 * The segments were TouchableOpacity, which animates its opacity down on press
 * and back up on release. The theme switcher changes the theme on press, which
 * re-renders the whole tree while the press is still active, and the fade back
 * never ran: the newly selected theme drew at about 20% opacity, its label near
 * invisible, until Settings was reopened (seen on the iOS Simulator on every
 * switch). Feedback now comes from render state, so the next render is right.
 */

const opacityOf = (el: { props: { style?: unknown } }): number => {
  const flat = StyleSheet.flatten(el.props.style as object) as { opacity?: number } | undefined;
  return flat?.opacity ?? 1;
};

const OPTIONS = [
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
];

/**
 * The style a segment draws with, pressed or not. RNTL's pressIn does not toggle
 * Pressable's pressed state (see followsTheme.test.tsx), so this calls the style
 * function Pressable itself calls. Its existence is the point: the feedback is
 * a function of render state, with no animation behind it to strand.
 */
type Node = { props: { style?: unknown }; parent: Node | null };
const styleWhen = (el: Node, pressed: boolean) => {
  // The role lands on the host view; the style function is on the Pressable
  // above it.
  let node: Node | null = el;
  while (node && typeof node.props.style !== 'function') node = node.parent;
  expect(node).not.toBeNull();
  const style = node!.props.style as (s: { pressed: boolean }) => unknown;
  return { props: { style: style({ pressed }) } };
};

describe('SegmentedControl press feedback', () => {
  it('dims a segment only while it is held, from render state', () => {
    const { getByRole } = renderWithProviders(
      <SegmentedControl options={OPTIONS} selectedValue="dark" onValueChange={() => {}} />
    );
    const light = getByRole('radio', { name: 'Light' });

    expect(opacityOf(styleWhen(light as unknown as Node, true))).toBeLessThan(1);
    expect(opacityOf(styleWhen(light as unknown as Node, false))).toBe(1);
  });

  it('draws the chosen segment at full strength once choosing it has re-themed the app', () => {
    // As the theme switcher does: the press itself changes the theme and the
    // whole tree re-renders. Jest cannot reproduce the stranded animation -
    // TouchableOpacity passed this too - so this pins the fixed state; the
    // device check in the PR is what shows the bug gone.
    const ThemeSwitcher = () => {
      const [mode, setMode] = useState<'dark' | 'light'>('dark');
      return (
        <SegmentedControl
          options={OPTIONS}
          selectedValue={mode}
          onValueChange={(value) => {
            setMode(value as 'dark' | 'light');
            useAppStore.setState((st) => ({
              settings: { ...st.settings, themeMode: value as 'dark' | 'light' },
            }));
          }}
        />
      );
    };
    const { getByRole } = renderWithProviders(<ThemeSwitcher />);

    fireEvent.press(getByRole('radio', { name: 'Light' }));

    const chosen = getByRole('radio', { name: 'Light' });
    expect(chosen.props.accessibilityState.selected).toBe(true);
    expect(opacityOf(styleWhen(chosen as unknown as Node, false))).toBe(1);
  });

  it('does not dim a disabled control on press', () => {
    const { getByRole } = renderWithProviders(
      <SegmentedControl options={OPTIONS} selectedValue="dark" onValueChange={() => {}} disabled />
    );

    expect(
      opacityOf(styleWhen(getByRole('radio', { name: 'Light' }) as unknown as Node, true))
    ).toBe(1);
  });

  afterEach(() => {
    useAppStore.setState((st) => ({ settings: { ...st.settings, themeMode: 'dark' } }));
  });
});
