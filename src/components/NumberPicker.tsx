import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export interface NumberPickerProps {
  label: string;
  value: number | undefined;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  presets?: number[];
  disabled?: boolean;
  error?: string;
  helperText?: string;
  style?: any;
}

/**
 * NumberPicker component for selecting numeric values from a list
 * Optimized for field use with large touch targets
 * Commonly used for distance selection with presets (100, 200, 300, 400, 500, 600)
 */
export const NumberPicker: React.FC<NumberPickerProps> = ({
  label,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  unit,
  presets,
  disabled = false,
  error,
  helperText,
  style,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const [isOpen, setIsOpen] = useState(false);

  // Generate list of values
  const generateValues = (): number[] => {
    if (presets && presets.length > 0) {
      return presets.filter((v) => v >= min && v <= max);
    }

    const values: number[] = [];
    for (let v = min; v <= max; v += step) {
      values.push(v);
    }
    return values;
  };

  const values = generateValues();

  const handleSelect = (selectedValue: number) => {
    onValueChange(selectedValue);
    setIsOpen(false);
  };

  const displayValue = value !== undefined ? `${value}${unit ? ` ${unit}` : ''}` : 'Select';

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.label, { color: colors.text.primary }]}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.selector,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : colors.border,
          },
          disabled && styles.disabled,
        ]}
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${displayValue}`}
      >
        <Text
          style={[
            styles.selectorText,
            {
              color: value !== undefined ? colors.text.primary : colors.text.secondary,
            },
          ]}
        >
          {displayValue}
        </Text>
        <Text style={[styles.chevron, { color: colors.text.secondary }]}>▼</Text>
      </TouchableOpacity>

      {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
      {helperText && !error && (
        <Text style={[styles.helperText, { color: colors.text.secondary }]}>{helperText}</Text>
      )}

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>{label}</Text>
              <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeButton}>
                <Text style={[styles.closeButtonText, { color: colors.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={values}
              keyExtractor={(item) => item.toString()}
              renderItem={({ item }) => {
                const isSelected = item === value;
                return (
                  <TouchableOpacity
                    style={[
                      styles.option,
                      isSelected && { backgroundColor: colors.primary + '20' },
                    ]}
                    onPress={() => handleSelect(item)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color: isSelected ? colors.primary : colors.text.primary,
                          fontWeight: isSelected ? '600' : '400',
                        },
                      ]}
                    >
                      {item}{unit ? ` ${unit}` : ''}
                    </Text>
                    {isSelected && (
                      <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => (
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  selector: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  selectorText: {
    fontSize: 16,
    flex: 1,
  },
  chevron: {
    fontSize: 12,
    marginLeft: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 14,
    marginTop: 4,
  },
  helperText: {
    fontSize: 14,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34, // Account for safe area
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 56, // Large touch target for field use
  },
  optionText: {
    fontSize: 18,
  },
  checkmark: {
    fontSize: 20,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    marginHorizontal: 16,
  },
});
