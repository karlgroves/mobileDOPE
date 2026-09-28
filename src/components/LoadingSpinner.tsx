import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

import { Sizes } from '../constants/sizes';
import { Typography } from '../constants/typography';
import { useTheme } from '../contexts/ThemeContext';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'large';
  color?: string;
  testID?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message,
  size = 'large',
  color,
  testID,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color ?? colors.primary} testID={testID} />
      {message && <Text style={[styles.message, { color: colors.text.secondary }]}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Sizes.spacing.lg,
  },
  message: {
    marginTop: Sizes.spacing.md,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
  },
});
