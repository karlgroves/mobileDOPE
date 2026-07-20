import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export interface IconButtonProps {
  onPress: () => void;
  icon: string; // Unicode character or emoji
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export const IconButton: React.FC<IconButtonProps> = ({
  onPress,
  icon,
  size = 'medium',
  variant = 'ghost',
  disabled = false,
  accessibilityLabel,
  style,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;

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

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
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
