/**
 * DOPE Log Entry Screen
 * Quick-entry form for logging shooting data in the field
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/Button';
import { NumberInput } from '../components/NumberInput';
import { TextInput } from '../components/TextInput';
import { Picker } from '../components/Picker';
import { SegmentedControl } from '../components/SegmentedControl';
import { Card } from '../components/Card';
import type { LogsStackScreenProps } from '../navigation/types';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { useDOPEStore } from '../store/useDOPEStore';
import type { DOPELogData } from '../models/DOPELog';

type Props = LogsStackScreenProps<'DOPELogEdit'>;

export function DOPELogEntry({ route, navigation }: Props) {
  const { logId } = route.params || {};
  const { theme } = useTheme();
  const { colors } = theme;

  const { rifles } = useRifleStore();
  const { ammoProfiles } = useAmmoStore();
  const { current: currentEnv, saveCurrent } = useEnvironmentStore();
  const { createDopeLog, updateDopeLog, getDopeById, loading } = useDOPEStore();

  // Load existing log if editing
  const existingLog = logId ? getDopeById(logId) : undefined;

  // Profile selection - auto-select first rifle if creating new log
  const getInitialRifleId = () => {
    if (existingLog?.rifleId) return existingLog.rifleId;
    if (rifles.length > 0) return rifles[0].id;
    return undefined;
  };
  const [selectedRifleId, setSelectedRifleId] = useState<number | undefined>(getInitialRifleId());
  const [selectedAmmoId, setSelectedAmmoId] = useState<number | undefined>(existingLog?.ammoId);

  // Target parameters
  const [distance, setDistance] = useState<number | undefined>(existingLog?.distance || 100);
  const [distanceUnit, setDistanceUnit] = useState<'yards' | 'meters'>(
    existingLog?.distanceUnit || 'yards'
  );

  // Corrections
  const [elevationCorrection, setElevationCorrection] = useState<number | undefined>(
    existingLog?.elevationCorrection || 0
  );
  const [windageCorrection, setWindageCorrection] = useState<number | undefined>(
    existingLog?.windageCorrection || 0
  );
  const [correctionUnit, setCorrectionUnit] = useState<'MIL' | 'MOA'>(
    existingLog?.correctionUnit || 'MIL'
  );

  // Target info
  const [targetType, setTargetType] = useState<'steel' | 'paper' | 'vital_zone' | 'other'>(
    existingLog?.targetType || 'steel'
  );
  const [groupSize, setGroupSize] = useState<number | undefined>(existingLog?.groupSize);
  const [hitCount, setHitCount] = useState<number | undefined>(existingLog?.hitCount);
  const [shotCount, setShotCount] = useState<number | undefined>(existingLog?.shotCount);
  const [notes, setNotes] = useState(existingLog?.notes || '');

  // Environment ID will be set when saving
  const [environmentId, setEnvironmentId] = useState<number | undefined>(
    existingLog?.environmentId
  );

  // Auto-select compatible ammo when rifle changes
  const handleRifleChange = (newRifleId: number | undefined) => {
    setSelectedRifleId(newRifleId);
    if (!existingLog && newRifleId) {
      const rifle = rifles.find((r) => r.id === newRifleId);
      if (rifle) {
        const rifleAmmo = ammoProfiles.filter((a) => a.caliber === rifle.caliber);
        if (rifleAmmo.length > 0) {
          setSelectedAmmoId(rifleAmmo[0].id);
        }
      }
    }
  };

  const selectedRifle = rifles.find((r) => r.id === selectedRifleId);
  const filteredAmmo = selectedRifle
    ? ammoProfiles.filter((a) => a.caliber === selectedRifle.caliber || a.caliber === 'Unknown')
    : [];

  const handleAmmoChange = (value: string) => {
    if (value === '__add_new__') {
      // Navigate to ammo creation screen, pre-fill caliber from selected rifle
      const caliber = selectedRifle?.caliber;
      // @ts-expect-error - Cross-stack navigation
      navigation.navigate('Ammo', {
        screen: 'AmmoProfileForm',
        params: { caliber },
      });
    } else {
      setSelectedAmmoId(value ? parseInt(value) : undefined);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!selectedRifleId || !selectedAmmoId) {
      Alert.alert('Missing Data', 'Please select a rifle and ammunition profile.');
      return;
    }

    if (distance === undefined || distance <= 0) {
      Alert.alert('Invalid Distance', 'Please enter a valid distance.');
      return;
    }

    if (elevationCorrection === undefined || windageCorrection === undefined) {
      Alert.alert('Missing Corrections', 'Please enter elevation and windage corrections.');
      return;
    }

    try {
      // Save or update current environment if exists
      let envId = environmentId;
      if (currentEnv && !environmentId) {
        const savedEnv = await saveCurrent();
        envId = savedEnv.id;
        setEnvironmentId(savedEnv.id);
      }

      if (!envId) {
        Alert.alert(
          'Missing Environmental Data',
          'Please capture environmental conditions before logging DOPE.'
        );
        return;
      }

      const data: DOPELogData = {
        rifleId: selectedRifleId,
        ammoId: selectedAmmoId,
        environmentId: envId,
        distance,
        distanceUnit,
        elevationCorrection,
        windageCorrection,
        correctionUnit,
        targetType,
        groupSize,
        hitCount,
        shotCount,
        notes: notes.trim() || undefined,
      };

      if (existingLog && logId) {
        await updateDopeLog(logId, data);
        Alert.alert('Success', 'DOPE log updated');
      } else {
        await createDopeLog(data);
        Alert.alert('Success', 'DOPE log saved');
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save DOPE log');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Profile Selection */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Rifle & Ammunition
          </Text>

          <Picker
            label="Rifle Profile"
            value={selectedRifleId?.toString()}
            onValueChange={(value) => {
              handleRifleChange(value ? parseInt(value) : undefined);
            }}
            options={rifles.map((r) => ({ label: r.name, value: r.id!.toString() }))}
            placeholder="Select Rifle"
          />

          <Picker
            label="Ammunition"
            value={selectedAmmoId?.toString()}
            onValueChange={handleAmmoChange}
            options={[
              ...filteredAmmo.map((a) => ({ label: a.name, value: a.id!.toString() })),
              { label: '+ Add New Ammunition', value: '__add_new__' },
            ]}
            placeholder="Select Ammunition"
            disabled={!selectedRifleId}
          />
        </Card>

        {/* Distance */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Distance</Text>

          <SegmentedControl
            options={[
              { label: 'Yards', value: 'yards' },
              { label: 'Meters', value: 'meters' },
            ]}
            selectedValue={distanceUnit}
            onValueChange={(value) => setDistanceUnit(value as 'yards' | 'meters')}
          />

          <NumberInput
            label="Target Distance"
            value={distance}
            onChangeValue={setDistance}
            min={10}
            max={10000}
            precision={0}
            unit={distanceUnit}
            required
          />
        </Card>

        {/* Corrections */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Dial Corrections
          </Text>

          <SegmentedControl
            options={[
              { label: 'MIL', value: 'MIL' },
              { label: 'MOA', value: 'MOA' },
            ]}
            selectedValue={correctionUnit}
            onValueChange={(value) => setCorrectionUnit(value as 'MIL' | 'MOA')}
          />

          <NumberInput
            label="Elevation Correction"
            value={elevationCorrection}
            onChangeValue={setElevationCorrection}
            min={-50}
            max={50}
            precision={2}
            unit={correctionUnit}
            required
          />

          <NumberInput
            label="Windage Correction"
            value={windageCorrection}
            onChangeValue={setWindageCorrection}
            min={-50}
            max={50}
            precision={2}
            unit={correctionUnit}
            required
          />
        </Card>

        {/* Target Info */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Target Info</Text>

          <Picker
            label="Target Type"
            value={targetType}
            onValueChange={(value) => setTargetType(value as typeof targetType)}
            options={[
              { label: 'Steel', value: 'steel' },
              { label: 'Paper', value: 'paper' },
              { label: 'Vital Zone', value: 'vital_zone' },
              { label: 'Other', value: 'other' },
            ]}
          />

          <NumberInput
            label="Group Size (inches)"
            value={groupSize}
            onChangeValue={setGroupSize}
            min={0}
            max={100}
            precision={2}
            unit="in"
          />

          <View style={styles.shotCountRow}>
            <View style={styles.shotCountField}>
              <NumberInput
                label="Hits"
                value={hitCount}
                onChangeValue={setHitCount}
                min={0}
                max={100}
                precision={0}
              />
            </View>
            <View style={styles.shotCountField}>
              <NumberInput
                label="Shots"
                value={shotCount}
                onChangeValue={setShotCount}
                min={0}
                max={100}
                precision={0}
              />
            </View>
          </View>
        </Card>

        {/* Notes */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Notes</Text>
          <TextInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes about this engagement..."
            multiline
            numberOfLines={4}
          />
        </Card>

        {/* Environmental Snapshot */}
        {currentEnv && (
          <Card style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.envTitle, { color: colors.text.secondary }]}>
              Current Environment
            </Text>
            <Text style={[styles.envText, { color: colors.text.primary }]}>
              {`${currentEnv.temperature}°F • ${currentEnv.pressure}" Hg • ${currentEnv.altitude}' MSL`}
            </Text>
            <Text style={[styles.envText, { color: colors.text.primary }]}>
              Wind: {currentEnv.windSpeed} mph @ {currentEnv.windDirection}°
            </Text>
          </Card>
        )}

        {!currentEnv && (
          <Card style={[styles.card, { backgroundColor: colors.error + '20' }]}>
            <Text style={[styles.warningText, { color: colors.error }]}>
              ⚠️ No environmental data captured. Go to Range → Environmental Conditions to record
              conditions.
            </Text>
          </Card>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            title={existingLog ? 'Update DOPE Log' : 'Save DOPE Log'}
            onPress={handleSave}
            variant="primary"
            size="large"
            loading={loading}
            disabled={!selectedRifleId || !selectedAmmoId || !currentEnv}
          />
        </View>
      </ScrollView>
    </View>
  );
}

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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  shotCountRow: {
    flexDirection: 'row',
    gap: 12,
  },
  shotCountField: {
    flex: 1,
  },
  envTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  envText: {
    fontSize: 14,
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 8,
  },
});
