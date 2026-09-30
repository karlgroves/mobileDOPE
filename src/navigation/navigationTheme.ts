import { DefaultTheme, type Theme as NavigationTheme } from '@react-navigation/native';

import type { Colors as Palettes, ThemeMode } from '../constants/colors';

/**
 * Navigator chrome - headers, tab bar, the navigation container - from the
 * user's theme (#144).
 *
 * Every navigator used to hard-code the dark palette, so on the light theme the
 * headers and tab bar stayed dark, and the status bar (dark on the light theme)
 * was dark-on-dark. Text uses the text-grade tokens: `primary` (#4CAF50) is
 * 2.55:1 on the light surface, too faint for a tab label.
 */

type Colors = (typeof Palettes)[ThemeMode];

/** Header options shared by every stack navigator. */
export const stackHeaderOptions = (colors: Colors) => ({
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text.primary,
  headerTitleStyle: { fontWeight: 'bold' as const, fontSize: 18 },
});

/** Tab bar colours; the tab navigator adds its safe-area sizing. */
export const tabBarOptions = (colors: Colors) => ({
  tabBarActiveTintColor: colors.primaryText,
  tabBarInactiveTintColor: colors.text.secondary,
  tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
});

/** The NavigationContainer theme: screen and card backgrounds, text, borders. */
export const navigationContainerTheme = (colors: Colors, mode: ThemeMode): NavigationTheme => ({
  ...DefaultTheme,
  dark: mode !== 'light',
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primaryText,
    background: colors.background,
    card: colors.surface,
    text: colors.text.primary,
    border: colors.border,
    notification: colors.error,
  },
});
