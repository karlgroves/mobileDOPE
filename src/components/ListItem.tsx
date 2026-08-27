import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

interface ListItemProps {
  title: string;
  subtitle?: string;
  rightText?: string;
  onPress?: () => void;
  hideSeparator?: boolean;
  testID?: string;
  /**
   * Overrides the label derived from title/subtitle/rightText. Supply one when the
   * visible text is abbreviated -- "300 / 2.1" reads as digits to a screen reader,
   * where "300 yards, 2.1 mils" does not.
   */
  accessibilityLabel?: string;
  /** What activating the row does, when the title does not already say so. */
  accessibilityHint?: string;
}

export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  rightText,
  onPress,
  hideSeparator = false,
  testID,
  accessibilityLabel,
  accessibilityHint,
}) => {
  // A row reads as one thing, not three. Joining the visible strings keeps the
  // announcement in the order they appear on screen.
  const derivedLabel = [title, subtitle, rightText].filter(Boolean).join(', ');
  const content = (
    <>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        <View style={styles.rightContainer}>
          {rightText && <Text style={styles.rightText}>{rightText}</Text>}
          {onPress && <Text style={styles.chevron}>›</Text>}
        </View>
      </View>
      {!hideSeparator && (
        <View
          style={styles.separator}
          testID={testID ? `${testID}-separator` : 'list-item-separator'}
        />
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.container, pressed && styles.pressed]}
        onPress={onPress}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? derivedLabel}
        accessibilityHint={accessibilityHint}
      >
        {content}
      </Pressable>
    );
  }

  return (
    // Non-interactive rows carry a role but no label: the child <Text> nodes are
    // already announced in reading order, and a grouping label would repeat them.
    <View style={styles.container} testID={testID} accessibilityRole="text">
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    minHeight: theme.listItemHeight.height,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: theme.listItemHeight.height,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: '500',
    color: theme.colors.text.primary,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.secondary,
    marginRight: theme.spacing.sm,
  },
  chevron: {
    fontSize: 24,
    color: theme.colors.text.disabled,
    marginLeft: theme.spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: theme.spacing.md,
  },
  pressed: {
    backgroundColor: theme.colors.background,
  },
});
