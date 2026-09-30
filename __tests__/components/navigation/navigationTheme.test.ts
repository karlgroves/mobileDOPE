import * as fs from 'fs';
import * as path from 'path';

import { Colors, type ThemeMode } from '../../../src/constants/colors';
import {
  navigationContainerTheme,
  stackHeaderOptions,
  tabBarOptions,
} from '../../../src/navigation/navigationTheme';
import { contrastRatio } from '../../helpers/contrast';

/**
 * The navigator chrome follows the user's theme (#144).
 *
 * Every navigator hard-coded the dark palette. On the light theme, seen on the
 * iOS Simulator, headers and the tab bar stayed #2a2a2a with white titles, and
 * the status bar - dark on the light theme - was dark-on-dark and unreadable.
 */

const MODES: ThemeMode[] = ['dark', 'light', 'nightVision'];

describe.each(MODES)('navigator chrome on %s', (mode) => {
  const colors = Colors[mode];

  it('draws headers on the theme surface, with a readable title and back button', () => {
    const options = stackHeaderOptions(colors);
    const background = options.headerStyle.backgroundColor;

    expect(background).toBe(colors.surface);
    expect(contrastRatio(options.headerTintColor, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('draws the tab bar on the theme surface, with readable labels either way', () => {
    const options = tabBarOptions(colors);
    const background = options.tabBarStyle.backgroundColor;

    expect(background).toBe(colors.surface);
    // The active label is drawn on the bar, or on its own fill where it has one.
    expect(
      contrastRatio(
        options.tabBarActiveTintColor,
        options.tabBarActiveBackgroundColor ?? background
      )
    ).toBeGreaterThanOrEqual(4.5);
    expect(options.tabBarInactiveTintColor).toBe(colors.text.secondary);
    expect(contrastRatio(options.tabBarInactiveTintColor, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('marks the active tab by more than a colour it may share with the others', () => {
    // Night vision's secondary text is its primary red (#148), so a red label
    // cannot mark the active tab there. It is filled instead, as a selected
    // segment is: the fill stands out from the bar (1.4.11, 3:1) and its label
    // reads on it (1.4.3, 4.5:1). A dark-red tint cannot do both: seen on the
    // Simulator, #2a0000 on #1a0000 was near invisible.
    const options = tabBarOptions(colors);
    const bar = options.tabBarStyle.backgroundColor;
    const fill = options.tabBarActiveBackgroundColor;

    if (colors.primaryText === colors.text.secondary) {
      expect(fill).toBeDefined();
      expect(contrastRatio(fill as string, bar)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(options.tabBarActiveTintColor, fill as string)).toBeGreaterThanOrEqual(
        4.5
      );
      expect(options.tabBarActiveTintColor).not.toBe(options.tabBarInactiveTintColor);
    } else {
      // Dark and light keep their look: a different label colour, no fill.
      expect(fill).toBeUndefined();
      expect(options.tabBarActiveTintColor).toBe(colors.primaryText);
    }
  });

  it("gives the navigation container the theme's colours, and says whether it is dark", () => {
    const theme = navigationContainerTheme(colors, mode);

    expect(theme.dark).toBe(mode !== 'light');
    expect(theme.colors.background).toBe(colors.background);
    expect(theme.colors.card).toBe(colors.surface);
    expect(theme.colors.text).toBe(colors.text.primary);
  });
});

describe('no navigator carries its own colours', () => {
  it('has no colour literal in any navigator file', () => {
    // A colour string left in a navigator is how the chrome drifted from the
    // theme. Quoted, so issue references like #144 in comments do not count.
    const dir = path.join(__dirname, '../../../src/navigation');
    const offenders = fs
      .readdirSync(dir)
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) =>
        /['"`]#[0-9a-fA-F]{3,8}['"`]|rgba?\(/.test(fs.readFileSync(path.join(dir, f), 'utf8'))
      );

    expect(offenders).toEqual([]);
  });
});
