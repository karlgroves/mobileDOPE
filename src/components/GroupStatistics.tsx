/**
 * The statistics of a marked group, in inches and MOA (#63).
 *
 * Shows what `measureGroup` produced and nothing it did not: with no width there
 * are no inches, and the shooter is told what is missing rather than shown a
 * size measured in fractions of a phone screen.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';

import type { GroupFigures, MeasuredGroup } from '../utils/targetMarking';

interface GroupStatisticsProps {
  group: MeasuredGroup;
  testID?: string;
}

const ROWS: { key: keyof GroupFigures; label: string }[] = [
  { key: 'extremeSpread', label: 'Extreme spread' },
  { key: 'meanRadius', label: 'Mean radius' },
  { key: 'horizontalSpread', label: 'Horizontal spread' },
  { key: 'verticalSpread', label: 'Vertical spread' },
  // Half the shots fall within this radius of the group centre.
  { key: 'circularErrorProbable', label: 'CEP (50%)' },
];

export const GroupStatistics: React.FC<GroupStatisticsProps> = ({ group, testID }) => {
  const { colors } = useTheme().theme;
  const { inches, moa } = group;

  // Each row is read as one item -- "Extreme spread, 1.20 inches, 1.15 MOA" --
  // rather than a label and a number a screen reader announces separately.
  const row = (label: string, value: string, spoken = value) => (
    <View
      key={label}
      style={styles.row}
      accessible
      accessibilityLabel={`${label}, ${spoken}`}
      accessibilityHint="Measured from the shots marked on the target"
    >
      <Text style={[styles.label, { color: colors.text.secondary }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text.primary }]}>{value}</Text>
    </View>
  );

  const figure = (key: keyof GroupFigures) => {
    if (!inches) return undefined;
    const size = inches[key].toFixed(2);
    const angle = moa ? moa[key].toFixed(2) : undefined;
    return {
      shown: angle ? `${size} in · ${angle} MOA` : `${size} in`,
      spoken: angle ? `${size} inches, ${angle} MOA` : `${size} inches`,
    };
  };

  let note: string | undefined;
  if (group.shotCount === 0) note = 'Tap the target where each shot landed.';
  else if (!inches) note = 'Enter the target width to measure the group.';

  return (
    <View testID={testID}>
      {row('Shots', String(group.shotCount))}
      {ROWS.map(({ key, label }) => {
        const value = figure(key);
        return value && row(label, value.shown, value.spoken);
      })}
      {note && <Text style={[styles.note, { color: colors.text.secondary }]}>{note}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  label: {
    fontSize: 15,
  },
  value: {
    fontSize: 15,
    fontWeight: '500',
  },
  note: {
    fontSize: 14,
    marginTop: 8,
  },
});
