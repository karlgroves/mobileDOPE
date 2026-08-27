import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export interface SegmentedControlOption {
  label: string;
  value: string;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  style?: any;
}

/**
 * SegmentedControl component for switching between discrete options
 * Commonly used for MIL/MOA, yards/meters toggles
 * Features large 44pt touch targets for field use
 */
export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  selectedValue,
  onValueChange,
  disabled = false,
  style,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, borderColor: colors.border },
        disabled && styles.disabled,
        style,
      ]}
      // The options are mutually exclusive, so they need a group to belong to.
      // Without it the individual `radio` roles describe members of nothing.
      accessibilityRole="radiogroup"
      accessibilityState={{ disabled }}
    >
      {options.map((option, index) => {
        const isSelected = option.value === selectedValue;
        const isFirst = index === 0;
        const isLast = index === options.length - 1;

        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.segment,
              isSelected && {
                backgroundColor: colors.primary,
              },
              !isSelected && {
                backgroundColor: colors.surface,
              },
              isFirst && styles.firstSegment,
              isLast && styles.lastSegment,
              index !== 0 && { borderLeftWidth: 0 },
            ]}
            onPress={() => !disabled && onValueChange(option.value)}
            disabled={disabled}
            // `radio` rather than `button`: these are mutually exclusive choices,
            // not independent actions, and `accessibilityState.selected` only
            // reads correctly on a radio. Position ("option 2 of 3") is carried
            // by the hint below -- React Native does not derive it from the role.
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected, disabled }}
            accessibilityLabel={option.label}
            accessibilityHint={`Selects ${option.label}, option ${index + 1} of ${options.length}`}
          >
            <Text
              style={[
                styles.label,
                isSelected ? { color: colors.text.inverse } : { color: colors.text.primary },
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
  segment: {
    flex: 1,
    minHeight: 44, // 44pt minimum for accessibility
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  firstSegment: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  lastSegment: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
