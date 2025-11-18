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
  sizes: typeof Sizes;
  isDark: boolean;
}

export const createTheme = (mode: ThemeMode = 'dark'): Theme => {
  const colors = Colors[mode];
  const isDark = mode === 'dark' || mode === 'nightVision';

  return {
    mode,
    colors,
    typography: Typography,
    sizes: Sizes,
    isDark,
  };
};

// Default dark theme
export const defaultTheme = createTheme('dark');

// Theme type
export type AppTheme = typeof defaultTheme;

export default defaultTheme;
