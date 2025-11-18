import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export type UnitType = 'angular' | 'distance' | 'velocity' | 'temperature' | 'pressure';

export interface UnitToggleOption {
  label: string;
  value: string;
}

export interface UnitToggleProps {
  type: UnitType;
  value: string;
  onValueChange: (value: string) => void;
  options?: UnitToggleOption[];
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

/**
 * UnitToggle component for quickly switching between unit systems
 * Provides preset options for common unit types (MIL/MOA, yards/meters, etc.)
 * Can also accept custom options for other unit types
 */
export const UnitToggle: React.FC<UnitToggleProps> = ({
  type,
  value,
  onValueChange,
  options,
  disabled = false,
  size = 'medium',
  style,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;

  // Preset options for common unit types
  const getPresetOptions = (): UnitToggleOption[] => {
    switch (type) {
      case 'angular':
        return [
          { label: 'MIL', value: 'MIL' },
          { label: 'MOA', value: 'MOA' },
        ];
      case 'distance':
        return [
          { label: 'YD', value: 'yards' },
          { label: 'M', value: 'meters' },
        ];
      case 'velocity':
        return [
          { label: 'FPS', value: 'fps' },
          { label: 'MPS', value: 'mps' },
        ];
      case 'temperature':
        return [
          { label: '°F', value: 'fahrenheit' },
          { label: '°C', value: 'celsius' },
        ];
      case 'pressure':
        return [
          { label: 'inHg', value: 'inHg' },
          { label: 'mbar', value: 'mbar' },
        ];
      default:
        return [];
    }
  };

  const toggleOptions = options || getPresetOptions();

  const sizeStyles = {
    small: { height: 32, fontSize: 14, paddingHorizontal: 8 },
    medium: { height: 44, fontSize: 16, paddingHorizontal: 12 },
    large: { height: 56, fontSize: 18, paddingHorizontal: 16 },
  };

  const currentSize = sizeStyles[size];

  return (
    <View
      style={[
        styles.container,
        { borderColor: colors.border },
        disabled && styles.disabled,
        style,
      ]}
    >
      {toggleOptions.map((option) => {
        const isSelected = option.value === value;

        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.option,
              {
                height: currentSize.height,
                paddingHorizontal: currentSize.paddingHorizontal,
              },
              isSelected && {
                backgroundColor: colors.primary,
              },
            ]}
            onPress={() => !disabled && onValueChange(option.value)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled }}
            accessibilityLabel={`${type} unit: ${option.label}`}
          >
            <Text
              style={[
                styles.optionText,
                { fontSize: currentSize.fontSize },
                isSelected
                  ? { color: colors.text.inverse }
                  : { color: colors.text.primary },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  option: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
