/**
 * Ballistic Solution Results Screen
 * Displays calculated ballistic solution for a target
 */

import React, { useState } from 'react';
import { View, ScrollView, Text, StyleSheet, Alert, Switch } from 'react-native';

import { Card, Button } from '../components';
import { AdjustmentConfidenceBadge } from '../components/AdjustmentConfidenceBadge';
import { RelevantDopeList } from '../components/RelevantDopeList';
import { useTheme } from '../contexts/ThemeContext';
import { useDopeAdjustment } from '../hooks/useDopeAdjustment';
import { exportBallisticSolutionPDF } from '../services/ExportService';
import { useAmmoStore } from '../store/useAmmoStore';
import { useAppStore } from '../store/useAppStore';
import { useDOPEStore } from '../store/useDOPEStore';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { useRifleStore } from '../store/useRifleStore';
import {
  applyAdvancedCorrections,
  describeAdvancedCorrections,
} from '../utils/advancedCorrections';
import { toSolverYards } from '../utils/distanceUnits';
import { SOLVER_ONLY_REASON } from '../utils/dopeAdjustment';
import { calculateCrosswindComponent } from '../utils/windTable';

import type { DOPELogData } from '../models/DOPELog';
import type { CalculatorStackScreenProps } from '../navigation/types';

type Props = CalculatorStackScreenProps<'BallisticSolutionResults'>;

