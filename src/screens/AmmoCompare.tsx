/**
 * Ammo Compare Screen
 * Compare two ammunition profiles side by side with ballistic performance
 */

import React, { useState, useMemo } from 'react';
import { View, ScrollView, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAmmoStore } from '../store/useAmmoStore';
import { useRifleStore } from '../store/useRifleStore';
import { Card, EmptyState } from '../components';
import { Picker } from '../components/Picker';
import { calculateBallisticSolution } from '../utils/ballistics';
import type { AmmoStackScreenProps } from '../navigation/types';
import type { RifleConfig, AmmoConfig, ShotParameters } from '../types/ballistic.types';
import type { AtmosphericConditions } from '../utils/atmospheric';
// AmmoProfile type used via store

type Props = AmmoStackScreenProps<'AmmoCompare'>;

interface ComparisonData {
  distance: number;
  ammo1Drop: number;
  ammo1Velocity: number;
  ammo1Energy: number;
  ammo1ElevationMIL: number;
  ammo2Drop: number;
  ammo2Velocity: number;
  ammo2Energy: number;
  ammo2ElevationMIL: number;
}

export const AmmoCompare: React.FC<Props> = ({ route }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const { rifleId } = route.params || {};

  const { ammoProfiles } = useAmmoStore();
  const { rifles } = useRifleStore();

  const [selectedAmmo1Id, setSelectedAmmo1Id] = useState<number | null>(null);
  const [selectedAmmo2Id, setSelectedAmmo2Id] = useState<number | null>(null);
  const [_isCalculating] = useState(false);

  // Get rifle for zero distance and scope height
  const rifle = rifleId ? rifles.find((r) => r.id === rifleId) : rifles[0];

  // Filter ammo by caliber if rifle is selected
  const availableAmmo = rifle
    ? ammoProfiles.filter((a) => a.caliber === rifle.caliber)
    : ammoProfiles;

  const ammo1 = selectedAmmo1Id ? ammoProfiles.find((a) => a.id === selectedAmmo1Id) : null;
  const ammo2 = selectedAmmo2Id ? ammoProfiles.find((a) => a.id === selectedAmmo2Id) : null;

  // Standard atmospheric conditions
  const atmosphere: AtmosphericConditions = {
    temperature: 59,
    pressure: 29.92,
    humidity: 50,
    altitude: 0,
  };

  // Comparison distances
  const distances = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

  // Calculate comparison data
  const comparisonData = useMemo<ComparisonData[]>(() => {
    if (!rifle || !ammo1 || !ammo2) return [];

    const rifleConfig: RifleConfig = {
      zeroDistance: rifle.zeroDistance,
      sightHeight: rifle.scopeHeight,
      twistRate: rifle.twistRate,
      barrelLength: rifle.barrelLength,
    };

    const ammo1Config: AmmoConfig = {
      bulletWeight: ammo1.bulletWeight,
      ballisticCoefficient: ammo1.ballisticCoefficientG7 || ammo1.ballisticCoefficientG1,
      dragModel: ammo1.ballisticCoefficientG7 ? 'G7' : 'G1',
      muzzleVelocity: ammo1.muzzleVelocity,
    };

    const ammo2Config: AmmoConfig = {
      bulletWeight: ammo2.bulletWeight,
      ballisticCoefficient: ammo2.ballisticCoefficientG7 || ammo2.ballisticCoefficientG1,
      dragModel: ammo2.ballisticCoefficientG7 ? 'G7' : 'G1',
      muzzleVelocity: ammo2.muzzleVelocity,
    };

    return distances.map((distance) => {
      const shot: ShotParameters = {
        distance,
        angle: 0,
        windSpeed: 0,
        windDirection: 0,
      };

      const solution1 = calculateBallisticSolution(rifleConfig, ammo1Config, shot, atmosphere);
      const solution2 = calculateBallisticSolution(rifleConfig, ammo2Config, shot, atmosphere);

      return {
        distance,
        ammo1Drop: solution1.drop,
        ammo1Velocity: solution1.velocity,
        ammo1Energy: solution1.energy,
        ammo1ElevationMIL: solution1.elevationMIL,
        ammo2Drop: solution2.drop,
        ammo2Velocity: solution2.velocity,
        ammo2Energy: solution2.energy,
        ammo2ElevationMIL: solution2.elevationMIL,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rifle, ammo1, ammo2]);

  // Ammo picker options
  const ammoOptions = availableAmmo.map((a) => ({
    label: `${a.name} (${a.bulletWeight}gr)`,
    value: a.id?.toString() || '',
  }));

  const hasComparison = ammo1 && ammo2 && comparisonData.length > 0;

  if (!rifle) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          title="No Rifle Selected"
          message="Please select a rifle profile first to compare ammunition."
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Rifle Info */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Comparison Rifle
          </Text>
          <Text style={[styles.rifleInfo, { color: colors.text.secondary }]}>
            {rifle.name} • Zero: {rifle.zeroDistance} yds
          </Text>
        </Card>

        {/* Ammo Selection */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Select Ammunition to Compare
          </Text>

          <View style={styles.pickerRow}>
            <View style={styles.pickerContainer}>
              <Text style={[styles.pickerLabel, { color: colors.primary }]}>Ammo 1</Text>
              <Picker
                label="First Ammunition"
                value={selectedAmmo1Id?.toString()}
                onValueChange={(val) => setSelectedAmmo1Id(val ? parseInt(val) : null)}
                options={ammoOptions.filter((o) => o.value !== selectedAmmo2Id?.toString())}
                placeholder="Select ammo..."
              />
            </View>
          </View>

          <View style={styles.pickerRow}>
            <View style={styles.pickerContainer}>
              <Text style={[styles.pickerLabel, { color: colors.warning }]}>Ammo 2</Text>
              <Picker
                label="Second Ammunition"
                value={selectedAmmo2Id?.toString()}
                onValueChange={(val) => setSelectedAmmo2Id(val ? parseInt(val) : null)}
                options={ammoOptions.filter((o) => o.value !== selectedAmmo1Id?.toString())}
                placeholder="Select ammo..."
              />
            </View>
          </View>
        </Card>

        {/* Specs Comparison */}
        {ammo1 && ammo2 && (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Specifications
            </Text>

            <View style={styles.specsTable}>
              <View style={styles.specsHeader}>
                <Text style={[styles.specsHeaderCell, { color: colors.text.secondary }]}>Spec</Text>
                <Text style={[styles.specsHeaderCell, { color: colors.primary }]}>
                  {ammo1.name.substring(0, 15)}
                </Text>
                <Text style={[styles.specsHeaderCell, { color: colors.warning }]}>
                  {ammo2.name.substring(0, 15)}
                </Text>
              </View>

              <SpecRow
                label="Weight"
                value1={`${ammo1.bulletWeight}gr`}
                value2={`${ammo2.bulletWeight}gr`}
                colors={colors}
              />
              <SpecRow
                label="Muzzle Vel"
                value1={`${ammo1.muzzleVelocity} fps`}
                value2={`${ammo2.muzzleVelocity} fps`}
                colors={colors}
                highlight={ammo1.muzzleVelocity !== ammo2.muzzleVelocity}
              />
              <SpecRow
                label="BC (G1)"
                value1={ammo1.ballisticCoefficientG1.toFixed(3)}
                value2={ammo2.ballisticCoefficientG1.toFixed(3)}
                colors={colors}
                highlight={ammo1.ballisticCoefficientG1 !== ammo2.ballisticCoefficientG1}
              />
              <SpecRow
                label="BC (G7)"
                value1={ammo1.ballisticCoefficientG7?.toFixed(3) || '-'}
                value2={ammo2.ballisticCoefficientG7?.toFixed(3) || '-'}
                colors={colors}
              />
              <SpecRow
                label="Bullet Type"
                value1={ammo1.bulletType}
                value2={ammo2.bulletType}
                colors={colors}
              />
            </View>
          </Card>
        )}

        {/* Ballistic Comparison */}
        {hasComparison && (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Ballistic Comparison
            </Text>
            <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
              {`Standard conditions: 59°F, 29.92" Hg`}
            </Text>

            {/* Drop Table */}
            <Text style={[styles.tableTitle, { color: colors.text.primary }]}>Elevation (MIL)</Text>
            <View style={styles.comparisonTable}>
              <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.tableHeaderCell, { color: colors.text.secondary }]}>Dist</Text>
                <Text style={[styles.tableHeaderCell, { color: colors.primary }]}>Ammo 1</Text>
                <Text style={[styles.tableHeaderCell, { color: colors.warning }]}>Ammo 2</Text>
                <Text style={[styles.tableHeaderCell, { color: colors.text.secondary }]}>Diff</Text>
              </View>

              {comparisonData
                .filter((_, i) => i % 2 === 0)
                .map((row) => {
                  const diff = row.ammo1ElevationMIL - row.ammo2ElevationMIL;
                  return (
                    <View
                      key={row.distance}
                      style={[styles.tableRow, { borderBottomColor: colors.border }]}
                    >
                      <Text style={[styles.tableCell, { color: colors.text.primary }]}>
                        {row.distance}
                      </Text>
                      <Text style={[styles.tableCell, { color: colors.primary }]}>
                        {row.ammo1ElevationMIL.toFixed(1)}
                      </Text>
                      <Text style={[styles.tableCell, { color: colors.warning }]}>
                        {row.ammo2ElevationMIL.toFixed(1)}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          {
                            color:
                              diff > 0
                                ? colors.success
                                : diff < 0
                                  ? colors.error
                                  : colors.text.secondary,
                          },
                        ]}
                      >
                        {diff > 0 ? '+' : ''}
                        {diff.toFixed(1)}
                      </Text>
                    </View>
                  );
                })}
            </View>

            {/* Velocity Table */}
            <Text style={[styles.tableTitle, { color: colors.text.primary, marginTop: 16 }]}>
              Velocity (fps)
            </Text>
            <View style={styles.comparisonTable}>
              <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.tableHeaderCell, { color: colors.text.secondary }]}>Dist</Text>
                <Text style={[styles.tableHeaderCell, { color: colors.primary }]}>Ammo 1</Text>
                <Text style={[styles.tableHeaderCell, { color: colors.warning }]}>Ammo 2</Text>
                <Text style={[styles.tableHeaderCell, { color: colors.text.secondary }]}>Diff</Text>
              </View>

              {comparisonData
                .filter((_, i) => i % 2 === 0)
                .map((row) => {
                  const diff = row.ammo1Velocity - row.ammo2Velocity;
                  return (
                    <View
                      key={row.distance}
                      style={[styles.tableRow, { borderBottomColor: colors.border }]}
                    >
                      <Text style={[styles.tableCell, { color: colors.text.primary }]}>
                        {row.distance}
                      </Text>
                      <Text style={[styles.tableCell, { color: colors.primary }]}>
                        {row.ammo1Velocity.toFixed(0)}
                      </Text>
                      <Text style={[styles.tableCell, { color: colors.warning }]}>
                        {row.ammo2Velocity.toFixed(0)}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          {
                            color:
                              diff > 0
                                ? colors.success
                                : diff < 0
                                  ? colors.error
                                  : colors.text.secondary,
                          },
                        ]}
                      >
                        {diff > 0 ? '+' : ''}
                        {diff.toFixed(0)}
                      </Text>
                    </View>
                  );
                })}
            </View>

            {/* Energy Table */}
            <Text style={[styles.tableTitle, { color: colors.text.primary, marginTop: 16 }]}>
              Energy (ft-lbs)
            </Text>
            <View style={styles.comparisonTable}>
              <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.tableHeaderCell, { color: colors.text.secondary }]}>Dist</Text>
                <Text style={[styles.tableHeaderCell, { color: colors.primary }]}>Ammo 1</Text>
                <Text style={[styles.tableHeaderCell, { color: colors.warning }]}>Ammo 2</Text>
                <Text style={[styles.tableHeaderCell, { color: colors.text.secondary }]}>Diff</Text>
              </View>

              {comparisonData
                .filter((_, i) => i % 2 === 0)
                .map((row) => {
                  const diff = row.ammo1Energy - row.ammo2Energy;
                  return (
                    <View
                      key={row.distance}
                      style={[styles.tableRow, { borderBottomColor: colors.border }]}
                    >
                      <Text style={[styles.tableCell, { color: colors.text.primary }]}>
                        {row.distance}
                      </Text>
                      <Text style={[styles.tableCell, { color: colors.primary }]}>
                        {row.ammo1Energy.toFixed(0)}
                      </Text>
                      <Text style={[styles.tableCell, { color: colors.warning }]}>
                        {row.ammo2Energy.toFixed(0)}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          {
                            color:
                              diff > 0
                                ? colors.success
                                : diff < 0
                                  ? colors.error
                                  : colors.text.secondary,
                          },
                        ]}
                      >
                        {diff > 0 ? '+' : ''}
                        {diff.toFixed(0)}
                      </Text>
                    </View>
                  );
                })}
            </View>
          </Card>
        )}

        {/* Legend */}
        {hasComparison && (
          <View style={[styles.legend, { backgroundColor: colors.surface }]}>
            <Text style={[styles.legendText, { color: colors.text.secondary }]}>
              Positive diff means Ammo 1 &gt; Ammo 2 • Green = higher • Red = lower
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// Helper component for specs rows
const SpecRow: React.FC<{
  label: string;
  value1: string;
  value2: string;
  colors: any;
  highlight?: boolean;
}> = ({ label, value1, value2, colors, highlight }) => (
  <View style={[styles.specsRow, { borderBottomColor: colors.border }]}>
    <Text style={[styles.specsLabel, { color: colors.text.secondary }]}>{label}</Text>
    <Text style={[styles.specsValue, { color: highlight ? colors.primary : colors.text.primary }]}>
      {value1}
    </Text>
    <Text style={[styles.specsValue, { color: highlight ? colors.warning : colors.text.primary }]}>
      {value2}
    </Text>
  </View>
);

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
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  rifleInfo: {
    fontSize: 14,
  },
  pickerRow: {
    marginBottom: 12,
  },
  pickerContainer: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  specsTable: {
    marginTop: 8,
  },
  specsHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  specsHeaderCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  specsRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  specsLabel: {
    flex: 1,
    fontSize: 13,
  },
  specsValue: {
    flex: 1,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  tableTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  comparisonTable: {
    marginTop: 4,
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
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  tableCell: {
    flex: 1,
    fontSize: 14,
    textAlign: 'center',
  },
  legend: {
    padding: 12,
    borderRadius: 8,
  },
  legendText: {
    fontSize: 11,
    textAlign: 'center',
  },
});
