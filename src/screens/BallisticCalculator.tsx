import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, StyleSheet, Alert } from 'react-native';

import { Card, Picker, NumberInput, NumberPicker, UnitToggle, Button } from '../components';
import { ALTITUDE_HELP, STATION_PRESSURE_HELP } from '../constants/fieldHelp';
import { useTheme } from '../contexts/ThemeContext';
import { useAmmoStore } from '../store/useAmmoStore';
import { useAppStore } from '../store/useAppStore';
import { useRifleStore } from '../store/useRifleStore';
import { calculateBallisticSolution } from '../utils/ballistics';
import {
  hasRequiredEnvironmentalInputs,
  missingEnvironmentalInputs,
} from '../utils/calculatorInputs';
import { toSolverYards } from '../utils/distanceUnits';

import type { CalculatorStackScreenProps } from '../navigation/types';

// Wind direction options in degrees
const WIND_DIRECTION_OPTIONS = [
  { label: '0° (Headwind)', value: '0' },
  { label: '45°', value: '45' },
  { label: '90° (Right)', value: '90' },
  { label: '135°', value: '135' },
  { label: '180° (Tailwind)', value: '180' },
  { label: '225°', value: '225' },
  { label: '270° (Left)', value: '270' },
  { label: '315°', value: '315' },
];

type Props = CalculatorStackScreenProps<'BallisticCalculator'>;

export const BallisticCalculator: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const { rifles } = useRifleStore();
  const { ammoProfiles } = useAmmoStore();
  const { settings } = useAppStore();

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
  const availableAmmo = selectedRifle
    ? ammoProfiles.filter((a) => a.caliber === selectedRifle.caliber)
    : [];

  // Reset ammo selection when rifle changes
  useEffect(() => {
    if (selectedRifle && selectedAmmo?.caliber !== selectedRifle.caliber) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedAmmoId(undefined);
    }
  }, [selectedRifleId, selectedRifle, selectedAmmo]);

  const handleCalculate = () => {
    if (!selectedRifle || !selectedAmmo) {
      Alert.alert('Missing Selection', 'Please select both a rifle and ammunition profile.');
      return;
    }

    // Altitude is deliberately not in this set: the solver does not read it.
    // See `calculatorInputs`, where the rule lives so it can be tested.
    const environmentals = { angle, temperature, pressure, humidity, windSpeed, windDirection };

    if (!hasRequiredEnvironmentalInputs(environmentals)) {
      Alert.alert(
        'Missing Data',
        `Please fill in: ${missingEnvironmentalInputs(environmentals).join(', ')}.`
      );
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
        // The solver is yards. The toggle above used to change only the label,
        // so entering 600 with meters selected solved for 600 yards -- a target
        // 52 m closer than the one being looked at. See #106.
        distance: toSolverYards(distance, distanceUnit),
        angle: environmentals.angle,
        windSpeed: environmentals.windSpeed,
        windDirection: environmentals.windDirection,
      };

      const atmosphere = {
        temperature: environmentals.temperature,
        pressure: environmentals.pressure,
        humidity: environmentals.humidity,
        // Defaulted rather than made optional throughout: the solver never reads
        // altitude, and for anything derived from station pressure 0 is the
        // right value -- the elevation is already in the pressure. See #89.
        altitude: altitude ?? 0,
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
        // Passed as entered, with the unit, so the results screen shows the
        // shooter the number they asked about rather than its yard equivalent.
        distance,
        distanceUnit,
        angularUnit,
      });
    } catch (error: unknown) {
      Alert.alert(
        'Calculation Error',
        error instanceof Error ? error.message : 'Failed to calculate ballistic solution'
      );
    }
  };

  const rifleOptions = rifles.map((r) => ({ label: r.name, value: r.id!.toString() }));
  const ammoOptions = availableAmmo.map((a) => ({ label: a.name, value: a.id!.toString() }));

  const distancePresets = settings.distancePresets;

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
            label="Station Pressure"
            helperText={STATION_PRESSURE_HELP}
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
          {/* Not required (#89). The solver reads temperature and pressure only;
              with station pressure entered, elevation is already accounted for
              and reading altitude too would correct for it twice. Blocking the
              solve on a field the solver ignores was the misleading part. */}
          <NumberInput
            label="Altitude"
            value={altitude}
            onChangeValue={setAltitude}
            min={-1000}
            max={15000}
            precision={0}
            unit="feet"
            helperText={ALTITUDE_HELP}
          />
        </Card>

        {/* Wind Conditions */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Wind Conditions</Text>
          <NumberInput
            label="Wind Speed"
            value={windSpeed}
            onChangeValue={setWindSpeed}
            min={0}
            max={50}
            precision={0}
            unit="mph"
          />
          <Picker
            label="Wind Direction"
            value={windDirection?.toString()}
            onValueChange={(value) => setWindDirection(value ? parseInt(value) : undefined)}
            options={WIND_DIRECTION_OPTIONS}
            placeholder="Select direction"
          />
        </Card>

        {/* Unit Preferences */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Unit Preferences
          </Text>
          <View style={styles.unitRow}>
            <Text style={[styles.unitLabel, { color: colors.text.primary }]}>Angular Unit</Text>
            <View style={styles.unitToggleContainer}>
              <UnitToggle
                type="angular"
                value={angularUnit}
                onValueChange={(value) => setAngularUnit(value as 'MIL' | 'MOA')}
                size="medium"
              />
            </View>
          </View>
          <View style={styles.unitRow}>
            <Text style={[styles.unitLabel, { color: colors.text.primary }]}>Distance Unit</Text>
            <View style={styles.unitToggleContainer}>
              <UnitToggle
                type="distance"
                value={distanceUnit}
                onValueChange={(value) => setDistanceUnit(value as 'yards' | 'meters')}
                size="medium"
              />
            </View>
          </View>
        </Card>

        <Button
          title="Calculate Solution"
          onPress={handleCalculate}
          variant="primary"
          size="large"
          disabled={!selectedRifle || !selectedAmmo}
        />

        <View style={styles.additionalTools}>
          <Text style={[styles.additionalToolsLabel, { color: colors.text.secondary }]}>
            Additional Tools
          </Text>
          <Button
            title="Moving Target Calculator"
            onPress={() =>
              navigation.navigate('MovingTargetCalculator', {
                rifleId: selectedRifleId,
                ammoId: selectedAmmoId,
              })
            }
            variant="secondary"
            size="medium"
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
    flex: 1,
    marginRight: 16,
  },
  unitToggleContainer: {
    width: 140,
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
  additionalTools: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  additionalToolsLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
