import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { Sizes } from '../constants/sizes';
import { Typography } from '../constants/typography';
import { useTheme } from '../contexts/ThemeContext';
import { logDistanceInYards } from '../utils/distanceUnits';

import { Card } from './Card';

import type { DOPEOutlier } from '../utils/dopeAnalysis';

/**
 * Logged entries whose correction disagrees with the trend the rest describe
 * (#64).
 *
 * A mis-keyed entry skews the curve and the velocity and BC suggestions beside
 * it, so each row gives the two numbers a shooter needs to judge it: what was
 * logged, and what the other entries imply at that distance. It says
 * "disagree", not "wrong" -- an honest outlier may be the most useful entry in
 * the set, and only the shooter knows which it is.
 *
 * Renders nothing when every entry agrees, so a clean set adds no clutter.
 */

/** Props for {@link OutlierList}. */
export interface OutlierListProps {
  /** Worst first, as `detectOutliers` returns them. */
  outliers: DOPEOutlier[];
  /** The unit `detectOutliers` was asked for, which its values are in. */
  unit: 'MIL' | 'MOA';
}

export const OutlierList: React.FC<OutlierListProps> = ({ outliers, unit }) => {
  const { colors } = useTheme().theme;
  if (outliers.length === 0) return null;

  return (
    <Card style={styles.card}>
      <Text style={[styles.title, { color: colors.text.primary }]} accessibilityRole="header">
        Entries that disagree
      </Text>
      <Text style={[styles.intro, { color: colors.text.secondary }]}>
        {'These sit well off the trend your other entries describe. Check them for a ' +
          'typo before trusting the curve or the suggestions above.'}
      </Text>
      {outliers.map(({ log, expected, actual }) => (
        <Text
          key={log.id ?? `${log.distance}-${log.timestamp ?? ''}`}
          style={[styles.row, { color: colors.text.primary }]}
        >
          {`${Math.round(logDistanceInYards(log))} yds: logged ${actual.toFixed(1)} ${unit}; ` +
            `the other entries imply ${expected.toFixed(1)} ${unit}.`}
        </Text>
      ))}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: Sizes.spacing.md,
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '600',
    marginBottom: Sizes.spacing.xs,
  },
  intro: {
    fontSize: Typography.fontSize.sm,
    marginBottom: Sizes.spacing.sm,
  },
  row: {
    fontSize: Typography.fontSize.md,
    marginTop: Sizes.spacing.xs,
  },
});
