import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Sizes } from '../constants/sizes';
import { Typography } from '../constants/typography';
import { useTheme } from '../contexts/ThemeContext';
import {
  MIN_DISTANCES_FOR_BC,
  MIN_DISTANCES_FOR_VELOCITY,
  MIN_SPAN_YARDS_FOR_BC,
} from '../utils/inputCorrections';

import { Button } from './Button';
import { Card } from './Card';

import type { InputCorrection } from '../utils/dopeAnalysis';
import type { InputCorrections } from '../utils/inputCorrections';

/**
 * What logged DOPE says about the load's muzzle velocity and BC (#64).
 *
 * Suggestions only. Apply reports the input and value; the screen confirms with
 * the shooter before touching the ammo profile, because a wrong velocity moves
 * every solution after it. Each suggestion shows its reasoning and confidence
 * so the shooter can judge it rather than take it on trust.
 */

/** The ammo-profile inputs a suggestion can change. */
export type CorrectableInput = 'muzzleVelocity' | 'ballisticCoefficient';

/** Props for {@link InputCorrectionsCard}. */
export interface InputCorrectionsCardProps {
  /** Nothing is rendered without them, e.g. before the profiles load. */
  corrections: InputCorrections | undefined;
  onApply: (input: CorrectableInput, value: number) => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const soFar = ({ distanceCount, spanYards }: InputCorrections) =>
  `So far: ${plural(distanceCount, 'distance')}` +
  (distanceCount > 1 ? `, spanning ${spanYards} yards.` : '.');

/** The message for a status with nothing to apply, or undefined when there are suggestions. */
const statusMessage = (corrections: InputCorrections): string | undefined => {
  if (corrections.status === 'insufficient') {
    return (
      `Log DOPE at ${MIN_DISTANCES_FOR_VELOCITY} or more distances to check muzzle ` +
      `velocity, and ${MIN_DISTANCES_FOR_BC} or more across ${MIN_SPAN_YARDS_FOR_BC} ` +
      `yards to check BC. ${soFar(corrections)}`
    );
  }
  if (corrections.status === 'agrees') {
    return (
      `Your logged DOPE at ${plural(corrections.distanceCount, 'distance')} agrees with ` +
      'the solver. No change to muzzle velocity or BC is suggested.'
    );
  }
  return undefined;
};

/** Why BC is missing from a set of suggestions, when the data is too narrow to check it. */
const bcNote = (corrections: InputCorrections): string | undefined =>
  !corrections.ballisticCoefficient &&
  (corrections.distanceCount < MIN_DISTANCES_FOR_BC ||
    corrections.spanYards < MIN_SPAN_YARDS_FOR_BC)
    ? `The BC check needs ${MIN_DISTANCES_FOR_BC} or more distances across ` +
      `${MIN_SPAN_YARDS_FOR_BC} yards. ${soFar(corrections)}`
    : undefined;

/** Logs left out for want of a snapshot, when there are any. */
const leftOutNote = ({ withoutConditions: n }: InputCorrections): string | undefined =>
  n > 0
    ? `${plural(n, 'log')} ${n === 1 ? 'has' : 'have'} no recorded conditions and ` +
      `${n === 1 ? 'was' : 'were'} not used: comparing ${n === 1 ? 'it' : 'them'} with ` +
      'a standard day would read unusual weather as a velocity or BC error.'
    : undefined;

/** One suggested change: what, from and to, how sure, why, and the action. */
const Suggestion: React.FC<{
  label: string;
  change: string;
  /** The change in words: an arrow is read aloud as "right arrow". */
  spoken: string;
  correction: InputCorrection;
  action: string;
  onPress: () => void;
}> = ({ label, change, spoken, correction, action, onPress }) => {
  const { colors } = useTheme().theme;
  return (
    <View style={styles.suggestion}>
      <Text style={[styles.label, { color: colors.text.secondary }]}>{label}</Text>
      <Text
        style={[styles.change, { color: colors.primaryText }]}
        accessibilityLabel={`${label}: ${spoken}`}
        accessibilityHint="Suggested by your logged DOPE. The button below applies it."
      >
        {change}
      </Text>
      <Text style={[styles.meta, { color: colors.text.secondary }]}>
        {`Confidence ${Math.round(correction.confidence * 100)}%`}
      </Text>
      <Text style={[styles.body, { color: colors.text.primary }]}>{correction.rationale}</Text>
      <Button title={action} onPress={onPress} variant="secondary" size="small" />
    </View>
  );
};

export const InputCorrectionsCard: React.FC<InputCorrectionsCardProps> = ({
  corrections,
  onApply,
}) => {
  const { colors } = useTheme().theme;
  if (!corrections) return null;
  const { muzzleVelocity: mv, ballisticCoefficient: bc } = corrections;
  const message = statusMessage(corrections);
  const note = message ? undefined : bcNote(corrections);
  const leftOut = leftOutNote(corrections);

  return (
    <Card style={styles.card}>
      <Text style={[styles.title, { color: colors.text.primary }]} accessibilityRole="header">
        Solver inputs
      </Text>
      {message && <Text style={[styles.body, { color: colors.text.primary }]}>{message}</Text>}
      {mv && (
        <Suggestion
          label="Muzzle velocity"
          change={`${mv.current} → ${mv.suggested} fps`}
          spoken={`from ${mv.current} to ${mv.suggested} fps`}
          correction={mv}
          action={`Use ${mv.suggested} fps`}
          onPress={() => onApply('muzzleVelocity', mv.suggested)}
        />
      )}
      {bc && (
        <Suggestion
          label={`${bc.dragModel} BC`}
          change={`${bc.current} → ${bc.suggested}`}
          spoken={`from ${bc.current} to ${bc.suggested}`}
          correction={bc}
          action={`Use ${bc.dragModel} BC ${bc.suggested}`}
          onPress={() => onApply('ballisticCoefficient', bc.suggested)}
        />
      )}
      {note && <Text style={[styles.meta, { color: colors.text.secondary }]}>{note}</Text>}
      {leftOut && <Text style={[styles.meta, { color: colors.text.secondary }]}>{leftOut}</Text>}
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
    marginBottom: Sizes.spacing.sm,
  },
  suggestion: {
    marginTop: Sizes.spacing.sm,
    gap: Sizes.spacing.xs,
  },
  label: {
    fontSize: Typography.fontSize.sm,
  },
  change: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '700',
  },
  meta: {
    fontSize: Typography.fontSize.sm,
  },
  body: {
    fontSize: Typography.fontSize.md,
  },
});
