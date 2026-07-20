import React from 'react';
import {
  TextInput as RNTextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps as RNTextInputProps,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export interface TextInputProps extends Omit<RNTextInputProps, 'editable'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  value,
  onChangeText,
  error,
  helperText,
  required = false,
  disabled = false,
  style,
  ...rest
}) => {
  const { theme } = useTheme();
  const { colors } = theme;

  const inputStyles = [
    styles.input,
    {
      backgroundColor: colors.surface,
      borderColor: error ? colors.error : colors.border,
      color: colors.text.primary,
    },
    disabled && { opacity: 0.5 },
    style,
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text.primary }]}>
        {label}
        {required && ' *'}
      </Text>

      <RNTextInput
        style={inputStyles}
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        placeholderTextColor={colors.text.secondary}
        {...rest}
      />

      {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
      {helperText && !error && (
        <Text style={[styles.helperText, { color: colors.text.secondary }]}>{helperText}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    minHeight: 48, // 48pt minimum for accessibility
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    marginTop: 4,
  },
  helperText: {
    fontSize: 14,
    marginTop: 4,
  },
});
