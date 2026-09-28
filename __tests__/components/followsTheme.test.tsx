import * as fs from 'fs';
import * as path from 'path';

import { fireEvent } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { ListItem } from '../../src/components/ListItem';
import { LoadingSpinner } from '../../src/components/LoadingSpinner';
import { Modal } from '../../src/components/Modal';
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
    fireEvent.press(getByText('Try Again'));
  });
});

describe('no component reads the static theme', () => {
  it('nothing outside constants/ imports `theme` or `defaultTheme` from constants/theme', () => {
    // The static export is createTheme('dark'). Reading colours from it is how
    // six components ended up ignoring the user's choice; useTheme() is the only
    // source that follows it. Layout values come from Sizes and Typography.
    const ROOT = path.join(__dirname, '../..');
    const files = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return files(p);
        return /\.tsx?$/.test(e.name) ? [p] : [];
      });
    const STATIC =
      /import\s*\{[^}]*\b(theme|defaultTheme)\b[^}]*\}\s*from\s*['"][./]*(src\/)?constants\/theme['"]/;

    const offenders = [...files(path.join(ROOT, 'src')), path.join(ROOT, 'App.tsx')]
      .filter((f) => !f.includes(`${path.sep}constants${path.sep}`))
      .filter((f) => STATIC.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f));

    expect(offenders).toEqual([]);
  });
});
