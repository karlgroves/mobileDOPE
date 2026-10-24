import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';

import { confidenceBand } from './ConfidenceBadge';

import type { AdjustmentConfidence } from '../utils/adjustmentConfidence';

/**
 * How much the DOPE-adjusted recommendation is worth believing (#161).
 *
 * The same visual language as {@link ConfidenceBadge}, which shows the per-log
 * confidence #112 scores: a band word, a percentage, a tinted bar and the
 * reasons underneath. Two confidence figures that looked different would read
 * as two different kinds of thing, and they are not — they are the same kind of
 * claim at two scales, one about a log and one about the recommendation drawn
 * from several.
 *
 * `confidenceBand` and the thresholds come from that component rather than
 * being restated here, so the two can never drift into calling the same 0.68
 * "Moderate" in one place and "Strong" in the other.
 *
 * **Colour is never the only signal** (WCAG 1.4.1). The band word carries the
 * meaning in the theme's own text colour; the tint is on the bar, which is
 * hidden from the screen reader because the accessible label already states
 * the band, the figure and every reason. The measured contrast ratios behind
 * that decision are recorded on `ConfidenceBadge`.
 */

/** What the badge needs to describe one adjustment's confidence. */
export interface AdjustmentConfidenceBadgeProps {
  confidence: AdjustmentConfidence;
  /** True when the figure was below the threshold and the solver stands alone. */
  solverOnly?: boolean;
  testID?: string;
}

export const AdjustmentConfidenceBadge: React.FC<AdjustmentConfidenceBadgeProps> = ({
  confidence,
  solverOnly = false,
  testID,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;

  const band = confidenceBand(confidence.score);
  const percent = Math.round(confidence.score * 100);

  const tint =
    band === 'Strong' ? colors.success : band === 'Moderate' ? colors.warning : colors.error;

  // One label for the whole badge, so the screen reader reads a sentence rather
  // than walking a word, a number and a list of fragments separately. The
  // solver-only state is said first because it is the part that changes what
  // the shooter should dial. Per ADR-009 the real check is manual on a device.
  const label =
    `Adjustment confidence ${band}, ${percent} percent. ` +
    (solverOnly ? 'Too low to apply; showing the solver alone. ' : '') +
    confidence.reasons.join('. ');

  return (
    <View
      testID={testID}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={label}
      accessibilityHint="How much your logs agree about this shot, and how near they were shot to this distance"
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={[styles.band, { color: colors.text.primary }]}>
          {band}
          {solverOnly ? ' — not applied' : ''}
        </Text>
        <Text style={[styles.percent, { color: colors.text.secondary }]}>{percent}%</Text>
      </View>

      {/* Decorative: the accessible label above already carries the figure. */}
      <View
        style={[styles.track, { backgroundColor: colors.border }]}
        accessibilityElementsHidden={true}
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.fill, { backgroundColor: tint, width: `${percent}%` }]} />
      </View>

      {confidence.reasons.map((reason) => (
        <Text key={reason} style={[styles.reason, { color: colors.text.secondary }]}>
          {reason}
        </Text>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  header: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  band: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: 'bold',
  },
  percent: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  track: {
    borderRadius: 3,
    height: 6,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: '100%',
  },
  reason: {
    fontSize: 13,
  },
});
