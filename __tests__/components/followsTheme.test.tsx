import * as fs from 'fs';
import * as path from 'path';

import { fireEvent, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { IconButton } from '../../src/components/IconButton';
import { ListItem } from '../../src/components/ListItem';
import { LoadingSpinner } from '../../src/components/LoadingSpinner';
import { Modal } from '../../src/components/Modal';
import { Picker } from '../../src/components/Picker';
import { SegmentedControl } from '../../src/components/SegmentedControl';
import { UnitToggle } from '../../src/components/UnitToggle';
import { Colors, ThemeMode } from '../../src/constants/colors';
import { useAppStore } from '../../src/store/useAppStore';
import { renderWithProviders } from '../helpers/renderWithProviders';

/**
 * Shared components follow the user's theme (#116).
 *
 * Six of them styled themselves from the static `theme` export, which is
 * `createTheme('dark')`, so on the light and night-vision themes they drew dark
 * colours inside screens that had switched. Each assertion below reads a colour
 * the component resolves at render and compares it to the active palette.
 */

const setMode = (themeMode: ThemeMode) =>
  useAppStore.setState((s) => ({ settings: { ...s.settings, themeMode } }));

const colorOf = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style as object) as {
    color?: string;
    backgroundColor?: string;
    borderColor?: string;
  };

const Throws = () => {
  throw new Error('boom');
};

afterEach(() => setMode('dark'));

describe.each(['light', 'nightVision', 'dark'] as ThemeMode[])('%s theme', (mode) => {
  const c = Colors[mode];
  beforeEach(() => setMode(mode));

  it('Button: primary fill and the text drawn on it', () => {
    const { getByTestId, getByText } = renderWithProviders(
      <Button title="Go" onPress={() => {}} testID="b" />
    );
    expect(colorOf(getByTestId('b')).backgroundColor).toBe(c.primary);
    expect(colorOf(getByText('Go')).color).toBe(c.onPrimary);
  });

  it('Button: secondary outline and label', () => {
    const { getByTestId, getByText } = renderWithProviders(
      <Button title="Go" onPress={() => {}} variant="secondary" testID="b" />
    );
    expect(colorOf(getByTestId('b')).borderColor).toBe(c.primary);
    expect(colorOf(getByText('Go')).color).toBe(c.primaryText);
  });

  it('Button: danger fill and the text drawn on it', () => {
    const { getByTestId, getByText } = renderWithProviders(
      <Button title="Go" onPress={() => {}} variant="danger" testID="b" />
    );
    expect(colorOf(getByTestId('b')).backgroundColor).toBe(c.error);
    expect(colorOf(getByText('Go')).color).toBe(c.onError);
  });

  it('ListItem: surface and text', () => {
    const { getByTestId, getByText } = renderWithProviders(
      <ListItem title="T" subtitle="S" testID="li" />
    );
    expect(colorOf(getByTestId('li')).backgroundColor).toBe(c.surface);
    expect(colorOf(getByText('T')).color).toBe(c.text.primary);
    expect(colorOf(getByText('S')).color).toBe(c.text.secondary);
    expect(colorOf(getByTestId('li-separator')).backgroundColor).toBe(c.border);
  });

  it('ListItem: pressed row darkens to the background colour', () => {
    // RNTL's pressIn does not toggle Pressable's internal pressed state, so call
    // the style function Pressable would call -- found on the nearest ancestor of
    // the row whose `style` is a function -- with pressed: true.
    const { getByTestId } = renderWithProviders(
      <ListItem title="T" onPress={() => {}} testID="li" />
    );
    let node = getByTestId('li').parent;
    while (node && typeof node.props.style !== 'function') node = node.parent;
    const styleFor = node!.props.style as (s: { pressed: boolean }) => unknown;
    expect(colorOf({ props: { style: styleFor({ pressed: false }) } }).backgroundColor).toBe(
      c.surface
    );
    expect(colorOf({ props: { style: styleFor({ pressed: true }) } }).backgroundColor).toBe(
      c.background
    );
  });

  it('LoadingSpinner: indicator and message', () => {
    const { getByTestId, getByText } = renderWithProviders(
      <LoadingSpinner message="Loading" testID="sp" />
    );
    expect(getByTestId('sp').props.color).toBe(c.primary);
    expect(colorOf(getByText('Loading')).color).toBe(c.text.secondary);
  });

  it('EmptyState: title and message', () => {
    const { getByText } = renderWithProviders(<EmptyState title="None" message="Add one" />);
    expect(colorOf(getByText('None')).color).toBe(c.text.primary);
    expect(colorOf(getByText('Add one')).color).toBe(c.text.secondary);
  });

  it('Modal: surface, title and close glyph', () => {
    const { getByText } = renderWithProviders(
      <Modal visible onClose={() => {}} title="Pick">
        <Text>body</Text>
      </Modal>
    );
    expect(colorOf(getByText('Pick')).color).toBe(c.text.primary);
    expect(colorOf(getByText('✕')).color).toBe(c.text.secondary);
    // The dialog box is the nearest ancestor of the title that paints a background.
    let box = getByText('Pick').parent;
    while (box && !colorOf(box).backgroundColor) box = box.parent;
    expect(box && colorOf(box).backgroundColor).toBe(c.surface);
  });

  it('ErrorBoundary: fallback screen', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { getByText } = renderWithProviders(
      <ErrorBoundary>
        <Throws />
      </ErrorBoundary>
    );
    spy.mockRestore();
    expect(colorOf(getByText('Something went wrong')).color).toBe(c.text.primary);
    expect(colorOf(getByText('boom')).color).toBe(c.errorText);
  });
});

