/**
 * Color palette for Mobile DOPE App
 * Dark theme is default for field use
 */

export const Colors = {
  // Dark Theme (Primary)
  dark: {
    background: '#1a1a1a',
    surface: '#2a2a2a',
    surfaceVariant: '#3a3a3a',
    primary: '#4CAF50', // Green for primary actions
    primaryDark: '#388E3C',
    // `primary` is a fill. Text in that hue uses primaryText, which holds
    // WCAG AA (4.5:1) on background, surface and the selected-row tint (#114).
    primaryText: '#66BB6A',
    // Text drawn on the primary / error fill, e.g. a Button label (#116).
    onPrimary: '#000000',
    onError: '#000000',
    onSecondary: '#000000',
    secondary: '#FF9800', // Orange for secondary actions
    secondaryDark: '#F57C00',
    accent: '#2196F3', // Blue for accents
    error: '#f44336',
    errorDark: '#d32f2f',
    errorText: '#FF7961', // #f44336 is 3.90:1 on surface
    success: '#4CAF50',
    successText: '#66BB6A',
    warning: '#FF9800',
    warningText: '#FF9800',
    info: '#2196F3',
    text: {
      primary: '#FFFFFF',
      secondary: '#B0B0B0',
      disabled: '#6B6B6B',
    },
    border: '#404040',
    divider: '#333333',
    shadow: '#000000',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  // Light Theme (Optional)
  light: {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    surfaceVariant: '#E0E0E0',
    primary: '#4CAF50',
    primaryDark: '#388E3C',
    primaryText: '#1B5E20', // #4CAF50 is 2.55:1 on surface here
    onPrimary: '#000000', // text.inverse is white here: 2.78:1 on primary
    onError: '#000000',
    onSecondary: '#000000',
    secondary: '#FF9800',
    secondaryDark: '#F57C00',
    accent: '#2196F3',
    error: '#f44336',
    errorDark: '#d32f2f',
    errorText: '#B71C1C',
    success: '#4CAF50',
    successText: '#1B5E20', // same split as primaryText
    warning: '#FF9800',
    warningText: '#9A5B00', // #FF9800 is 1.98:1 on surface
    info: '#2196F3',
    text: {
      primary: '#000000',
      secondary: '#666666',
      disabled: '#9E9E9E',
    },
    border: '#DDDDDD',
    divider: '#E0E0E0',
    shadow: '#000000',
    overlay: 'rgba(0, 0, 0, 0.3)',
  },

  // Night Vision Mode (Red theme for darkness)
  nightVision: {
    background: '#0a0000',
    surface: '#1a0000',
    surfaceVariant: '#2a0000',
    primary: '#ff0000',
    primaryDark: '#cc0000',
    primaryText: '#ff0000',
    onPrimary: '#000000',
    onError: '#000000',
    onSecondary: '#000000',
    secondary: '#ff4444',
    secondaryDark: '#dd0000',
    accent: '#ff6666',
    error: '#ff8888',
    errorDark: '#ff4444',
    errorText: '#ff8888',
    success: '#ff4444',
    successText: '#ff4444',
    warning: '#ff6666',
    warningText: '#ff6666',
    info: '#ff8888',
    text: {
      primary: '#ff0000',
      // The same red as primary: #cc0000 was 3.42:1 on surface, and #ff0000 is
      // the only red that reaches AA on these backgrounds. Secondary text is
      // told apart by size and weight here, not colour (#148).
      secondary: '#ff0000',
      disabled: '#880000',
    },
    border: '#440000',
    divider: '#330000',
    shadow: '#000000',
    overlay: 'rgba(255, 0, 0, 0.1)',
  },

  // Semantic Colors (theme-independent)
  semantic: {
    mil: '#4CAF50', // MIL corrections
    moa: '#2196F3', // MOA corrections
    hit: '#4CAF50', // Successful hit
    miss: '#f44336', // Miss
    yards: '#FF9800', // Yards distance
    meters: '#9C27B0', // Meters distance
  },

  // Chart Colors
  chart: {
    elevation: '#2196F3',
    windage: '#FF9800',
    velocity: '#4CAF50',
    energy: '#9C27B0',
    grid: '#404040',
    gridLight: '#DDDDDD',
  },
};

export type ThemeMode = 'dark' | 'light' | 'nightVision';

export default Colors;
