/**
 * Main theme configuration
 * Combines colors, typography, and sizes
 */

import { Colors, ThemeMode } from './colors';
import { Typography } from './typography';
import { Sizes } from './sizes';

export interface Theme {
  mode: ThemeMode;
  colors: typeof Colors.dark;
  typography: typeof Typography;
  spacing: typeof Sizes.spacing;
  borderRadius: typeof Sizes.borderRadius;
  touchTargets: typeof Sizes.touchTarget;
  iconSizes: typeof Sizes.icon;
  listItemHeight: typeof Sizes.listItem;
  isDark: boolean;
}

export const createTheme = (mode: ThemeMode = 'dark'): Theme => {
  const colors = Colors[mode];
  const isDark = mode === 'dark' || mode === 'nightVision';

  return {
    mode,
    colors,
    typography: Typography,
    spacing: Sizes.spacing,
    borderRadius: Sizes.borderRadius,
    touchTargets: Sizes.touchTarget,
    iconSizes: Sizes.icon,
    listItemHeight: Sizes.listItem,
    isDark,
  };
};

// Default dark theme
export const defaultTheme = createTheme('dark');

// Export as 'theme' for convenience
export const theme = defaultTheme;

// Theme type
export type AppTheme = typeof defaultTheme;

export default defaultTheme;
