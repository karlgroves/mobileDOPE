import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { Sizes } from '../constants/sizes';
import { Typography } from '../constants/typography';
import { useTheme } from '../contexts/ThemeContext';

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
  const { theme } = useTheme();
  const { colors } = theme;
  // A row reads as one thing, not three. Joining the visible strings keeps the
  // announcement in the order they appear on screen.
  const derivedLabel = [title, subtitle, rightText].filter(Boolean).join(', ');
  const content = (
    <>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.text.secondary }]}>{subtitle}</Text>
          )}
        </View>
        <View style={styles.rightContainer}>
          {rightText && (
            <Text style={[styles.rightText, { color: colors.text.secondary }]}>{rightText}</Text>
          )}
          {onPress && <Text style={[styles.chevron, { color: colors.text.disabled }]}>›</Text>}
        </View>
      </View>
      {!hideSeparator && (
        <View
          style={[styles.separator, { backgroundColor: colors.border }]}
          testID={testID ? `${testID}-separator` : 'list-item-separator'}
        />
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.container,
          { backgroundColor: pressed ? colors.background : colors.surface },
        ]}
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
    <View
      style={[styles.container, { backgroundColor: colors.surface }]}
      testID={testID}
      accessibilityRole="text"
    >
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: Sizes.listItem.height,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Sizes.spacing.md,
    paddingVertical: Sizes.spacing.sm,
    minHeight: Sizes.listItem.height,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: Typography.fontSize.md,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    marginTop: 2,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightText: {
    fontSize: Typography.fontSize.md,
    marginRight: Sizes.spacing.sm,
  },
  chevron: {
    fontSize: 24,
    marginLeft: Sizes.spacing.sm,
  },
  separator: {
    height: 1,
    marginLeft: Sizes.spacing.md,
  },
});
