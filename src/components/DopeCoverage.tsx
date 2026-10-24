import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import { coverageGaps } from '../utils/offsetInterpolation';

import { Card } from './Card';

/**
 * Which distances this rifle and load have DOPE at, and where the holes are (#162).
 *
 * The DOPE Curve already draws the logged points; what it does not say is which
 * distances are *missing*. That is the actionable half: a shooter cannot act on
 * "this recommendation was interpolated", but they can act on "you have nothing
 * between 300 and 700 yards".
 *
 * The gaps come from `coverageGaps`, so the list here and the interpolation the
 * solution screen performs are reading the same logged distances — a coverage
 * display that disagreed with where the app will actually interpolate would be
 * worse than none.
 *
 * Nothing is colour-coded. A gap is a fact about the data, not a warning, and
 * reading it does not depend on telling two tints apart (WCAG 1.4.1).
 *
 * It draws its own `Card` and returns null when there is no DOPE to describe, so
 * the screen renders it unconditionally. A `{logs.length > 0 && ...}` guard at
 * the call site would duplicate the emptiness check this component already makes
 * and add a branch to a screen that is already over its complexity budget.
 */

/** Gaps narrower than this are not worth a practice session. */
export const COVERAGE_TOLERANCE_YARDS = 150;

/** What the coverage summary needs: the distances that have logs. */
export interface DopeCoverageProps {
  /** One entry per logged distance, in yards. Extra fields are ignored. */
  points: { distance: number }[];
  testID?: string;
}

/** "100, 300 and 600 yd" -- read out, not abbreviated to a count. */
const listDistances = (distances: number[]): string => {
  if (distances.length === 1) return `${distances[0]} yd`;
  const head = distances.slice(0, -1).join(', ');
  return `${head} and ${distances[distances.length - 1]} yd`;
};

export const DopeCoverage: React.FC<DopeCoverageProps> = ({ points, testID }) => {
  const { theme } = useTheme();
  const { colors } = theme;

  const distances = [...new Set(points.map((p) => p.distance).filter((d) => d > 0))].sort(
    (a, b) => a - b
  );
  const gaps = coverageGaps(points, COVERAGE_TOLERANCE_YARDS);

  if (distances.length === 0) return null;

  const covered = `You have DOPE at ${listDistances(distances)}.`;
  const toPractise =
    gaps.length === 0
      ? 'No gaps worth filling — your logged distances are close enough together to interpolate between.'
      : `Worth practising: ${gaps.map((g) => `${g.from}–${g.to} yd`).join(', ')}.`;

  return (
    <Card style={styles.card}>
      <View
        testID={testID}
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel={`${covered} ${toPractise}`}
        accessibilityHint="Which distances this rifle and load have logged DOPE at, and where the gaps are"
        style={styles.container}
      >
        <Text style={[styles.heading, { color: colors.text.primary }]}>Distance coverage</Text>
        <Text style={[styles.line, { color: colors.text.secondary }]}>{covered}</Text>
        <Text style={[styles.line, { color: colors.text.secondary }]}>{toPractise}</Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  container: {
    gap: 4,
  },
  heading: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  line: {
    fontSize: 13,
  },
});
