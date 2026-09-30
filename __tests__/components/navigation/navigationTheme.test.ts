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
    expect(contrastRatio(options.tabBarActiveTintColor, background)).toBeGreaterThanOrEqual(4.5);
    // Inactive labels use the theme's own secondary text. Night vision's is
    // 3.42:1 everywhere in the app, not just here: #148, a palette decision.
    expect(options.tabBarInactiveTintColor).toBe(colors.text.secondary);
    if (mode !== 'nightVision') {
      expect(contrastRatio(options.tabBarInactiveTintColor, background)).toBeGreaterThanOrEqual(
        4.5
      );
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
