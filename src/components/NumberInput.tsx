import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { TextInput, TextInputProps } from './TextInput';
import { useTheme } from '../contexts/ThemeContext';

export interface NumberInputProps extends Omit<
  TextInputProps,
  'value' | 'onChangeText' | 'keyboardType'
> {
  value: number | undefined;
  onChangeValue: (value: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number; // Number of decimal places
  unit?: string; // e.g., "inches", "yards", "fps"
  showButtons?: boolean; // Show increment/decrement buttons
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChangeValue,
  min,
  max,
  step = 1,
  precision = 0,
  unit,
  showButtons = false,
  disabled = false,
  error,
  ...rest
}) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const [inputText, setInputText] = useState<string>('');

  const formatValue = (num: number | undefined): string => {
    if (num === undefined || num === null || isNaN(num)) {
      return '';
    }
    return num.toFixed(precision);
  };

  const parseValue = (text: string): number | undefined => {
    if (!text || text.trim() === '') {
      return undefined;
    }

    const parsed = parseFloat(text);
    if (isNaN(parsed)) {
      return undefined;
    }

    return parsed;
  };

  const validateValue = (num: number | undefined): number | undefined => {
    if (num === undefined) {
      return undefined;
    }

    let validated = num;

    if (min !== undefined && validated < min) {
      validated = min;
    }

    if (max !== undefined && validated > max) {
      validated = max;
    }

    // Round to precision
    validated = parseFloat(validated.toFixed(precision));

    return validated;
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    const parsed = parseValue(text);
    // Don't validate during typing - just parse
    onChangeValue(parsed);
  };

  const handleBlur = () => {
    // Validate and format on blur
    const validated = validateValue(value);
    onChangeValue(validated);
    setInputText(''); // Clear internal state to use prop value
  };

  const handleIncrement = () => {
    setInputText(''); // Clear to show formatted value
    const newValue = (value ?? 0) + step;
    const validated = validateValue(newValue);
    onChangeValue(validated);
  };

  const handleDecrement = () => {
    setInputText(''); // Clear to show formatted value
    const newValue = (value ?? 0) - step;
    const validated = validateValue(newValue);
    onChangeValue(validated);
  };

  const getErrorMessage = (): string | undefined => {
    if (error) return error;

    if (value !== undefined) {
      if (min !== undefined && value < min) {
        return `Minimum value is ${min}`;
      }
      if (max !== undefined && value > max) {
        return `Maximum value is ${max}`;
      }
    }

    return undefined;
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          {...rest}
          value={inputText || formatValue(value)}
          onChangeText={handleTextChange}
          onBlur={handleBlur}
          keyboardType="decimal-pad"
          disabled={disabled}
          error={getErrorMessage()}
          style={styles.input}
        />

        {unit && <Text style={[styles.unit, { color: colors.text.secondary }]}>{unit}</Text>}

        {showButtons && !disabled && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleDecrement}
              style={[styles.button, { backgroundColor: colors.surface }]}
              disabled={min !== undefined && (value ?? 0) <= min}
            >
              <Text style={[styles.buttonText, { color: colors.text.primary }]}>−</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleIncrement}
              style={[styles.button, { backgroundColor: colors.surface }]}
              disabled={max !== undefined && (value ?? 0) >= max}
            >
              <Text style={[styles.buttonText, { color: colors.text.primary }]}>+</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    paddingRight: 60, // Make room for unit label
  },
  unit: {
    position: 'absolute',
    right: 16,
    top: 40, // Align with input field (accounting for label)
    fontSize: 16,
    fontWeight: '600',
  },
  buttonContainer: {
    position: 'absolute',
    right: 8,
    top: 32,
    flexDirection: 'row',
    gap: 4,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '600',
  },
});