/**
 * Text drawn on a coloured fill uses the on-fill token for that fill (#119).
 * `text.inverse` did this job and was white on the light theme, where it fails
 * AA on every fill; it no longer exists.
 */
describe.each(['light', 'nightVision', 'dark'] as ThemeMode[])(
  '%s theme: text on fills',
  (mode) => {
    const c = Colors[mode];
    beforeEach(() => setMode(mode));

    const TWO = [
      { label: 'Yards', value: 'y' },
      { label: 'Meters', value: 'm' },
    ];

    it('SegmentedControl: the selected segment', () => {
      const { getByRole } = renderWithProviders(
        <SegmentedControl options={TWO} selectedValue="y" onValueChange={() => {}} />
      );
      const selected = getByRole('radio', { name: 'Yards' });
      expect(colorOf(selected).backgroundColor).toBe(c.primary);
      expect(colorOf(within(selected).getByText('Yards')).color).toBe(c.onPrimary);
    });

    it('UnitToggle: the selected unit', () => {
      const { getByRole } = renderWithProviders(
        <UnitToggle type="distance" options={TWO} value="y" onValueChange={() => {}} />
      );
      const selected = getByRole('radio', { name: /Yards/ });
      expect(colorOf(selected).backgroundColor).toBe(c.primary);
      expect(colorOf(within(selected).getByText('Yards')).color).toBe(c.onPrimary);
    });

    it('Picker: the selected option', () => {
      const { getByRole } = renderWithProviders(
        <Picker label="Range unit" options={TWO} value="y" onValueChange={() => {}} />
      );
      fireEvent.press(getByRole('button', { name: /Range unit/ }));
      const selected = getByRole('radio', { name: 'Yards' });
      expect(colorOf(selected).backgroundColor).toBe(c.primary);
      expect(colorOf(within(selected).getByText('Yards')).color).toBe(c.onPrimary);
    });

    it.each([
      ['primary', 'primary', 'onPrimary'],
      ['secondary', 'secondary', 'onSecondary'],
      ['danger', 'error', 'onError'],
    ] as const)('IconButton: %s variant', (variant, fill, on) => {
      const { getByText } = renderWithProviders(
        <IconButton icon="+" variant={variant} onPress={() => {}} accessibilityLabel="Add" />
      );
      expect(colorOf(getByText('+')).color).toBe(c[on]);
      let box = getByText('+').parent;
      while (box && !colorOf(box).backgroundColor) box = box.parent;
      expect(box && colorOf(box).backgroundColor).toBe(c[fill]);
    });
  }
);

describe('no component reads the static theme', () => {
  it('nothing but ThemeContext imports from constants/theme', () => {
    // Its exports -- `theme`, `defaultTheme` and the default export -- are all
    // createTheme('dark'). Reading colours from them is how six components ended
    // up ignoring the user's choice; useTheme() is the only source that follows
    // it. Layout values come from Sizes and Typography. Any import form counts,
    // named, default or namespace (#120 review).
    const ALLOWED = path.join('src', 'contexts', 'ThemeContext.tsx');
    const ROOT = path.join(__dirname, '../..');
    const files = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return files(p);
        return /\.tsx?$/.test(e.name) ? [p] : [];
      });
    const STATIC = /(from\s*|require\(\s*)['"][./]*(src\/)?constants\/theme['"]/;

    const offenders = [...files(path.join(ROOT, 'src')), path.join(ROOT, 'App.tsx')]
      .filter((f) => !f.includes(`${path.sep}constants${path.sep}`))
      .filter((f) => STATIC.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f))
      .filter((f) => f !== ALLOWED);

    expect(offenders).toEqual([]);
  });
});
