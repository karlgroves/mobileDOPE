import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';

export interface IconButtonProps {
  onPress: () => void;
  icon: string; // Unicode character or emoji
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  /**
   * Required. The icon is a bare glyph, so this is the only thing a screen reader
   * has to work with -- without it the control announces as "button" and nothing
   * more. Name the action and its subject: "Delete rifle profile", not "Delete".
   */
  accessibilityLabel: string;
  /**
   * What happens on activation, when that is not obvious from the label alone.
   * Omit rather than restating the label.
   */
  accessibilityHint?: string;
  style?: ViewStyle;
}

export const IconButton: React.FC<IconButtonProps> = ({
  onPress,
  icon,
  size = 'medium',
  variant = 'ghost',
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;

  // Apple HIG minimum, and the figure this project set for itself (#68).
  const MIN_TOUCH_TARGET = 44;

  const sizeMap = {
    small: {
      width: 36,
      height: 36,
      iconSize: 18,
    },
    medium: {
      width: 44,
      height: 44,
      iconSize: 22,
    },
    large: {
      width: 56,
      height: 56,
      iconSize: 28,
    },
  };

  const variantStyles: Record<string, { bg: string; color: string }> = {
    primary: {
      bg: colors.primary,
      color: colors.text.inverse,
    },
    secondary: {
      bg: colors.secondary,
      color: colors.text.inverse,
    },
    danger: {
      bg: colors.error,
      color: colors.text.inverse,
    },
    ghost: {
      bg: 'transparent',
      color: colors.text.primary,
    },
  };

  const sizeStyle = sizeMap[size];
  const variantStyle = variantStyles[variant];

  const buttonStyles = [
    styles.button,
    {
      width: sizeStyle.width,
      height: sizeStyle.height,
      backgroundColor: variantStyle.bg,
    },
    disabled && { opacity: 0.5 },
    style,
  ];

  const iconStyles: TextStyle = {
    fontSize: sizeStyle.iconSize,
    color: variantStyle.color,
  };

  // Expand the touch area to the 44x44pt minimum without growing the button.
  // The `small` variant is 36x36 by design -- it has to fit in list rows and chart
  // toolbars -- so the missing 8pt is made up with hitSlop rather than by making
  // the icon bigger. See __tests__/components/touchTargets.test.tsx (#68).
  const slop = Math.max(0, (MIN_TOUCH_TARGET - sizeStyle.height) / 2);
  const hitSlop = { top: slop, bottom: slop, left: slop, right: slop };

  return (
    <TouchableOpacity
      style={buttonStyles}
      hitSlop={hitSlop}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={iconStyles}>{icon}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
