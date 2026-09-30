import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Sizes } from '../constants/sizes';
import { Typography } from '../constants/typography';
import { useTheme } from '../contexts/ThemeContext';

import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  icon,
  actionLabel,
  onAction,
  testID,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View style={styles.container} testID={testID}>
      {icon && (
        <Text style={styles.icon} testID={testID ? `${testID}-icon` : 'empty-state-icon'}>
          {icon}
        </Text>
      )}
      <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
      {message && <Text style={[styles.message, { color: colors.text.secondary }]}>{message}</Text>}
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} variant="primary" style={styles.button} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Sizes.spacing.xl,
  },
  icon: {
    fontSize: 64,
    marginBottom: Sizes.spacing.md,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '600',
    marginBottom: Sizes.spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    marginBottom: Sizes.spacing.lg,
  },
  button: {
    marginTop: Sizes.spacing.md,
    minWidth: 200,
  },
});
