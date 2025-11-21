import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, ActivityIndicator, StyleProp } from 'react-native';
import { theme } from '../constants/theme';

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
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (!isDisabled) {
      onPress();
    }
  };

  const buttonStyle = [
    styles.button,
    styles[`button_${variant}`],
    styles[`button_${size}`],
    isDisabled && styles.button_disabled,
    style,
  ];

  const textStyle = [
    styles.text,
    styles[`text_${variant}`],
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
          color={variant === 'primary' ? theme.colors.text.inverse : theme.colors.primary}
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
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.touchTargets.default,
  },
  button_primary: {
    backgroundColor: theme.colors.primary,
  },
  button_secondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  button_danger: {
    backgroundColor: theme.colors.error,
  },
  button_small: {
    paddingHorizontal: theme.spacing.sm,
    minHeight: theme.touchTargets.min,
  },
  button_medium: {
    paddingHorizontal: theme.spacing.md,
  },
  button_large: {
    paddingHorizontal: theme.spacing.lg,
    minHeight: theme.touchTargets.large,
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
    color: theme.colors.text.inverse,
    fontSize: theme.typography.fontSize.md,
  },
  text_secondary: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.md,
  },
  text_danger: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.fontSize.md,
  },
  text_small: {
    fontSize: theme.typography.fontSize.sm,
  },
  text_medium: {
    fontSize: theme.typography.fontSize.md,
  },
  text_large: {
    fontSize: theme.typography.fontSize.lg,
  },
  text_disabled: {
    opacity: 1,
  },
});
