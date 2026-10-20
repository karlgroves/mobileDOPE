import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import { NO_DATA_REASON } from '../utils/dopeAssistedElevation';

import type { DopeAssistedElevation } from '../utils/dopeAssistedElevation';

/**
 * The solver's elevation and the shooter's own DOPE, side by side (#168).
 *
 * `adjustElevationWithDope` decides the number; this is where the shooter sees
 * both and can tell which is which. The whole value of the feature rests on that
 * distinction being unmissable: one of these figures is what the solver computed
 * from the inputs, and the other is what this rifle has actually done. A shooter
 * who cannot tell them apart dials one at random.
 *
 * ## Why both figures stay on screen with the switch off
 *
 * The same reason the Advanced Corrections card on this screen shows spin drift
 * whether or not it is applied: knowing that your history says +0.2 MIL and is
 * *not* in the number above is more useful than seeing nothing, and it is how a
 * shooter decides whether to turn it on. With the switch off, the adjusted figure
 * moves out of the headline pair and into a line that says it is not applied --
 * so it is never the number that looks like the one to dial.
 *
 * ## Why nothing here is colour-only (WCAG 1.4.1)
 *
 * Which column is which, whether the adjustment is applied, and which direction
 * the offset goes are all carried by text: the column headings, the status line
 * and an explicit `+`/`-` on the offset. The colours only reinforce it. On a
 * phone in the dark, on the night-vision theme, through a red lens, colour is the
 * first thing to go.
 */

/** The adjustment to show, and the switch that governs whether it is applied. */
export interface DopeAdjustedElevationProps {
  adjustment: DopeAssistedElevation;
  /** Whether the adjustment is applied to the dialled figure. */
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  testID?: string;
}

/** "+0.20 MIL from 3 logs" -- signed, so the direction is never inferred. */
const describeOffset = (adjustment: DopeAssistedElevation): string => {
  const { combinedOffset, unit, contributions } = adjustment;
  const sign = combinedOffset >= 0 ? '+' : '-';
  const count = contributions.length;
  return (
    `${sign}${Math.abs(combinedOffset).toFixed(2)} ${unit} ` +
    `from ${count} log${count === 1 ? '' : 's'}`
  );
};

/** The line under the figures: the reason, or what is being withheld and why. */
const describeStatus = (adjustment: DopeAssistedElevation, applied: boolean): string => {
  const { adjustedElevation, unit, contributions, reason } = adjustment;
  if (contributions.length === 0) return NO_DATA_REASON;
  if (applied) return reason;
  return (
    `Adjustment is off: ${adjustedElevation.toFixed(2)} ${unit} not applied. ` +
    `Dialling the solver's figure.`
  );
};

/**
 * Both figures and their provenance, in one string.
 *
 * One node for the pair. A reader walking two bare numbers, a unit and a
 * percentage separately gives the shooter nothing they can act on -- the same
 * reason RelevantDopeList labels a whole row rather than its cells.
 */
const describeSummary = (
  adjustment: DopeAssistedElevation,
  applied: boolean,
  status: string
): string => {
  const { solverElevation, adjustedElevation, unit, appliedShare } = adjustment;
  const solver = `Solver elevation ${solverElevation.toFixed(2)} ${unit}.`;
  if (!applied) return `${solver} ${status}`;
  return (
    `${solver} Adjusted by your DOPE to ${adjustedElevation.toFixed(2)} ${unit}, ` +
    `an offset of ${describeOffset(adjustment)}, ` +
    `${Math.round(appliedShare * 100)} percent applied.`
  );
};

/** The control that decides whether the offset is in the dialled figure. */
const ApplySwitch: React.FC<{
  applied: boolean;
  hasData: boolean;
  onToggle: (enabled: boolean) => void;
  testID?: string;
}> = ({ applied, hasData, onToggle, testID }) => {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <View style={[styles.switchRow, { borderTopColor: colors.border }]}>
      <Text style={[styles.switchLabel, { color: colors.text.primary }]}>
        Apply my DOPE to the elevation
      </Text>
      <Switch
        testID={testID}
        value={applied}
        onValueChange={onToggle}
        // Nothing to turn off without logs behind it, and a switch that visibly
        // changes nothing reads as a broken control.
        disabled={!hasData}
        accessibilityLabel="Apply my logged DOPE to the elevation"
        accessibilityHint="Off dials the solver's own figure"
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={applied ? '#ffffff' : '#f4f3f4'}
      />
    </View>
  );
};

export const DopeAdjustedElevation: React.FC<DopeAdjustedElevationProps> = ({
  adjustment,
  enabled,
  onToggle,
  testID,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;

  const { solverElevation, adjustedElevation, unit, contributions } = adjustment;
  const hasData = contributions.length > 0;
  const applied = enabled && hasData;

  const solverText = solverElevation.toFixed(2);
  const adjustedText = adjustedElevation.toFixed(2);
  const status = describeStatus(adjustment, applied);
  const summaryLabel = describeSummary(adjustment, applied, status);
  const idFor = (suffix: string): string | undefined =>
    testID === undefined ? undefined : `${testID}-${suffix}`;

  return (
    <View testID={testID}>
      <View
        testID={idFor('summary')}
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel={summaryLabel}
        accessibilityHint="The solver's elevation and the same shot adjusted by your logged DOPE"
        style={styles.figures}
      >
        <View style={styles.column}>
          <Text style={[styles.columnLabel, { color: colors.text.secondary }]}>SOLVER</Text>
          <Text testID={idFor('solver')} style={[styles.value, { color: colors.text.primary }]}>
            {solverText}
          </Text>
          <Text style={[styles.unit, { color: colors.text.secondary }]}>{unit}</Text>
        </View>

        {applied && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.column}>
              <Text style={[styles.columnLabel, { color: colors.text.secondary }]}>
                DOPE-ADJUSTED
              </Text>
              <Text
                testID={idFor('adjusted')}
                style={[styles.value, { color: colors.primaryText }]}
              >
                {adjustedText}
              </Text>
              <Text style={[styles.unit, { color: colors.text.secondary }]}>{unit}</Text>
            </View>
          </>
        )}
      </View>

      {hasData && (
        <Text testID={idFor('offset')} style={[styles.offset, { color: colors.text.primary }]}>
          {`Offset ${describeOffset(adjustment)}`}
        </Text>
      )}

      <Text testID={idFor('status')} style={[styles.status, { color: colors.text.secondary }]}>
        {status}
      </Text>

      <ApplySwitch
        applied={applied}
        hasData={hasData}
        onToggle={onToggle}
        testID={idFor('switch')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  figures: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  column: {
    alignItems: 'center',
    flex: 1,
  },
  columnLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 6,
  },
  value: {
    fontSize: 34,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  unit: {
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 56,
    marginHorizontal: 12,
    width: 1,
  },
  offset: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
  status: {
    fontSize: 12,
    marginTop: 4,
  },
  switchRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
  },
  switchLabel: {
    flex: 1,
    fontSize: 15,
    paddingRight: 12,
  },
});
