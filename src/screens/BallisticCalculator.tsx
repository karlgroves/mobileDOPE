import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import {
  Card,
  Picker,
  NumberInput,
  NumberPicker,
  UnitToggle,
  Button,
  SegmentedControl,
} from '../components';
import { calculateBallisticSolution } from '../utils/ballistics';
import { BallisticSolution } from '../types/ballistic.types';
import type { CalculatorStackScreenProps } from '../navigation/types';

type Props = CalculatorStackScreenProps<'BallisticCalculator'>;

export const BallisticCalculator: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const { rifles } = useRifleStore();
  const { ammoProfiles } = useAmmoStore();

  // Selection state
  const [selectedRifleId, setSelectedRifleId] = useState<number | undefined>();
  const [selectedAmmoId, setSelectedAmmoId] = useState<number | undefined>();

  // Target parameters
  const [distance, setDistance] = useState<number>(100);
  const [angle, setAngle] = useState<number | undefined>(0);

  // Environmental conditions
  const [temperature, setTemperature] = useState<number | undefined>(59); // Standard 59°F
  const [pressure, setPressure] = useState<number | undefined>(29.92); // Standard 29.92 inHg
  const [humidity, setHumidity] = useState<number | undefined>(50);
  const [altitude, setAltitude] = useState<number | undefined>(0);
  const [windSpeed, setWindSpeed] = useState<number | undefined>(0);
  const [windDirection, setWindDirection] = useState<number | undefined>(90); // 90° = 3 o'clock

  // Unit preferences
  const [angularUnit, setAngularUnit] = useState<'MIL' | 'MOA'>('MIL');
  const [distanceUnit, setDistanceUnit] = useState<'yards' | 'meters'>('yards');

  const selectedRifle = rifles.find((r) => r.id === selectedRifleId);
  const selectedAmmo = ammoProfiles.find((a) => a.id === selectedAmmoId);
  const availableAmmo = selectedRifleId
    ? ammoProfiles.filter((a) => a.rifleId === selectedRifleId)
    : [];

  // Reset ammo selection when rifle changes
  useEffect(() => {
    if (selectedRifleId && selectedAmmo?.rifleId !== selectedRifleId) {
      setSelectedAmmoId(undefined);
    }
  }, [selectedRifleId]);

  const handleCalculate = () => {
    if (!selectedRifle || !selectedAmmo) {
      Alert.alert('Missing Selection', 'Please select both a rifle and ammunition profile.');
      return;
    }

    if (
      angle === undefined ||
      temperature === undefined ||
      pressure === undefined ||
      humidity === undefined ||
      altitude === undefined ||
      windSpeed === undefined ||
      windDirection === undefined
    ) {
      Alert.alert('Missing Data', 'Please fill in all environmental parameters.');
      return;
    }

    try {
      const rifleConfig = {
        zeroDistance: selectedRifle.zeroDistance,
        sightHeight: selectedRifle.scopeHeight,
        clickValueType: selectedRifle.clickValueType as 'MIL' | 'MOA',
        clickValue: selectedRifle.clickValue,
        twistRate: selectedRifle.twistRate,
        barrelLength: selectedRifle.barrelLength,
      };

      const ammoConfig = {
        bulletWeight: selectedAmmo.bulletWeight,
        ballisticCoefficient: selectedAmmo.ballisticCoefficientG1,
        muzzleVelocity: selectedAmmo.muzzleVelocity,
        dragModel: 'G1' as const,
      };

      const targetParams = {
        distance,
        angle,
        windSpeed,
        windDirection,
      };

      const atmosphere = {
        temperature,
        pressure,
        humidity,
        altitude,
      };

      const result = calculateBallisticSolution(
        rifleConfig,
        ammoConfig,
        targetParams,
        atmosphere,
        false
      );

      // Navigate to results screen
      navigation.navigate('BallisticSolutionResults', {
        solution: result,
        rifleId: selectedRifleId!,
        ammoId: selectedAmmoId!,
        distance,
        angularUnit,
      });
    } catch (error: any) {
      Alert.alert('Calculation Error', error.message || 'Failed to calculate ballistic solution');
    }
  };

  const rifleOptions = rifles.map((r) => ({ label: r.name, value: r.id!.toString() }));
  const ammoOptions = availableAmmo.map((a) => ({ label: a.name, value: a.id!.toString() }));

  const distancePresets = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Profile Selection */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Profile Selection
          </Text>
          <Picker
            label="Rifle Profile"
            value={selectedRifleId?.toString() || ''}
            onValueChange={(value) => setSelectedRifleId(parseInt(value))}
            options={rifleOptions}
            placeholder="Select a rifle"
            required
          />
          <Picker
            label="Ammunition"
            value={selectedAmmoId?.toString() || ''}
            onValueChange={(value) => setSelectedAmmoId(parseInt(value))}
            options={ammoOptions}
            placeholder="Select ammunition"
            required
            disabled={!selectedRifleId}
            helperText={
              !selectedRifleId
                ? 'Select a rifle first'
                : availableAmmo.length === 0
                  ? 'No ammunition profiles for this rifle'
                  : undefined
            }
          />
        </Card>

        {/* Target Parameters */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Target Parameters
          </Text>
          <NumberPicker
            label="Target Distance"
            value={distance}
            onValueChange={setDistance}
            min={25}
            max={2000}
            step={25}
            unit={distanceUnit}
            presets={distancePresets}
            helperText="Distance to target"
          />
          <NumberInput
            label="Shooting Angle"
            value={angle}
            onChangeValue={setAngle}
            min={-45}
            max={45}
            precision={0}
            unit="degrees"
            helperText="Positive = uphill, Negative = downhill"
          />
        </Card>

        {/* Environmental Conditions */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Environmental Conditions
          </Text>
          <NumberInput
            label="Temperature"
            value={temperature}
            onChangeValue={setTemperature}
            min={-40}
            max={120}
            precision={0}
            unit="°F"
          />
          <NumberInput
            label="Barometric Pressure"
            value={pressure}
            onChangeValue={setPressure}
            min={25}
            max={32}
            precision={2}
            unit="inHg"
          />
          <NumberInput
            label="Humidity"
            value={humidity}
            onChangeValue={setHumidity}
            min={0}
            max={100}
            precision={0}
            unit="%"
          />
          <NumberInput
            label="Altitude"
            value={altitude}
            onChangeValue={setAltitude}
            min={-1000}
            max={15000}
            precision={0}
            unit="feet"
          />
        </Card>

        {/* Wind Conditions */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Wind Conditions
          </Text>
          <NumberInput
            label="Wind Speed"
            value={windSpeed}
            onChangeValue={setWindSpeed}
            min={0}
            max={50}
            precision={0}
            unit="mph"
          />
          <NumberInput
            label="Wind Direction"
            value={windDirection}
            onChangeValue={setWindDirection}
            min={0}
            max={359}
            precision={0}
            unit="degrees"
            helperText="0° = headwind, 90° = right crosswind, 180° = tailwind"
          />
        </Card>

        {/* Unit Preferences */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Unit Preferences
          </Text>
          <View style={styles.unitRow}>
            <Text style={[styles.unitLabel, { color: colors.text.primary }]}>Angular Unit</Text>
            <UnitToggle
              type="angular"
              value={angularUnit}
              onValueChange={(value) => setAngularUnit(value as 'MIL' | 'MOA')}
              size="medium"
            />
          </View>
          <View style={styles.unitRow}>
            <Text style={[styles.unitLabel, { color: colors.text.primary }]}>Distance Unit</Text>
            <UnitToggle
              type="distance"
              value={distanceUnit}
              onValueChange={(value) => setDistanceUnit(value as 'yards' | 'meters')}
              size="medium"
            />
          </View>
        </Card>

        <Button
          title="Calculate Solution"
          onPress={handleCalculate}
          variant="primary"
          size="large"
          disabled={!selectedRifle || !selectedAmmo}
        />
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
  resultsCard: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  unitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  unitLabel: {
    fontSize: 16,
    fontWeight: '500',
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
  windTableButtonContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
});
