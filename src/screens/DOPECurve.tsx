/**
 * DOPE Curve Screen
 * Displays ballistic drop curve with actual DOPE data points overlaid
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, Text, StyleSheet, Dimensions } from 'react-native';
import { CartesianChart, Line } from 'victory-native';
import { Circle } from '@shopify/react-native-skia';
import { useTheme } from '../contexts/ThemeContext';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import { useDOPEStore } from '../store/useDOPEStore';
import { Card, LoadingSpinner, EmptyState, SegmentedControl } from '../components';
import { calculateBallisticSolution } from '../utils/ballistics';
import type { HistoryStackScreenProps } from '../navigation/types';
import type { RifleConfig, AmmoConfig, ShotParameters } from '../types/ballistic.types';
import type { AtmosphericConditions } from '../utils/atmospheric';

type Props = HistoryStackScreenProps<'DOPECurve'>;

interface DataPoint {
  distance: number;
  elevation: number;
  [key: string]: number; // Index signature for CartesianChart compatibility
}

export const DOPECurve: React.FC<Props> = ({ route }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const { rifleId, ammoId } = route.params;

  const { rifles } = useRifleStore();
  const { ammoProfiles } = useAmmoStore();
  const { dopeLogs } = useDOPEStore();

  const [correctionUnit, setCorrectionUnit] = useState<'MIL' | 'MOA'>('MIL');
  const [isLoading, setIsLoading] = useState(true);

  const rifle = rifles.find((r) => r.id === rifleId);
  const ammo = ammoProfiles.find((a) => a.id === ammoId);

  // Filter DOPE logs for this rifle/ammo combination
  const filteredLogs = useMemo(() => {
    return dopeLogs.filter(
      (log) => log.rifleId === rifleId && log.ammoId === ammoId
    );
  }, [dopeLogs, rifleId, ammoId]);

  // Convert DOPE logs to data points
  const actualDataPoints: DataPoint[] = useMemo(() => {
    return filteredLogs
      .filter((log) => log.distance && log.elevationCorrection !== undefined)
      .map((log) => {
        let correction = log.elevationCorrection || 0;
        // Convert if needed
        if (log.correctionUnit !== correctionUnit) {
          correction = log.correctionUnit === 'MIL'
            ? correction * 3.438 // MIL to MOA
            : correction / 3.438; // MOA to MIL
        }
        return {
          distance: log.distance || 0,
          elevation: correction,
        };
      })
      .sort((a, b) => a.distance - b.distance);
  }, [filteredLogs, correctionUnit]);

  // Generate calculated ballistic curve
  const calculatedCurve: DataPoint[] = useMemo(() => {
    if (!rifle || !ammo) return [];

    const distances: number[] = [];
    const maxDistance = Math.max(1000, ...actualDataPoints.map((p) => p.distance));

    for (let d = 100; d <= maxDistance; d += 50) {
      distances.push(d);
    }

    // Build configs for ballistic calculator
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

    const atmosphere: AtmosphericConditions = {
      temperature: 59,
      pressure: 29.92,
      humidity: 50,
      altitude: 0,
    };

    return distances.map((distance) => {
      const shot: ShotParameters = {
        distance,
        angle: 0,
        windSpeed: 0,
        windDirection: 0,
      };

      const solution = calculateBallisticSolution(rifleConfig, ammoConfig, shot, atmosphere);

      const correction = correctionUnit === 'MIL'
        ? solution.elevationMIL
        : solution.elevationMOA;

      return { distance, elevation: correction };
    });
  }, [rifle, ammo, correctionUnit, actualDataPoints]);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 64;
  const chartHeight = 280;

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <LoadingSpinner />
      </View>
    );
  }

  if (!rifle || !ammo) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          title="Profile Not Found"
          message="The selected rifle or ammunition profile could not be found."
        />
      </View>
    );
  }

  // Combine data for chart display
  const hasData = calculatedCurve.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <Card style={styles.headerCard}>
          <Text style={[styles.rifleName, { color: colors.text.primary }]}>{rifle.name}</Text>
          <Text style={[styles.ammoName, { color: colors.text.secondary }]}>{ammo.name}</Text>
          <Text style={[styles.details, { color: colors.text.secondary }]}>
            {ammo.bulletWeight}gr @ {ammo.muzzleVelocity} fps • Zero: {rifle.zeroDistance} yds
          </Text>
        </Card>

        {/* Unit Toggle */}
        <View style={styles.toggleContainer}>
          <SegmentedControl
            options={[
              { label: 'MIL', value: 'MIL' },
              { label: 'MOA', value: 'MOA' },
            ]}
            selectedValue={correctionUnit}
            onValueChange={(value) => setCorrectionUnit(value as 'MIL' | 'MOA')}
          />
        </View>

        {/* Chart */}
        <Card style={styles.chartCard}>
          <Text style={[styles.chartTitle, { color: colors.text.primary }]}>
            Elevation Drop Curve
          </Text>

          {hasData ? (
            <View style={[styles.chartContainer, { height: chartHeight }]}>
              <CartesianChart<DataPoint, 'distance', 'elevation'>
                data={calculatedCurve}
                xKey="distance"
                yKeys={['elevation']}
                domainPadding={{ left: 10, right: 10, top: 20, bottom: 10 }}
                axisOptions={{
                  font: null,
                  tickCount: { x: 5, y: 5 },
                  lineColor: colors.border,
                  labelColor: colors.text.secondary,
                  formatXLabel: (value: number) => `${value}`,
                  formatYLabel: (value: number) => `${value.toFixed(1)}`,
                }}
              >
                {({ points }) => (
                  <>
                    <Line
                      points={points.elevation}
                      color={colors.primary}
                      strokeWidth={2}
                      curveType="natural"
                    />
                  </>
                )}
              </CartesianChart>
            </View>
          ) : (
            <View style={[styles.noChartData, { height: chartHeight }]}>
              <Text style={[styles.noDataText, { color: colors.text.secondary }]}>
                Unable to generate ballistic curve.
              </Text>
            </View>
          )}

          {/* Legend */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: colors.primary }]} />
              <Text style={[styles.legendText, { color: colors.text.secondary }]}>
                Calculated Curve
              </Text>
            </View>
            {actualDataPoints.length > 0 && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
                <Text style={[styles.legendText, { color: colors.text.secondary }]}>
                  Actual DOPE ({actualDataPoints.length} points)
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Data Table */}
        <Card style={styles.tableCard}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Drop Table
          </Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { color: colors.text.secondary }]}>Distance</Text>
            <Text style={[styles.tableHeaderCell, { color: colors.text.secondary }]}>
              Calculated ({correctionUnit})
            </Text>
            {actualDataPoints.length > 0 && (
              <Text style={[styles.tableHeaderCell, { color: colors.text.secondary }]}>
                Actual ({correctionUnit})
              </Text>
            )}
          </View>
          {calculatedCurve.filter((_, i) => i % 2 === 0).map((point) => {
            const actualPoint = actualDataPoints.find(
              (ap) => Math.abs(ap.distance - point.distance) < 25
            );
            return (
              <View
                key={point.distance}
                style={[styles.tableRow, { borderBottomColor: colors.border }]}
              >
                <Text style={[styles.tableCell, { color: colors.text.primary }]}>
                  {point.distance} yds
                </Text>
                <Text style={[styles.tableCell, { color: colors.text.primary }]}>
                  {point.elevation.toFixed(1)}
                </Text>
                {actualDataPoints.length > 0 && (
                  <Text
                    style={[
                      styles.tableCell,
                      { color: actualPoint ? colors.warning : colors.text.secondary },
                    ]}
                  >
                    {actualPoint ? actualPoint.elevation.toFixed(1) : '-'}
                  </Text>
                )}
              </View>
            );
          })}
        </Card>

        {/* Data Summary */}
        <Card style={styles.summaryCard}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Data Summary
          </Text>

          {actualDataPoints.length === 0 ? (
            <Text style={[styles.noDataText, { color: colors.text.secondary }]}>
              No DOPE logs recorded for this rifle/ammo combination.
              {'\n'}Log some shots to see your actual data compared to the calculated curve.
            </Text>
          ) : (
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
                  {actualDataPoints.length}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.text.secondary }]}>
                  Data Points
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
                  {Math.min(...actualDataPoints.map((p) => p.distance))}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.text.secondary }]}>
                  Min Distance
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
                  {Math.max(...actualDataPoints.map((p) => p.distance))}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.text.secondary }]}>
                  Max Distance
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* Info Note */}
        <View style={[styles.infoNote, { backgroundColor: colors.surface }]}>
          <Text style={[styles.infoText, { color: colors.text.secondary }]}>
            The calculated curve uses standard atmospheric conditions (59°F, 29.92 inHg).
            Your actual DOPE may vary based on environmental conditions.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  headerCard: {
    marginBottom: 16,
  },
  rifleName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  ammoName: {
    fontSize: 16,
    marginBottom: 4,
  },
  details: {
    fontSize: 14,
  },
  toggleContainer: {
    marginBottom: 16,
  },
  chartCard: {
    marginBottom: 16,
    padding: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  chartContainer: {
    marginHorizontal: -8,
  },
  noChartData: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendLine: {
    width: 20,
    height: 3,
    borderRadius: 1.5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
  },
  tableCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
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
  },
  summaryCard: {
    marginBottom: 16,
  },
  noDataText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  infoNote: {
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
