/**
 * Wind Table Screen
 * Displays comprehensive wind drift data for various distances and wind speeds
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { UnitToggle } from '../components/UnitToggle';
import { NumberPicker } from '../components/NumberPicker';
import type { CalculatorStackScreenProps } from '../navigation/types';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { generateComprehensiveWindTable, WindTableEntry } from '../utils/windTable';
import { calculateAtmosphericConditions } from '../utils/atmospheric';
import type { RifleConfig, AmmoConfig } from '../types/ballistic.types';

type Props = CalculatorStackScreenProps<'WindTable'>;

// Wind direction presets
const WIND_DIRECTIONS = [
  { label: '→ 3:00 (Full R-L)', value: 90 },
  { label: '↗ 2:00', value: 60 },
  { label: '↑ 1:00', value: 30 },
  { label: '← 9:00 (Full L-R)', value: 270 },
  { label: '↙ 10:00', value: 300 },
  { label: '↓ 11:00', value: 330 },
];

export function WindTable({ route }: Props) {
  const { rifleId, ammoId, distance: initialDistance } = route.params;
  const { theme } = useTheme();
  const { colors } = theme;

  const { getRifleById } = useRifleStore();
  const { getAmmoById } = useAmmoStore();
  const { current: currentEnv } = useEnvironmentStore();

  const rifle = getRifleById(rifleId);
  const ammo = getAmmoById(ammoId);

  const [angularUnit, setAngularUnit] = useState<'MIL' | 'MOA'>('MIL');
  const [windDirection, setWindDirection] = useState(90); // Default: full right-to-left
  const [windTable, setWindTable] = useState<WindTableEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Standard distances for wind table (yards)
  const distances = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  // Standard wind speeds (mph)
  const windSpeeds = [0, 5, 10, 15, 20];

  useEffect(() => {
    if (rifle && ammo) {
      generateTable();
    }
  }, [rifle, ammo, windDirection, currentEnv]);

  const generateTable = async () => {
    if (!rifle || !ammo) {
      Alert.alert('Error', 'Rifle or ammunition profile not found');
      return;
    }

    setLoading(true);

    try {
      // Build rifle config
      const rifleConfig: RifleConfig = {
        zeroDistance: rifle.zeroDistance,
        sightHeight: rifle.scopeHeight,
        twistRate: rifle.twistRate,
        barrelLength: rifle.barrelLength,
      };

      // Build ammo config
      const ammoConfig: AmmoConfig = {
        bulletWeight: ammo.bulletWeight,
        ballisticCoefficient: ammo.ballisticCoefficientG1,
        muzzleVelocity: ammo.muzzleVelocity,
        dragModel: 'G1' as const,
      };

      // Build atmosphere from current environmental data or defaults
      const atmosphere = currentEnv
        ? calculateAtmosphericConditions({
            temperature: currentEnv.temperature,
            pressure: currentEnv.pressure,
            altitude: currentEnv.altitude,
            humidity: currentEnv.humidity,
          })
        : calculateAtmosphericConditions({
            temperature: 59,
            pressure: 29.92,
            altitude: 0,
            humidity: 50,
          });

      // Generate comprehensive wind table
      const table = generateComprehensiveWindTable(
        rifleConfig,
        ammoConfig,
        distances,
        atmosphere,
        windSpeeds,
        windDirection
      );

      setWindTable(table);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to generate wind table');
    } finally {
      setLoading(false);
    }
  };

  const getWindDirectionLabel = (dir: number): string => {
    const preset = WIND_DIRECTIONS.find((d) => d.value === dir);
    return preset ? preset.label : `${dir}°`;
  };

  const formatCorrection = (entry: WindTableEntry): string => {
    if (angularUnit === 'MIL') {
      return entry.windageCorrection.toFixed(2);
    } else {
      // Convert MIL to MOA
      const moa = entry.windageCorrection * 3.43775;
      return moa.toFixed(2);
    }
  };

  const formatDrift = (drift: number): string => {
    return `${Math.abs(drift).toFixed(1)}"`;
  };

  const getWindSpeedColumn = (windSpeed: number): WindTableEntry[] => {
    return windTable.filter((entry) => entry.windSpeed === windSpeed);
  };

  if (!rifle || !ammo) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>
          Rifle or ammunition profile not found
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Controls */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={[styles.profileText, { color: colors.text.primary }]}>
            {rifle.name} • {ammo.name}
          </Text>
        </View>

        <View style={styles.controlRow}>
          <UnitToggle
            type="angular"
            value={angularUnit}
            onValueChange={(value) => setAngularUnit(value as 'MIL' | 'MOA')}
          />
        </View>

        <View style={styles.controlRow}>
          <Text style={[styles.label, { color: colors.text.secondary }]}>Wind Direction</Text>
          <NumberPicker
            label="Wind Direction"
            value={windDirection}
            onValueChange={setWindDirection}
            min={0}
            max={359}
            step={30}
            unit="°"
            presets={WIND_DIRECTIONS.map((d) => d.value)}
          />
        </View>

        {currentEnv && (
          <View style={[styles.envCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.envText, { color: colors.text.secondary }]}>
              {currentEnv.temperature}°F • {currentEnv.pressure}" Hg • {currentEnv.altitude}' MSL
            </Text>
          </View>
        )}
      </View>

      {/* Wind Table */}
      <ScrollView style={styles.scrollView} horizontal={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
              Generating wind table...
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={styles.tableContainer}>
              {/* Table Header */}
              <View style={[styles.tableHeader, { backgroundColor: colors.surface }]}>
                <View style={styles.distanceColumn}>
                  <Text style={[styles.headerText, { color: colors.text.primary }]}>Distance</Text>
                  <Text style={[styles.subHeaderText, { color: colors.text.secondary }]}>
                    (yards)
                  </Text>
                </View>
                {windSpeeds.map((speed) => (
                  <View key={speed} style={styles.windColumn}>
                    <Text style={[styles.headerText, { color: colors.text.primary }]}>
                      {speed} mph
                    </Text>
                    <Text style={[styles.subHeaderText, { color: colors.text.secondary }]}>
                      {angularUnit}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Table Rows */}
              {distances.map((distance) => {
                const rowEntries = windTable.filter((e) => e.distance === distance);

                return (
                  <View
                    key={distance}
                    style={[
                      styles.tableRow,
                      { borderBottomColor: colors.border, borderBottomWidth: 1 },
                    ]}
                  >
                    <View style={styles.distanceColumn}>
                      <Text style={[styles.cellText, { color: colors.text.primary }]}>
                        {distance}
                      </Text>
                    </View>
                    {windSpeeds.map((speed) => {
                      const entry = rowEntries.find((e) => e.windSpeed === speed);
                      if (!entry) return <View key={speed} style={styles.windColumn} />;

                      return (
                        <View key={speed} style={styles.windColumn}>
                          <Text
                            style={[
                              styles.cellText,
                              { color: entry.windSpeed === 0 ? colors.text.disabled : colors.primary },
                            ]}
                          >
                            {formatCorrection(entry)}
                          </Text>
                          <Text style={[styles.driftText, { color: colors.text.secondary }]}>
                            {formatDrift(entry.windDrift)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </ScrollView>

      {/* Footer Legend */}
      <View style={[styles.footer, { backgroundColor: colors.surface }]}>
        <Text style={[styles.legendText, { color: colors.text.secondary }]}>
          Wind: {getWindDirectionLabel(windDirection)} • Correction shows {angularUnit} adjustment •
          Drift shows inches of movement
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileText: {
    fontSize: 16,
    fontWeight: '600',
  },
  controlRow: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  envCard: {
    padding: 12,
    borderRadius: 8,
  },
  envText: {
    fontSize: 12,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  tableContainer: {
    minWidth: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  distanceColumn: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  windColumn: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  subHeaderText: {
    fontSize: 11,
    marginTop: 2,
  },
  cellText: {
    fontSize: 16,
    fontWeight: '500',
  },
  driftText: {
    fontSize: 11,
    marginTop: 2,
  },
  footer: {
    padding: 12,
  },
  legendText: {
    fontSize: 11,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    margin: 24,
  },
});
