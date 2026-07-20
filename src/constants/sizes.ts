/**
 * Size constants for Mobile DOPE App
 * Large touch targets and spacing for field use
 */

export const Sizes = {
  // Touch Targets (minimum 44pt for accessibility)
  touchTarget: {
    min: 44, // Minimum touch target size
    default: 56, // Standard button height
    large: 72, // Large field buttons
  },

  // Spacing Scale
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
  },

  // Border Radius
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  // Border Width
  borderWidth: {
    thin: 1,
    default: 2,
    thick: 3,
  },

  // Icon Sizes
  icon: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 48,
  },

  // Input Heights
  input: {
    small: 44,
    default: 56,
    large: 72,
  },

  // Card/Container Padding
  container: {
    padding: {
      sm: 12,
      md: 16,
      lg: 24,
    },
    margin: {
      sm: 8,
      md: 16,
      lg: 24,
    },
  },

  // Screen Breakpoints
  breakpoint: {
    phone: 0,
    tablet: 768,
  },

  // Modal/Dialog
  modal: {
    maxWidth: 600,
    padding: 24,
  },

  // List Items
  listItem: {
    height: 64, // Comfortable list item height
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  // Elevation/Shadow
  elevation: {
    none: 0,
    low: 2,
    medium: 4,
    high: 8,
    veryHigh: 16,
  },
};

export default Sizes;
