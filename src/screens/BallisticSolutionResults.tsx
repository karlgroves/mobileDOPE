/**
 * Ballistic Solution Results Screen
 * Displays calculated ballistic solution for a target
 */

import React, { useMemo, useState } from 'react';
import { View, ScrollView, Text, StyleSheet, Alert } from 'react-native';

import { Card, Button } from '../components';
import { DopeAdjustedElevation } from '../components/DopeAdjustedElevation';
import { RelevantDopeList } from '../components/RelevantDopeList';
import { useTheme } from '../contexts/ThemeContext';
import { useSnapshotsFor } from '../hooks/useSnapshotsFor';
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
import { logDistanceInYards, toSolverYards } from '../utils/distanceUnits';
import { adjustElevationWithDope } from '../utils/dopeAssistedElevation';
import { rankMatches } from '../utils/dopeMatching';
import { elevationTable } from '../utils/solverInputs';

import type { AmmoProfileData } from '../models/AmmoProfile';
import type { DOPELogData } from '../models/DOPELog';
import type { EnvironmentSnapshotData } from '../models/EnvironmentSnapshot';
import type { RifleProfileData } from '../models/RifleProfile';
import type { CalculatorStackScreenProps } from '../navigation/types';
import type { MatchableEnvironment } from '../utils/dopeMatching';

/**
 * Whether these profiles can be put through the solver at all.
 *
 * A profile the user is part-way through creating, or one seeded by a test with
 * a name and nothing else, has undefined where the solver expects numbers --
 * and arithmetic on undefined produces a NaN correction rather than an error.
 * Without this the DOPE adjustment would show a blank figure and no reason.
 */
