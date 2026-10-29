import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import {
  MIN_BIAS_SAMPLES,
  MIN_HEAT_SHIFT_SHOTS,
  WARM_SHOT_MAX,
  WARM_SHOT_MIN,
} from '../utils/barrelStateAnalysis';

import type { BarrelStateResult } from '../hooks/useBarrelState';

/**
 * What the shooter's own history says about their barrel's cold-bore bias and
 * heat shift, and whether to dial either (#165).
 *
 * The analysis is in `src/utils/barrelStateAnalysis.ts` and the per-log offsets
 * come from `useBarrelState`; this is only the surface. #183 merged the analysis
 * with no caller, so none of it reached the shooter until now.
 *
 * ## Nothing is applied without being chosen
 *
 * Both corrections are **off by default**, each behind its own switch. #165 asks
 * for exactly that -- "the user chooses whether to apply either one" -- and the
 * reason is that these are the two figures in the app most likely to be built on
 * thin evidence. The analysis already refuses to report below its minimums, but
 * three cold-bore shots is a low bar by design, and a shooter who dials a bias
 * drawn from three shots without having decided to is worse off than one who
 * dials nothing.
 *
 * ## Why it says what is missing
 *
 * With too little data the card does not disappear silently: it says which half
 * is short and what would answer it. A section that is simply absent reads as
 * "your barrel does not do this", and the shooter has no way to tell that from
 * "nobody has recorded enough to say".
 */

/** What the notice renders, and the two choices it offers. */
export interface BarrelStateNoticeProps {
  state: BarrelStateResult;
  /** Whether the cold-bore bias is being folded into the dialled figure. */
  applyColdBore: boolean;
  onApplyColdBoreChange: (value: boolean) => void;
  /** Whether the heat shift is being folded in. */
  applyHeatShift: boolean;
  onApplyHeatShiftChange: (value: boolean) => void;
  /** True while this is the first shot of the string, when cold bore applies. */
  isColdBoreShot: boolean;
  unit: 'MIL' | 'MOA';
  testID?: string;
}

/** One switch row with its caption, shared by both halves. */
const Correction: React.FC<{
  caption: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  hint: string;
  testID: string;
  captionTestID: string;
}> = ({ caption, value, onValueChange, label, hint, testID, captionTestID }) => {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <View style={styles.correction}>
      <Text style={[styles.caption, { color: colors.text.primary }]} testID={captionTestID}>
        {caption}
      </Text>
      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, { color: colors.text.secondary }]}>{label}</Text>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={value ? '#ffffff' : '#f4f3f4'}
          accessibilityLabel={label}
          accessibilityHint={hint}
          testID={testID}
        />
      </View>
    </View>
  );
};

export const BarrelStateNotice: React.FC<BarrelStateNoticeProps> = ({
  state,
  applyColdBore,
  onApplyColdBoreChange,
  applyHeatShift,
  onApplyHeatShiftChange,
  isColdBoreShot,
  unit,
  testID,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const { coldBoreCaption, heatShiftCaption, analysis } = state;

  if (state.loading) {
    return (
      <View testID={testID}>
        <Text style={[styles.pending, { color: colors.text.secondary }]}>
          Reading your barrel-state history…
        </Text>
      </View>
    );
  }

  return (
    <View testID={testID}>
      <Text style={[styles.title, { color: colors.text.primary }]}>Barrel state</Text>

      {/* The cold-bore figure is only actionable on the first shot. It is still
          shown later, because knowing the rifle throws its first shot low is
          worth knowing at shot six -- but the switch would be dialling a
          correction for a condition that has passed. */}
      {!state.coldBoreModelled ? (
        <Text style={[styles.caption, { color: colors.text.secondary }]} testID="cold-bore-off">
          Cold-bore modelling is off in Settings.
        </Text>
      ) : coldBoreCaption !== undefined ? (
        isColdBoreShot ? (
          <Correction
            caption={coldBoreCaption}
            value={applyColdBore}
            onValueChange={onApplyColdBoreChange}
            label="Apply cold-bore shift"
            hint={`Adds the measured cold-bore bias to the elevation shown, in ${unit}`}
            testID="apply-cold-bore"
            captionTestID="cold-bore-caption"
          />
        ) : (
          <Text style={[styles.caption, { color: colors.text.secondary }]} testID="cold-bore-past">
            {`${coldBoreCaption} — not applied: the barrel is no longer cold.`}
          </Text>
        )
      ) : (
        <Text style={[styles.caption, { color: colors.text.secondary }]} testID="cold-bore-short">
          {`No cold-bore bias yet. It needs ${MIN_BIAS_SAMPLES} logged cold-bore shots and ${MIN_BIAS_SAMPLES} warm ones (shots ${WARM_SHOT_MIN}–${WARM_SHOT_MAX} of a string).`}
        </Text>
      )}

      {!state.heatShiftModelled ? (
        <Text style={[styles.caption, { color: colors.text.secondary }]} testID="heat-shift-off">
          Heat-shift modelling is off in Settings.
        </Text>
      ) : heatShiftCaption !== undefined ? (
        <Correction
          caption={heatShiftCaption}
          value={applyHeatShift}
          onValueChange={onApplyHeatShiftChange}
          label="Apply heat shift"
          hint={`Adds the drift expected at this shot number to the elevation shown, in ${unit}`}
          testID="apply-heat-shift"
          captionTestID="heat-shift-caption"
        />
      ) : (
        <Text style={[styles.caption, { color: colors.text.secondary }]} testID="heat-shift-short">
          {analysis.heatShift === undefined
            ? `No heat shift measured. It needs ${MIN_HEAT_SHIFT_SHOTS} logs with a shot number, at three or more positions in the string.`
            : 'No measurable heat shift — your offset holds steady through a string.'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  correction: {
    marginBottom: 12,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  switchLabel: {
    flex: 1,
    fontSize: 14,
    marginRight: 12,
  },
  pending: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
