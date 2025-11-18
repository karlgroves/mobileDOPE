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
    secondary: '#FF9800', // Orange for secondary actions
    secondaryDark: '#F57C00',
    accent: '#2196F3', // Blue for accents
    error: '#f44336',
    errorDark: '#d32f2f',
    success: '#4CAF50',
    warning: '#FF9800',
    info: '#2196F3',
    text: {
      primary: '#FFFFFF',
      secondary: '#B0B0B0',
      disabled: '#6B6B6B',
      inverse: '#000000',
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
    secondary: '#FF9800',
    secondaryDark: '#F57C00',
    accent: '#2196F3',
    error: '#f44336',
    errorDark: '#d32f2f',
    success: '#4CAF50',
    warning: '#FF9800',
    info: '#2196F3',
    text: {
      primary: '#000000',
      secondary: '#666666',
      disabled: '#9E9E9E',
      inverse: '#FFFFFF',
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
    secondary: '#ff4444',
    secondaryDark: '#dd0000',
    accent: '#ff6666',
    error: '#ff8888',
    errorDark: '#ff4444',
    success: '#ff4444',
    warning: '#ff6666',
    info: '#ff8888',
    text: {
      primary: '#ff0000',
      secondary: '#cc0000',
      disabled: '#880000',
      inverse: '#000000',
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
