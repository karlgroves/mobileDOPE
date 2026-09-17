import { render } from '@testing-library/react-native';
import React from 'react';

import { IconButton } from '../../src/components/IconButton';
import { UnitToggle } from '../../src/components/UnitToggle';
import { ThemeProvider } from '../../src/contexts/ThemeContext';

/**
 * Touch targets must be at least 44x44 points (#68).
 *
 * That is Apple's HIG minimum and the figure this project set for itself. It is
 * also stricter than WCAG 2.2 SC 2.5.8, which asks for 24x24 CSS px — the larger
 * number is the right one for a field app operated in gloves, in the cold, prone,
 * by someone who is not looking at the screen.
 *
 * What matters is the **effective** target: the rendered size plus any `hitSlop`.
 * React Native's `hitSlop` expands the touchable area without changing the visual
 * size, which is how a deliberately small control can still be reliably hittable.
 * Testing the visual size alone would force every icon to be 44pt of ink, which is
 * not what the guidance asks for.
 *
 * `small` variants of IconButton (36x36) and UnitToggle (32 high) sit below the
 * minimum on their own, and are used on eight screens. This is what pins the
 * compensation in place.
 */

const SIZES = ['small', 'medium', 'large'] as const;
const MIN_TARGET = 44;

/** Flattens a style prop, which may be an array, into one object. */
const flatten = (style: unknown): Record<string, number> =>
  Array.isArray(style)
    ? Object.assign({}, ...style.flat(Infinity).filter(Boolean))
    : ((style || {}) as Record<string, number>);

/**
 * Effective touch dimensions: rendered box plus hitSlop on each axis.
 *
 * `hitSlop` may be a number (all sides) or per-side. Both are normalised here so a
 * component can use either.
 */
const effectiveTarget = (props: Record<string, unknown>): { width: number; height: number } => {
  const style = flatten(props.style);
  const slop = props.hitSlop;
  const sides =
    typeof slop === 'number'
      ? { top: slop, bottom: slop, left: slop, right: slop }
      : ((slop || {}) as Record<string, number>);

  const width = (style.width ?? style.minWidth ?? 0) + (sides.left ?? 0) + (sides.right ?? 0);
  const height = (style.height ?? style.minHeight ?? 0) + (sides.top ?? 0) + (sides.bottom ?? 0);
  return { width, height };
};

const withTheme = (node: React.ReactElement) => render(<ThemeProvider>{node}</ThemeProvider>);

describe('touch target sizes', () => {
  describe('IconButton', () => {
    it.each(SIZES)('%s meets the 44pt minimum on both axes', (size) => {
      const { getByRole } = withTheme(
        <IconButton icon="×" accessibilityLabel="Close" onPress={() => {}} size={size} />
      );

      const { width, height } = effectiveTarget(getByRole('button').props);

      expect(width).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(height).toBeGreaterThanOrEqual(MIN_TARGET);
    });
  });

  describe('UnitToggle', () => {
    it.each(SIZES)('%s meets the 44pt minimum in height', (size) => {
      const { getAllByRole } = withTheme(
        <UnitToggle type="distance" value="yards" onValueChange={() => {}} size={size} />
      );

      // Each option is separately tappable, so each one has to clear the minimum.
      for (const option of getAllByRole('radio')) {
        expect(effectiveTarget(option.props).height).toBeGreaterThanOrEqual(MIN_TARGET);
      }
    });
  });
});
