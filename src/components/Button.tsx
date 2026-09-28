import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, ActivityIndicator, StyleProp } from 'react-native';

import { Sizes } from '../constants/sizes';
import { Typography } from '../constants/typography';
import { useTheme } from '../contexts/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  testID,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const isDisabled = disabled || loading;

  // Colours come from the active theme at render; the StyleSheet holds layout.
  const fill = {
    primary: { backgroundColor: colors.primary },
    secondary: { borderColor: colors.primary },
    danger: { backgroundColor: colors.error },
  }[variant];
  const labelColor = {
    primary: colors.onPrimary,
    secondary: colors.primaryText,
    danger: colors.onError,
  }[variant];

  const handlePress = () => {
    if (!isDisabled) {
      onPress();
    }
  };

  const buttonStyle = [
    styles.button,
    styles[`button_${variant}`],
    fill,
    styles[`button_${size}`],
    isDisabled && styles.button_disabled,
    style,
  ];

  const textStyle = [
    styles.text,
    styles[`text_${variant}`],
    { color: labelColor },
    styles[`text_${size}`],
    isDisabled && styles.text_disabled,
  ];

  return (
    <Pressable
      style={({ pressed }) => [...buttonStyle, pressed && !isDisabled && styles.pressed]}
      onPress={handlePress}
      disabled={isDisabled}
      testID={testID}
      accessible={true}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator
          color={labelColor}
          testID={testID ? `${testID}-spinner` : 'button-spinner'}
        />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: Sizes.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Sizes.touchTarget.default,
  },
  button_primary: {},
  button_secondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  button_danger: {},
  button_small: {
    paddingHorizontal: Sizes.spacing.sm,
    minHeight: Sizes.touchTarget.min,
  },
  button_medium: {
    paddingHorizontal: Sizes.spacing.md,
  },
  button_large: {
    paddingHorizontal: Sizes.spacing.lg,
    minHeight: Sizes.touchTarget.large,
  },
  button_disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    fontWeight: '600',
  },
  text_primary: {
    fontSize: Typography.fontSize.md,
  },
  text_secondary: {
    fontSize: Typography.fontSize.md,
  },
  text_danger: {
    fontSize: Typography.fontSize.md,
  },
  text_small: {
    fontSize: Typography.fontSize.sm,
  },
  text_medium: {
    fontSize: Typography.fontSize.md,
  },
  text_large: {
    fontSize: Typography.fontSize.lg,
  },
  text_disabled: {
    opacity: 1,
  },
});
