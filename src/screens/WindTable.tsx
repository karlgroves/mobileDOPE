/**
 * Wind Table Screen
 * Displays comprehensive wind drift data for various distances and wind speeds
 * Includes both table view and chart visualization
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { CartesianChart, Line } from 'victory-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../contexts/ThemeContext';
import { UnitToggle } from '../components/UnitToggle';
import { NumberPicker } from '../components/NumberPicker';
import { SegmentedControl, Button } from '../components';
import type { CalculatorStackScreenProps } from '../navigation/types';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { generateComprehensiveWindTable, WindTableEntry } from '../utils/windTable';
import { calculateAtmosphericConditions } from '../utils/atmospheric';
import type { RifleConfig, AmmoConfig } from '../types/ballistic.types';

// Chart data point interface with index signature for CartesianChart
interface ChartDataPoint {
  distance: number;
  [key: string]: number;
}

type Props = CalculatorStackScreenProps<'WindTable'>;

// Wind direction presets (sorted by degrees)
const WIND_DIRECTIONS = [
  { label: '↑ 1:00', value: 30 },
  { label: '↗ 2:00', value: 60 },
  { label: '→ 3:00 (Full R-L)', value: 90 },
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
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [isExporting, setIsExporting] = useState(false);
  const chartRef = useRef<View>(null);

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
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to generate wind table'
      );
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

  // Prepare chart data - group by distance with separate keys for each wind speed
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (windTable.length === 0) return [];

    return distances.map((distance) => {
      const point: ChartDataPoint = { distance };
      windSpeeds.forEach((speed) => {
        const entry = windTable.find((e) => e.distance === distance && e.windSpeed === speed);
        if (entry) {
          // Use wind drift (inches) for chart - more intuitive visualization
          point[`wind${speed}`] = Math.abs(entry.windDrift);
        } else {
          point[`wind${speed}`] = 0;
        }
      });
      return point;
    });
  }, [windTable, distances, windSpeeds]);

  // Wind speed chart colors
  const windChartColors = [
    colors.text.disabled, // 0 mph
    '#4CAF50', // 5 mph - green
    '#FFC107', // 10 mph - yellow
    '#FF9800', // 15 mph - orange
    '#F44336', // 20 mph - red
  ];

  const chartHeight = 250;

  const handleExportChart = async () => {
    if (!chartRef.current) {
      Alert.alert('Error', 'Chart not available for export');
      return;
    }

    setIsExporting(true);
    try {
      const uri = await captureRef(chartRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Export Wind Chart',
          UTI: 'public.png',
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsExporting(false);
    }
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

        <View style={styles.controlRow}>
          <SegmentedControl
            options={[
              { label: 'Table', value: 'table' },
              { label: 'Chart', value: 'chart' },
            ]}
            selectedValue={viewMode}
            onValueChange={(value) => setViewMode(value as 'table' | 'chart')}
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

      {/* Wind Table or Chart */}
      <ScrollView style={styles.scrollView} horizontal={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
              Generating wind table...
            </Text>
          </View>
        ) : viewMode === 'chart' ? (
          /* Wind Drift Chart View */
          <View style={styles.chartSection}>
            <View style={[styles.chartCard, { backgroundColor: colors.surface }]}>
              <View style={styles.chartHeaderRow}>
                <View>
                  <Text style={[styles.chartTitle, { color: colors.text.primary }]}>
                    Wind Drift vs Distance
                  </Text>
                  <Text style={[styles.chartSubtitle, { color: colors.text.secondary }]}>
                    Wind direction: {getWindDirectionLabel(windDirection)}
                  </Text>
                </View>
                <Button
                  title={isExporting ? 'Exporting...' : 'Export'}
                  onPress={handleExportChart}
                  variant="secondary"
                  size="small"
                  disabled={isExporting || chartData.length === 0}
                />
              </View>

              {chartData.length > 0 ? (
                <View ref={chartRef} collapsable={false} style={[styles.chartContainer, { height: chartHeight, backgroundColor: colors.surface }]}>
                  <CartesianChart<ChartDataPoint, 'distance', 'wind5' | 'wind10' | 'wind15' | 'wind20'>
                    data={chartData}
                    xKey="distance"
                    yKeys={['wind5', 'wind10', 'wind15', 'wind20']}
                    domainPadding={{ left: 10, right: 10, top: 20, bottom: 10 }}
                    axisOptions={{
                      font: null,
                      tickCount: { x: 5, y: 5 },
                      lineColor: colors.border,
                      labelColor: colors.text.secondary,
                      formatXLabel: (value: number) => `${value}`,
                      formatYLabel: (value: number) => `${value.toFixed(1)}"`,
                    }}
                  >
                    {({ points }) => (
                      <>
                        <Line points={points.wind5} color={windChartColors[1]} strokeWidth={2} curveType="natural" />
                        <Line points={points.wind10} color={windChartColors[2]} strokeWidth={2} curveType="natural" />
                        <Line points={points.wind15} color={windChartColors[3]} strokeWidth={2} curveType="natural" />
                        <Line points={points.wind20} color={windChartColors[4]} strokeWidth={2} curveType="natural" />
                      </>
                    )}
                  </CartesianChart>
                </View>
              ) : (
                <View style={[styles.noChartData, { height: chartHeight }]}>
                  <Text style={[styles.noDataText, { color: colors.text.secondary }]}>
                    No wind data available
                  </Text>
                </View>
              )}

              {/* Chart Legend */}
              <View style={styles.chartLegend}>
                {windSpeeds.slice(1).map((speed, index) => (
                  <View key={speed} style={styles.legendItem}>
                    <View style={[styles.legendLine, { backgroundColor: windChartColors[index + 1] }]} />
                    <Text style={[styles.legendText, { color: colors.text.secondary }]}>
                      {speed} mph
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Y-Axis Label */}
            <Text style={[styles.axisLabel, { color: colors.text.secondary }]}>
              Wind Drift (inches)
            </Text>
            <Text style={[styles.xAxisLabel, { color: colors.text.secondary }]}>
              Distance (yards)
            </Text>
          </View>
        ) : (
          /* Table View */
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
                              {
                                color:
                                  entry.windSpeed === 0 ? colors.text.disabled : colors.primary,
                              },
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
  // Chart view styles
  chartSection: {
    padding: 16,
  },
  chartCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  chartSubtitle: {
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  chartContainer: {
    marginHorizontal: -8,
  },
  noChartData: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 14,
    textAlign: 'center',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendLine: {
    width: 20,
    height: 3,
    borderRadius: 1.5,
  },
  axisLabel: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  xAxisLabel: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
});