export const BallisticSolutionResults: React.FC<Props> = ({ route, navigation }) => {
  const { solution, rifleId, ammoId, distance, distanceUnit, angularUnit } = route.params;
  const { settings } = useAppStore();

  /**
   * The solver computes spin drift and Coriolis but its elevation and windage
   * fields do not include them (#71). `applyAdvancedCorrections` folds them in
   * when the setting is on, and reports the breakdown either way so the shooter
   * can see what the toggle would change.
   */
  const adjusted = applyAdvancedCorrections(solution, {
    enabled: settings.advancedBallisticsEnabled,
  });
  const advancedLines = describeAdvancedCorrections(solution, angularUnit);
  const elevation = angularUnit === 'MIL' ? adjusted.elevationMIL : adjusted.elevationMOA;
  const windage = angularUnit === 'MIL' ? adjusted.windageMIL : adjusted.windageMOA;
  const baseElevation =
    angularUnit === 'MIL' ? adjusted.baseElevationMIL : adjusted.baseElevationMOA;
  const baseWindage = angularUnit === 'MIL' ? adjusted.baseWindageMIL : adjusted.baseWindageMOA;
  const { theme } = useTheme();
  const { colors } = theme;

  const { getRifleById } = useRifleStore();
  const { getAmmoById } = useAmmoStore();
  const { current: currentEnv, saveCurrent } = useEnvironmentStore();
  const { createDopeLog } = useDOPEStore();

  const rifle = getRifleById(rifleId);
  const ammo = getAmmoById(ammoId);

  /**
   * Today's elevation, adjusted by what the shooter's own relevant DOPE says the
   * solver gets wrong (#168), gated on confidence (#161). The ranking, the
   * per-snapshot predictions and the gate live in `useDopeAdjustment`, which
   * range session mode shares (#166). The solver's own figure is always on
   * screen, whatever the switch says.
   */
  const [adjustByDope, setAdjustByDope] = useState(true);

  const {
    relevantDope,
    dopeAdjusted,
    confident,
    interpolated,
    applied,
    shownConfidence,
    adjustmentApplies,
    shownElevation,
    windage: windageAdjustment,
    windageCaption: windageBasis,
    windageApplies,
    shownWindage,
  } = useDopeAdjustment({
    rifleId,
    ammoId,
    // The solver's unit, because that is what the matcher compares against.
    distanceYards: toSolverYards(distance, distanceUnit),
    solverElevation: elevation,
    unit: angularUnit,
    enabled: adjustByDope,
    // #163: the windage half, normalised by the crosswind each log was shot in.
    // Today's crosswind comes from the same `calculateCrosswindComponent` the
    // wind table and the solver use, from whichever air the solution was
    // computed in.
    solverWindage: windage,
    crosswindMph:
      currentEnv === null
        ? 0
        : calculateCrosswindComponent(currentEnv.windSpeed, currentEnv.windDirection),
  });

  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const result = await exportBallisticSolutionPDF(
        solution,
        rifle ?? null,
        ammo ?? null,
        distance,
        angularUnit
      );
      if (!result.success) {
        Alert.alert('Export Failed', result.error || 'Unknown error');
      }
    } catch (error) {
      Alert.alert('Export Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveToDOPE = async () => {
    if (!rifle?.id || !ammo?.id) {
      Alert.alert('Error', 'Rifle or ammunition profile not found');
      return;
    }

    // Show target type selection
    Alert.alert('Save to DOPE Log', 'Select target type:', [
      { text: 'Steel', onPress: () => saveDOPELog('steel') },
      { text: 'Paper', onPress: () => saveDOPELog('paper') },
      { text: 'Vital Zone', onPress: () => saveDOPELog('vital_zone') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const saveDOPELog = async (targetType: 'steel' | 'paper' | 'vital_zone' | 'other') => {
    setIsSaving(true);
    try {
      // Need an environment snapshot - save current or create default
      let environmentId: number;

      if (currentEnv) {
        // Save current environment
        const envSnapshot = await saveCurrent();
        environmentId = envSnapshot.id!;
      } else {
        // No current environment - alert user
        Alert.alert(
          'Environment Required',
          'Please set environmental conditions first in the Environment screen.',
          [{ text: 'OK' }]
        );
        setIsSaving(false);
        return;
      }

      const dopeData: DOPELogData = {
        rifleId: rifle!.id!,
        ammoId: ammo!.id!,
        environmentId,
        // Stored as entered, with its unit beside it -- the contract DOPELogEntry
        // already uses. Hard-coding 'yards' here mislabelled every metric
        // solution that reached this screen. (#106)
        distance,
        distanceUnit,
        // The solver's own figure, deliberately, even when the headline shows
        // the adjusted one (#185). Every offset in `adjustElevation` is logged
        // minus solver-predicted, so a log holding an adjusted elevation would
        // be read back as further disagreement with the solver and shift the
        // next solution again -- the offset compounding once per save. What is
        // worth recording is what the rifle did, not what the app suggested.
        // The note under the save button says so on screen.
        elevationCorrection: elevation,
        windageCorrection: windage,
        correctionUnit: angularUnit,
        targetType,
        notes: `Calculated at ${distance} ${distanceUnit === 'yards' ? 'yards' : 'metres'} with ${rifle?.name} / ${ammo?.name}`,
      };

      await createDopeLog(dopeData);
      Alert.alert('Success', 'Ballistic solution saved to DOPE log');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save DOPE log');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Profile Info */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Configuration</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>Rifle:</Text>
            <Text style={[styles.infoValue, { color: colors.text.primary }]}>
              {rifle?.name || 'Unknown'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>Ammunition:</Text>
            <Text style={[styles.infoValue, { color: colors.text.primary }]}>
              {ammo?.name || 'Unknown'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>Distance:</Text>
            <Text style={[styles.infoValue, { color: colors.text.primary }]}>
              {distance} {distanceUnit === 'yards' ? 'yards' : 'metres'}
            </Text>
          </View>
        </Card>

        {/* Primary Corrections */}
        <Card style={[styles.card, styles.highlightCard]}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Required Corrections
          </Text>
          <View style={styles.primaryResult}>
            <View style={styles.primaryColumn}>
              <Text style={[styles.primaryLabel, { color: colors.text.secondary }]}>
                {adjustmentApplies ? 'ELEVATION (ADJUSTED)' : 'ELEVATION'}
              </Text>
              <Text
                style={[styles.primaryValue, { color: colors.primaryText }]}
                testID="elevation-value"
              >
                {shownElevation.toFixed(2)}
              </Text>
              <Text style={[styles.primaryUnit, { color: colors.text.secondary }]}>
                {angularUnit}
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.primaryColumn}>
              <Text style={[styles.primaryLabel, { color: colors.text.secondary }]}>
                {windageApplies ? 'WINDAGE (ADJUSTED)' : 'WINDAGE'}
              </Text>
              <Text
                style={[styles.primaryValue, { color: colors.primaryText }]}
                testID="windage-value"
              >
                {(windageApplies ? (shownWindage ?? windage) : windage).toFixed(2)}
              </Text>
              <Text style={[styles.primaryUnit, { color: colors.text.secondary }]}>
                {angularUnit}
              </Text>
            </View>
          </View>
        </Card>

        {/* Advanced corrections, shown separately from the base solution (#71).
            Rendered whether or not they are applied: seeing that spin drift is
            0.3 MIL and NOT in the dialled number is more useful than seeing
            nothing, and it is how a shooter decides whether to turn it on. */}
        {advancedLines.length > 0 && (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Advanced Corrections
            </Text>
            <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>
              {adjusted.applied
                ? 'Included in the corrections above.'
                : 'Not included above. Turn on Advanced Ballistics in Settings to apply them.'}
            </Text>
            {advancedLines.map((line) => (
              <View key={line.label} style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>
                  {line.label}:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                  {line.value.toFixed(2)} {line.unit}
                </Text>
              </View>
            ))}
            {adjusted.applied && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>
                  Without them:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                  {baseElevation.toFixed(2)} / {baseWindage.toFixed(2)} {angularUnit}
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* What this shooter actually dialled in conditions like these (#70),
            and the adjustment derived from it (#168). The solver's own figure
            is always on screen, whatever the switch says. */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Your logged DOPE
          </Text>

          <View style={styles.adjustRow}>
            <Text style={[styles.adjustLabel, { color: colors.text.primary }]}>
              Adjust by my DOPE
            </Text>
            <Switch
              value={adjustByDope}
              onValueChange={setAdjustByDope}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={adjustByDope ? '#ffffff' : '#f4f3f4'}
              accessibilityLabel="Adjust by my DOPE"
              accessibilityHint="Off shows the solver's own elevation with no correction from your logs"
              testID="dope-adjust-switch"
            />
          </View>

          {applied ? (
            <View testID="dope-adjustment-summary">
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>
                  Solver alone:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                  {elevation.toFixed(2)} {angularUnit}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>
                  Offset applied:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                  {applied.offset >= 0 ? '+' : ''}
                  {applied.offset.toFixed(2)} {angularUnit}
                </Text>
              </View>
              <Text
                style={[styles.matchesCaption, { color: colors.text.secondary }]}
                testID="dope-adjustment-caption"
              >
                {applied.caption}
              </Text>
              {/* Past the last log there is no measurement on the far side, and
                  the shooter should know the figure leans on one that is not
                  here (#162). Said in words, not only a tint (WCAG 1.4.1). */}
              {applied.extrapolated && (
                <Text
                  style={[styles.extrapolatedWarning, { color: colors.text.primary }]}
                  testID="dope-extrapolated-warning"
                >
                  Beyond your logged distances — confirm with a sighter.
                </Text>
              )}
            </View>
          ) : (
            <Text style={[styles.matchesCaption, { color: colors.text.secondary }]}>
              {adjustByDope
                ? (confident?.reason ?? dopeAdjusted?.reason ?? SOLVER_ONLY_REASON)
                : 'Adjustment off. Showing the solver alone.'}
            </Text>
          )}

          {/* The windage half (#163). Separate from the elevation summary above
              because it can succeed or fail for its own reasons -- there may be
              plenty of logs to rank and not one of them shot in a crosswind --
              and a shooter dialling wind needs to know which. */}
          {adjustByDope && windageAdjustment !== undefined && (
            <View style={styles.windageBlock} testID="dope-windage">
              {windageApplies ? (
                <>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>
                      Solver windage:
                    </Text>
                    <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                      {windageAdjustment.solverWindage.toFixed(2)} {angularUnit}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>
                      Windage offset:
                    </Text>
                    <Text
                      style={[styles.infoValue, { color: colors.text.primary }]}
                      testID="dope-windage-offset"
                    >
                      {windageAdjustment.offset >= 0 ? '+' : ''}
                      {windageAdjustment.offset.toFixed(2)} {angularUnit}
                    </Text>
                  </View>
                  <Text
                    style={[styles.matchesCaption, { color: colors.text.secondary }]}
                    testID="dope-windage-caption"
                  >
                    {windageBasis}
                  </Text>
                </>
              ) : (
                <Text
                  style={[styles.matchesCaption, { color: colors.text.secondary }]}
                  testID="dope-windage-caption"
                >
                  {windageAdjustment.reason}
                </Text>
              )}
            </View>
          )}

          {/* Confidence in the adjustment itself (#161), as distinct from the
              per-log confidence `RelevantDopeList` shows against each entry.
              Rendered whenever there are logs to judge -- including when the
              figure was too low to apply, which is the case the shooter most
              needs the reasons for. Hidden while the switch is off, where it
              would be describing a number that is not on screen. When the
              figure was interpolated (#162) it is that figure's confidence. */}
          {adjustByDope &&
            shownConfidence !== undefined &&
            shownConfidence.contributingLogs > 0 && (
              <View style={styles.confidenceBlock}>
                <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>
                  Confidence in this adjustment
                </Text>
                <AdjustmentConfidenceBadge
                  confidence={shownConfidence}
                  solverOnly={interpolated === undefined && (confident?.solverOnly ?? false)}
                  testID="adjustment-confidence"
                />
              </View>
            )}

          <RelevantDopeList
            matches={relevantDope}
            emptyMessage={
              // Set only when the interpolated offset is what the headline applied.
              interpolated !== undefined
                ? 'No log is close enough to this shot to compare one by one. The adjustment ' +
                  'above was read across the distances you have logged.'
                : undefined
            }
            testID="relevant-dope"
          />
        </Card>

        {/* Detailed Results */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Ballistic Details
          </Text>

          <View style={styles.resultRow}>
            <Text style={[styles.resultLabel, { color: colors.text.secondary }]}>Drop</Text>
            <Text style={[styles.resultValue, { color: colors.text.primary }]}>
              {solution.drop.toFixed(1)} in
            </Text>
          </View>

          <View style={styles.resultRow}>
            <Text style={[styles.resultLabel, { color: colors.text.secondary }]}>
              Windage Drift
            </Text>
            <Text style={[styles.resultValue, { color: colors.text.primary }]}>
              {solution.windage.toFixed(1)} in
            </Text>
          </View>

          <View style={styles.resultRow}>
            <Text style={[styles.resultLabel, { color: colors.text.secondary }]}>
              Time of Flight
            </Text>
            <Text style={[styles.resultValue, { color: colors.text.primary }]}>
              {solution.timeOfFlight.toFixed(2)} sec
            </Text>
          </View>

          <View style={styles.resultRow}>
            <Text style={[styles.resultLabel, { color: colors.text.secondary }]}>
              Velocity at Target
            </Text>
            <Text style={[styles.resultValue, { color: colors.text.primary }]}>
              {solution.velocity.toFixed(0)} fps
            </Text>
          </View>

          <View style={styles.resultRow}>
            <Text style={[styles.resultLabel, { color: colors.text.secondary }]}>
              Energy at Target
            </Text>
            <Text style={[styles.resultValue, { color: colors.text.primary }]}>
              {solution.energy.toFixed(0)} ft-lbs
            </Text>
          </View>
        </Card>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            title={isSaving ? 'Saving...' : 'Save to DOPE Log'}
            onPress={handleSaveToDOPE}
            variant="primary"
            size="large"
            style={styles.button}
            disabled={isSaving}
          />
          {/* Only when the two differ. With the adjustment off or unapplied the
              headline already *is* the stored figure, and a note drawing a
              distinction would be describing one that is not there (#185). */}
          {adjustmentApplies && (
            <Text
              style={[styles.saveNote, { color: colors.text.secondary }]}
              testID="save-records-note"
            >
              {`Saves the solver's ${elevation.toFixed(2)} ${angularUnit}, not the adjusted ${shownElevation.toFixed(2)}. Your logs are measured against the solver, so storing the adjusted figure would fold the offset in twice.`}
            </Text>
          )}
          <Button
            title={isExporting ? 'Exporting...' : 'Export PDF'}
            onPress={handleExportPDF}
            variant="secondary"
            size="large"
            style={styles.button}
            disabled={isExporting}
          />
          <Button
            title="View Wind Table"
            onPress={() =>
              navigation.navigate('WindTable', {
                rifleId,
                ammoId,
                // WindTable solves, so it takes the solver's unit.
                distance: toSolverYards(distance, distanceUnit),
              })
            }
            variant="secondary"
            size="large"
            style={styles.button}
          />
          <Button
            title="New Calculation"
            onPress={() => navigation.goBack()}
            variant="secondary"
            size="large"
            style={styles.button}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginBottom: 16,
  },
  highlightCard: {
    borderWidth: 2,
    borderColor: 'rgba(74, 144, 226, 0.3)',
  },
  confidenceBlock: {
    gap: 6,
    marginTop: 12,
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    marginBottom: 8,
  },
  adjustLabel: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
    paddingRight: 12,
  },
  matchesCaption: {
    fontSize: 12,
    marginBottom: 8,
  },
  windageBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  extrapolatedWarning: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 15,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  primaryResult: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 24,
  },
  primaryColumn: {
    flex: 1,
    alignItems: 'center',
  },
  primaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  primaryValue: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 4,
  },
  primaryUnit: {
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 80,
    marginHorizontal: 16,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  resultValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  buttonContainer: {
    gap: 12,
    marginTop: 8,
  },
  saveNote: {
    fontSize: 13,
    lineHeight: 18,
    // Pulls back part of buttonContainer's 12pt gap, so the note reads as part
    // of the save button above it rather than as a label for Export PDF below.
    marginTop: -4,
  },
  button: {
    flex: 1,
  },
});
