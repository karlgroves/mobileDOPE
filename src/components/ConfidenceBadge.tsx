import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';

import type { DOPEConfidence } from '../utils/dopeAnalysis';

/**
 * How well-evidenced a logged DOPE point is (#64).
 *
 * `calculateConfidence` scores the evidence a log carries -- shot count, hit
 * rate, group size -- not whether it agrees with the solver. A point that
 * disagrees with the model may be the most valuable entry in the set; that
 * disagreement is the whole reason for keeping DOPE. So the wording here is
 * about how well *observed* the point is, never about whether it is "right".
 *
 * The reasons are shown rather than summarised away. A bare number invites the
 * shooter to trust or distrust a log without knowing why, and the reasons are
 * the part they can act on -- "only 1 shot" tells you to go shoot it again.
 */

/** Thresholds for the three bands. Shared with the label and the colour. */
const STRONG = 0.7;
const MODERATE = 0.45;

/** The band a score falls in, as a word rather than a number. */
export const confidenceBand = (score: number): 'Strong' | 'Moderate' | 'Weak' => {
  if (score >= STRONG) return 'Strong';
  if (score >= MODERATE) return 'Moderate';
  return 'Weak';
};

export interface ConfidenceBadgeProps {
  confidence: DOPEConfidence;
  testID?: string;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ confidence, testID }) => {
  const { theme } = useTheme();
  const { colors } = theme;

  const band = confidenceBand(confidence.score);
  const percent = Math.round(confidence.score * 100);

  // The bar's colour, not the text's. Measured against both surfaces at 18px
  // bold -- which is 13.5pt, below WCAG's 14pt-bold large-text threshold, so it
  // needs 4.5:1 as normal text:
  //
  //             on dark #2a2a2a   on light #F5F5F5
  //   success        5.16              2.55
  //   warning        6.66              1.98
  //   error          3.90              3.38
  //
  // Four of six fail, every one of them in the light theme. The band word is
  // therefore drawn in the theme's own text colour, and the tint is kept for the
  // bar. Nothing is lost: the word already carries the meaning, so the colour
  // was redundant -- which is what makes it safe to demote rather than fix by
  // picking six new hex values.
  const tint =
    band === 'Strong' ? colors.success : band === 'Moderate' ? colors.warning : colors.error;

  // One label for the whole badge rather than a screen reader walking a number,
  // a word and a list of fragments separately. Per ADR-009 the real check is
  // manual on a device; this is the part that can be got right in code.
  const label = `Confidence ${band}, ${percent} percent. ${confidence.reasons.join('. ')}`;

  return (
    <View
      testID={testID}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={label}
      accessibilityHint="How well evidenced this log is, from its shot count, hit rate and group size"
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={[styles.band, { color: colors.text.primary }]}>{band}</Text>
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
