/**
 * Moving Target Calculator Screen
 * Calculates lead distance for moving targets based on target speed and bullet time of flight
 */

import React, { useState, useMemo } from 'react';
import { View, ScrollView, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import { Card, Button, SegmentedControl } from '../components';
import { NumberInput } from '../components/NumberInput';
import { Picker } from '../components/Picker';
import { calculateBallisticSolution } from '../utils/ballistics';
import type { CalculatorStackScreenProps } from '../navigation/types';
import type { RifleConfig, AmmoConfig, ShotParameters } from '../types/ballistic.types';
import type { AtmosphericConditions } from '../utils/atmospheric';

type Props = CalculatorStackScreenProps<'MovingTargetCalculator'>;

// Common target speeds (mph)
const TARGET_SPEED_PRESETS = [
  { label: 'Walking (3 mph)', value: 3 },
  { label: 'Jogging (6 mph)', value: 6 },
  { label: 'Running (10 mph)', value: 10 },
  { label: 'Sprinting (15 mph)', value: 15 },
  { label: 'Deer trot (8 mph)', value: 8 },
  { label: 'Deer run (20 mph)', value: 20 },
  { label: 'Elk trot (10 mph)', value: 10 },
  { label: 'Coyote (25 mph)', value: 25 },
];

// Target movement directions
const MOVEMENT_DIRECTIONS = [
  { label: 'Left to Right (90°)', value: '90' },
  { label: 'Right to Left (270°)', value: '270' },
  { label: 'Quartering Away L-R (45°)', value: '45' },
  { label: 'Quartering Away R-L (315°)', value: '315' },
  { label: 'Quartering Toward L-R (135°)', value: '135' },
  { label: 'Quartering Toward R-L (225°)', value: '225' },
];

interface LeadResult {
  distance: number;
  timeOfFlight: number;
  leadDistance: number; // inches
  leadMIL: number;
  leadMOA: number;
  velocity: number;
}

export const MovingTargetCalculator: React.FC<Props> = ({ route }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const { rifleId: initialRifleId, ammoId: initialAmmoId } = route.params || {};

  const { rifles } = useRifleStore();
  const { ammoProfiles } = useAmmoStore();

  // State
  const [selectedRifleId, setSelectedRifleId] = useState<number | null>(initialRifleId || null);
  const [selectedAmmoId, setSelectedAmmoId] = useState<number | null>(initialAmmoId || null);
  const [targetDistance, setTargetDistance] = useState<number | undefined>(300);
  const [targetSpeed, setTargetSpeed] = useState<number | undefined>(10);
  const [movementAngle, setMovementAngle] = useState<number>(90);
  const [correctionUnit, setCorrectionUnit] = useState<'MIL' | 'MOA'>('MIL');

  const rifle = selectedRifleId ? rifles.find((r) => r.id === selectedRifleId) : null;
  const ammo = selectedAmmoId ? ammoProfiles.find((a) => a.id === selectedAmmoId) : null;

  // Filter ammo by caliber if rifle is selected
  const availableAmmo = rifle
    ? ammoProfiles.filter((a) => a.caliber === rifle.caliber)
    : ammoProfiles;

  // Standard atmospheric conditions
  const atmosphere: AtmosphericConditions = {
    temperature: 59,
    pressure: 29.92,
    humidity: 50,
    altitude: 0,
  };

  // Calculate lead for multiple distances
  const leadResults = useMemo<LeadResult[]>(() => {
    if (!rifle || !ammo || !targetSpeed) return [];

    const rifleConfig: RifleConfig = {
      zeroDistance: rifle.zeroDistance,
      sightHeight: rifle.scopeHeight,
      twistRate: rifle.twistRate,
      barrelLength: rifle.barrelLength,
    };

    const ammoConfig: AmmoConfig = {
      bulletWeight: ammo.bulletWeight,
      ballisticCoefficient: ammo.ballisticCoefficientG7 || ammo.ballisticCoefficientG1,
      dragModel: ammo.ballisticCoefficientG7 ? 'G7' : 'G1',
      muzzleVelocity: ammo.muzzleVelocity,
    };

    // Calculate crosswind component of target movement
    const angleRad = (movementAngle * Math.PI) / 180;
    const crossComponent = Math.abs(Math.sin(angleRad));

    // Calculate for various distances
    const distances = [100, 200, 300, 400, 500, 600, 700, 800];

    return distances.map((distance) => {
      const shot: ShotParameters = {
        distance,
        angle: 0,
        windSpeed: 0,
        windDirection: 0,
      };

      const solution = calculateBallisticSolution(rifleConfig, ammoConfig, shot, atmosphere);

      // Convert target speed from mph to inches per second
      // 1 mph = 17.6 inches/second
      const targetSpeedIPS = targetSpeed * 17.6;

      // Lead distance in inches = target speed (ips) × time of flight (s) × cross component
      const leadDistance = targetSpeedIPS * solution.timeOfFlight * crossComponent;

      // Convert lead to angular measurements
      // Lead in radians = atan(lead / distance in inches)
      const distanceInches = distance * 36; // yards to inches
      const leadAngleRad = Math.atan(leadDistance / distanceInches);
      const leadMIL = leadAngleRad * 1000;
      const leadMOA = ((leadAngleRad * 180) / Math.PI) * 60;

      return {
        distance,
        timeOfFlight: solution.timeOfFlight,
        leadDistance,
        leadMIL,
        leadMOA,
        velocity: solution.velocity,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rifle, ammo, targetSpeed, movementAngle]);

  // Get result for the selected distance
  const currentResult = leadResults.find((r) => r.distance === targetDistance);

  // Picker options
  const rifleOptions = rifles.map((r) => ({
    label: r.name,
    value: r.id?.toString() || '',
  }));

  const ammoOptions = availableAmmo.map((a) => ({
    label: `${a.name} (${a.bulletWeight}gr)`,
    value: a.id?.toString() || '',
  }));

  const canCalculate = rifle && ammo && targetDistance && targetSpeed;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Configuration */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Rifle & Ammunition
          </Text>

          <Picker
            label="Rifle"
            value={selectedRifleId?.toString()}
            onValueChange={(val) => {
              setSelectedRifleId(val ? parseInt(val) : null);
              setSelectedAmmoId(null); // Reset ammo when rifle changes
            }}
            options={rifleOptions}
            placeholder="Select rifle..."
          />

          <View style={styles.spacer} />

          <Picker
            label="Ammunition"
            value={selectedAmmoId?.toString()}
            onValueChange={(val) => setSelectedAmmoId(val ? parseInt(val) : null)}
            options={ammoOptions}
            placeholder="Select ammunition..."
          />
        </Card>

        {/* Target Parameters */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Target Parameters
          </Text>

          <NumberInput
            label="Distance to Target"
            value={targetDistance}
            onChangeValue={setTargetDistance}
            min={50}
            max={1500}
            precision={0}
            unit="yards"
          />

          <NumberInput
            label="Target Speed"
            value={targetSpeed}
            onChangeValue={setTargetSpeed}
            min={1}
            max={50}
            precision={0}
            unit="mph"
          />

          <View style={styles.presetContainer}>
            <Text style={[styles.presetLabel, { color: colors.text.secondary }]}>
              Speed Presets:
            </Text>
            <View style={styles.presetGrid}>
              {TARGET_SPEED_PRESETS.slice(0, 4).map((preset) => (
                <Button
                  key={preset.value}
                  title={preset.label.split(' ')[0]}
                  onPress={() => setTargetSpeed(preset.value)}
                  variant={targetSpeed === preset.value ? 'primary' : 'secondary'}
                  size="small"
                  style={styles.presetButton}
                />
              ))}
            </View>
          </View>

          <View style={styles.spacer} />

          <Picker
            label="Movement Direction"
            value={movementAngle.toString()}
            onValueChange={(val) => setMovementAngle(val ? parseInt(val) : 90)}
            options={MOVEMENT_DIRECTIONS}
          />
        </Card>

        {/* Results */}
        {canCalculate && currentResult && (
          <>
            {/* Primary Result */}
            <Card style={[styles.card, styles.resultCard]}>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                Lead Required at {targetDistance} yards
              </Text>

              <View style={styles.primaryResult}>
                <View style={styles.resultColumn}>
                  <Text style={[styles.resultLabel, { color: colors.text.secondary }]}>
                    LEAD DISTANCE
                  </Text>
                  <Text style={[styles.resultValue, { color: colors.primary }]}>
                    {currentResult.leadDistance.toFixed(1)}
                  </Text>
                  <Text style={[styles.resultUnit, { color: colors.text.secondary }]}>inches</Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.resultColumn}>
                  <Text style={[styles.resultLabel, { color: colors.text.secondary }]}>
                    LEAD ANGLE
                  </Text>
                  <Text style={[styles.resultValue, { color: colors.primary }]}>
                    {correctionUnit === 'MIL'
                      ? currentResult.leadMIL.toFixed(2)
                      : currentResult.leadMOA.toFixed(2)}
                  </Text>
                  <Text style={[styles.resultUnit, { color: colors.text.secondary }]}>
                    {correctionUnit}
                  </Text>
                </View>
              </View>

              <View style={styles.toggleContainer}>
                <SegmentedControl
                  options={[
                    { label: 'MIL', value: 'MIL' },
                    { label: 'MOA', value: 'MOA' },
                  ]}
                  selectedValue={correctionUnit}
                  onValueChange={(val) => setCorrectionUnit(val as 'MIL' | 'MOA')}
                />
              </View>

              <View style={[styles.infoBox, { backgroundColor: colors.surface }]}>
                <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                  Time of Flight: {currentResult.timeOfFlight.toFixed(3)}s
                </Text>
                <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                  Velocity at Target: {currentResult.velocity.toFixed(0)} fps
                </Text>
              </View>
            </Card>

            {/* Lead Table */}
            <Card style={styles.card}>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                Lead Table ({targetSpeed} mph target)
              </Text>

              <View style={styles.table}>
                <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.tableHeaderCell, { color: colors.text.secondary }]}>
                    Dist
                  </Text>
                  <Text style={[styles.tableHeaderCell, { color: colors.text.secondary }]}>
                    TOF
                  </Text>
                  <Text style={[styles.tableHeaderCell, { color: colors.text.secondary }]}>
                    Lead (in)
                  </Text>
                  <Text style={[styles.tableHeaderCell, { color: colors.text.secondary }]}>
                    Lead ({correctionUnit})
                  </Text>
                </View>

                {leadResults.map((row) => (
                  <View
                    key={row.distance}
                    style={[
                      styles.tableRow,
                      { borderBottomColor: colors.border },
                      row.distance === targetDistance && { backgroundColor: colors.surface },
                    ]}
                  >
                    <Text style={[styles.tableCell, { color: colors.text.primary }]}>
                      {row.distance}
                    </Text>
                    <Text style={[styles.tableCell, { color: colors.text.primary }]}>
                      {row.timeOfFlight.toFixed(2)}s
                    </Text>
                    <Text style={[styles.tableCell, { color: colors.primary }]}>
                      {row.leadDistance.toFixed(1)}
                    </Text>
                    <Text style={[styles.tableCell, { color: colors.primary }]}>
                      {correctionUnit === 'MIL' ? row.leadMIL.toFixed(2) : row.leadMOA.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>

            {/* Instructions */}
            <View style={[styles.instructions, { backgroundColor: colors.surface }]}>
              <Text style={[styles.instructionsTitle, { color: colors.text.primary }]}>
                How to Use
              </Text>
              <Text style={[styles.instructionsText, { color: colors.text.secondary }]}>
                • Aim the lead distance AHEAD of the target in its direction of travel
              </Text>
              <Text style={[styles.instructionsText, { color: colors.text.secondary }]}>
                • For L-R movement: aim to the RIGHT of the target
              </Text>
              <Text style={[styles.instructionsText, { color: colors.text.secondary }]}>
                • For R-L movement: aim to the LEFT of the target
              </Text>
              <Text style={[styles.instructionsText, { color: colors.text.secondary }]}>
                • Quartering targets require less lead than broadside targets
              </Text>
            </View>
          </>
        )}

        {!canCalculate && (
          <Card style={styles.card}>
            <Text style={[styles.placeholderText, { color: colors.text.secondary }]}>
              Select a rifle, ammunition, and enter target parameters to calculate lead.
            </Text>
          </Card>
        )}
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
  resultCard: {
    borderWidth: 2,
    borderColor: 'rgba(74, 144, 226, 0.3)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  spacer: {
    height: 12,
  },
  presetContainer: {
    marginTop: 12,
  },
  presetLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    minWidth: 80,
  },
  primaryResult: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  resultColumn: {
    flex: 1,
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  resultValue: {
    fontSize: 40,
    fontWeight: '700',
  },
  resultUnit: {
    fontSize: 14,
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: 60,
    marginHorizontal: 16,
  },
  toggleContainer: {
    marginTop: 16,
  },
  infoBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  infoText: {
    fontSize: 13,
    textAlign: 'center',
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tableCell: {
    flex: 1,
    fontSize: 14,
    textAlign: 'center',
  },
  instructions: {
    padding: 16,
    borderRadius: 8,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  placeholderText: {
    fontSize: 14,
    textAlign: 'center',
    padding: 24,
  },
});
