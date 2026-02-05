/**
 * Ballistic Solution Results Screen
 * Displays calculated ballistic solution for a target
 */

import React, { useState } from 'react';
import { View, ScrollView, Text, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { useDOPEStore } from '../store/useDOPEStore';
import { Card, Button } from '../components';
import { exportBallisticSolutionPDF } from '../services/ExportService';
import type { CalculatorStackScreenProps } from '../navigation/types';
import type { DOPELogData } from '../models/DOPELog';

type Props = CalculatorStackScreenProps<'BallisticSolutionResults'>;

export const BallisticSolutionResults: React.FC<Props> = ({ route, navigation }) => {
  const { solution, rifleId, ammoId, distance, angularUnit } = route.params;
  const { theme } = useTheme();
  const { colors } = theme;

  const { getRifleById } = useRifleStore();
  const { getAmmoById } = useAmmoStore();
  const { current: currentEnv, saveCurrent } = useEnvironmentStore();
  const { createDopeLog } = useDOPEStore();

  const rifle = getRifleById(rifleId);
  const ammo = getAmmoById(ammoId);

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
        distance,
        distanceUnit: 'yards',
        elevationCorrection: angularUnit === 'MIL' ? solution.elevationMIL : solution.elevationMOA,
        windageCorrection: angularUnit === 'MIL' ? solution.windageMIL : solution.windageMOA,
        correctionUnit: angularUnit,
        targetType,
        notes: `Calculated at ${distance} yards with ${rifle?.name} / ${ammo?.name}`,
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
            <Text style={[styles.infoValue, { color: colors.text.primary }]}>{distance} yards</Text>
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
              <Text style={[styles.primaryValue, { color: colors.primary }]}>
                {angularUnit === 'MIL'
                  ? `${solution.elevationMIL.toFixed(2)}`
                  : `${solution.elevationMOA.toFixed(2)}`}
              </Text>
              <Text style={[styles.primaryUnit, { color: colors.text.secondary }]}>
                {angularUnit}
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.primaryColumn}>
              <Text style={[styles.primaryLabel, { color: colors.text.secondary }]}>WINDAGE</Text>
              <Text style={[styles.primaryValue, { color: colors.primary }]}>
                {angularUnit === 'MIL'
                  ? `${solution.windageMIL.toFixed(2)}`
                  : `${solution.windageMOA.toFixed(2)}`}
              </Text>
              <Text style={[styles.primaryUnit, { color: colors.text.secondary }]}>
                {angularUnit}
              </Text>
            </View>
          </View>
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
            onPress={() => navigation.navigate('WindTable', { rifleId, ammoId, distance })}
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