const canPredict = (rifle: RifleProfileData, ammo: AmmoProfileData): boolean =>
  Number.isFinite(rifle.zeroDistance) &&
  Number.isFinite(rifle.scopeHeight) &&
  Number.isFinite(ammo.bulletWeight) &&
  Number.isFinite(ammo.muzzleVelocity) &&
  ammo.muzzleVelocity > 0 &&
  (ammo.ballisticCoefficientG7 > 0 || ammo.ballisticCoefficientG1 > 0);

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
  const { current: currentEnv, saveCurrent, snapshots } = useEnvironmentStore();
  const { createDopeLog, dopeLogs } = useDOPEStore();

  /**
   * The shooter's own logged DOPE that resembles this shot (#70).
   *
   * Logs carry an `environmentId` rather than the conditions themselves, so the
   * snapshot is joined on here -- without it every log scores neutral on the
   * environment factor and the ranking collapses to distance and recency.
   *
   * The store holds only recent snapshots -- the Dashboard loads one -- so each
   * candidate log's own snapshot is loaded by id and joined over the store's
   * (#122). Reading the store alone left nearly every log neutral.
   */
  const candidateLogs = useMemo(
    () => dopeLogs.filter((log) => log.rifleId === rifleId && log.ammoId === ammoId),
    [dopeLogs, rifleId, ammoId]
  );
  const loadedSnapshots = useSnapshotsFor(candidateLogs);

  /**
   * Each log's conditions by snapshot id: the store's recent ones, with the
   * ones loaded by id layered over them. Hoisted out of the ranking memo
   * because the DOPE adjustment below needs the same snapshots to predict each
   * log in its own air -- and must read them from one place, or the figures
   * beside each other would be derived from different conditions.
   */
  const environmentById = useMemo(
    () =>
      new Map<number, EnvironmentSnapshotData>([
        ...snapshots.flatMap((snapshot) =>
          snapshot.id === undefined ? [] : [[snapshot.id, snapshot] as const]
        ),
        ...(loadedSnapshots ?? []),
      ]),
    [snapshots, loadedSnapshots]
  );

  const relevantDope = useMemo(() => {
    if (dopeLogs.length === 0) return [];

    const matchable: (DOPELogData & { environment?: MatchableEnvironment })[] = dopeLogs.map(
      (log) => ({
        ...log,
        environment: environmentById.get(log.environmentId),
      })
    );

    return rankMatches(matchable, {
      rifleId,
      ammoId,
      // The solver's unit, because that is what the matcher compares against.
      distance: toSolverYards(distance, distanceUnit),
      environment: currentEnv ?? undefined,
    });
  }, [dopeLogs, environmentById, rifleId, ammoId, distance, distanceUnit, currentEnv]);

  const rifle = getRifleById(rifleId);
  const ammo = getAmmoById(ammoId);

  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  /**
   * On by default: a shooter who has the history is better served by it than by
   * the solver alone, which is the premise of the whole feature. The switch is
   * for the shot where they would rather trust the maths -- a new load, a
   * re-zeroed scope -- and the unadjusted figure never leaves the screen either
   * way.
   */
  const [applyDopeAdjustment, setApplyDopeAdjustment] = useState(true);

  /**
   * Today's elevation, adjusted by what this rifle has actually done (#168).
   *
   * Each matched log is predicted in its OWN conditions, which is what makes the
   * offset a property of the rifle and load rather than of the weather: one
   * `elevationTable` per snapshot, out to the furthest log shot in it, exactly
   * as `inputCorrectionsFor` does it. A solve per log cost 660 ms for 60 logs on
   * this render path (#124 review).
   *
   * A log whose snapshot could not be loaded is predicted as undefined rather
   * than in a standard atmosphere, and `adjustElevationWithDope` drops it --
   * the same rule `inputCorrections` applies, and for the same reason: a cold
   * day at altitude read as a standard one looks exactly like shooter error.
   */
  const dopeAdjustment = useMemo(() => {
    const noPrediction = () => undefined;
    if (
      rifle === undefined ||
      ammo === undefined ||
      !canPredict(rifle, ammo) ||
      relevantDope.length === 0
    ) {
      return adjustElevationWithDope({
        matches: [],
        predict: noPrediction,
        solverElevation: elevation,
        unit: angularUnit,
      });
    }

    const furthest = new Map<number, number>();
    for (const { log } of relevantDope) {
      if (!environmentById.has(log.environmentId)) continue;
      const yards = Math.ceil(logDistanceInYards(log));
      furthest.set(log.environmentId, Math.max(furthest.get(log.environmentId) ?? 0, yards));
    }
    const tables = new Map(
      [...furthest].map(([id, maxYards]) => [
        id,
        elevationTable(rifle, ammo, environmentById.get(id), maxYards, angularUnit),
      ])
    );

    return adjustElevationWithDope({
      matches: relevantDope,
      predict: (log, yards) => tables.get(log.environmentId)?.(yards),
      /*
       * The figure the shooter is actually being shown -- the number they would
       * otherwise dial -- rather than the bare solve.
       *
       * Known approximation: with Advanced Ballistics on, `elevation` already
       * carries the vertical Coriolis term while `elevationTable` does not, so a
       * log shot with that term present has it inside its offset as well. The
       * double count is bounded by the term itself, which is hundredths of a MIL
       * at the distances this app solves. Removing it properly needs each log's
       * own latitude and heading, and longitude is deliberately never recorded
       * (see PRIVACY.md).
       */
      solverElevation: elevation,
      unit: angularUnit,
    });
  }, [relevantDope, environmentById, rifle, ammo, elevation, angularUnit]);

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
              <Text style={[styles.primaryLabel, { color: colors.text.secondary }]}>ELEVATION</Text>
              <Text style={[styles.primaryValue, { color: colors.primaryText }]}>
                {elevation.toFixed(2)}
              </Text>
              <Text style={[styles.primaryUnit, { color: colors.text.secondary }]}>
                {angularUnit}
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.primaryColumn}>
              <Text style={[styles.primaryLabel, { color: colors.text.secondary }]}>WINDAGE</Text>
              <Text style={[styles.primaryValue, { color: colors.primaryText }]}>
                {windage.toFixed(2)}
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

        {/* The solution adjusted by this shooter's own DOPE (#168). Its own card
            rather than a second pair of numbers inside "Required Corrections":
            which figure to dial is the one thing that must never be ambiguous,
            and the switch belongs beside the number it governs. */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            DOPE-assisted elevation
          </Text>
          <DopeAdjustedElevation
            adjustment={dopeAdjustment}
            enabled={applyDopeAdjustment}
            onToggle={setApplyDopeAdjustment}
            testID="dope-adjustment"
          />
        </Card>

        {/* What this shooter actually dialled in conditions like these (#70) */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Your logged DOPE
          </Text>
          <Text style={[styles.matchesCaption, { color: colors.text.secondary }]}>
            Shown beside the solution, not merged into it.
          </Text>
          <RelevantDopeList matches={relevantDope} testID="relevant-dope" />
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
  matchesCaption: {
    fontSize: 12,
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
  button: {
    flex: 1,
  },
});
