/**
 * DOPE Curve Screen
 * Displays ballistic drop curve with actual DOPE data points overlaid
 */

import { Circle, Group, matchFont } from '@shopify/react-native-skia';
import * as Sharing from 'expo-sharing';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, ScrollView, Text, StyleSheet, Alert, Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import {
  CartesianChart,
  Line,
  getTransformComponents,
  setScale,
  setTranslate,
  useChartTransformState,
  type PointsArray,
} from 'victory-native';

import { Card, LoadingSpinner, EmptyState, SegmentedControl, Button } from '../components';
import { confidenceBand } from '../components/ConfidenceBadge';
import { InputCorrectionsCard } from '../components/InputCorrectionsCard';
import { OutlierList } from '../components/OutlierList';
import { useTheme } from '../contexts/ThemeContext';
import { useHorizontalChartPan } from '../hooks/useHorizontalChartPan';
import { useInputCorrections } from '../hooks/useInputCorrections';
import { useAmmoStore } from '../store/useAmmoStore';
import { useDOPEStore } from '../store/useDOPEStore';
import { useRifleStore } from '../store/useRifleStore';
import { confidenceOpacity } from '../utils/chartConfidence';
import {
  PAN_STEP,
  ZOOM_STEP,
  clampView,
  counterScale,
  panBy,
  resetView,
  zoomBy,
  type ChartView,
} from '../utils/chartZoom';
import { buildDropCurve, detectOutliers, type DropCurvePoint } from '../utils/dopeAnalysis';
import { formatCorrection } from '../utils/formatCorrection';
import { elevationTable } from '../utils/solverInputs';

import type { HistoryStackScreenProps } from '../navigation/types';

type Props = HistoryStackScreenProps<'DOPECurve'>;

interface DataPoint {
  distance: number;
  elevation: number;
}

/**
 * One x position on the chart. `logged` is set only where DOPE was logged, so
 * the logged line and its markers sit at real distances rather than on the
 * calculated curve's 50-yard grid.
 */
type ChartPoint = {
  distance: number;
  elevation: number;
  logged: number | undefined;
};

/** Radius of a logged-point marker, in chart pixels. */
const MARKER_RADIUS = 6;

/**
 * The axis labels' font. victory-native draws no tick labels at all without
 * one -- the chart had a grid and no numbers. A system font, so there is no
 * font file to bundle.
 */
const axisFont = () =>
  matchFont({
    fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
    fontSize: 12,
  });

/** "1 log", "3 logs". */
const logsLabel = (count: number): string => `${count} ${count === 1 ? 'log' : 'logs'}`;

/**
 * What the chart shows, in words. The chart is a Skia canvas, which a screen
 * reader cannot see into, and the markers show confidence only as opacity.
 */
const describeChart = (
  loggedCurve: DropCurvePoint[],
  maxDistance: number,
  unit: 'MIL' | 'MOA'
): string => {
  const calculated = `Elevation drop curve. Calculated curve from 100 to ${maxDistance} yards.`;
  if (loggedCurve.length === 0) return `${calculated} No logged DOPE.`;
  const points = loggedCurve.map(
    (p) =>
      `${p.distance} yards, ${p.correction.toFixed(1)} ${unit}, ` +
      `${logsLabel(p.sampleCount)}, ` +
      `${confidenceBand(p.confidence).toLowerCase()} confidence`
  );
  return `${calculated} Logged DOPE: ${points.join('; ')}.`;
};

/**
 * A marker at each logged point: filled at an opacity from its confidence, and
 * outlined at full strength so a faint point is still found.
 *
 * The chart draws in the text-grade tokens (primaryText, warningText), not the
 * fills: a line or outline needs 3:1 against the background (WCAG 1.4.11), and
 * on the light theme #4CAF50 and #FF9800 are 2.78:1 and 2.16:1 on white.
 */
const loggedMarkers = (
  points: PointsArray,
  confidenceAt: Map<number, number>,
  color: string,
  keepRound: SharedValue<{ scaleX: number }[]>
): React.ReactNode[] =>
  points.map((point) => {
    if (point.y === undefined || point.y === null) return null;
    const opacity = confidenceOpacity(confidenceAt.get(Number(point.xValue)) ?? 0);
    return (
      // Under the inverse of the zoom, around the marker's own centre, so it
      // stays round rather than stretching with the distance axis.
      <Group key={point.xValue} origin={{ x: point.x, y: point.y }} transform={keepRound}>
        <Circle cx={point.x} cy={point.y} r={MARKER_RADIUS} color={color} opacity={opacity} />
        <Circle
          cx={point.x}
          cy={point.y}
          r={MARKER_RADIUS}
          color={color}
          style="stroke"
          strokeWidth={2}
        />
      </Group>
    );
  });

/**
 * Single-tap zoom and pan. The chart also takes pinch and a pan gesture, which
 * need a single-pointer alternative (WCAG 2.5.1). Outside the exported area:
 * controls have no place in the PNG.
 */
const ZoomControls: React.FC<{
  onZoom: (factor: number) => void;
  onPan: (steps: number) => void;
  onReset: () => void;
}> = ({ onZoom, onPan, onReset }) => (
  <View style={styles.zoomControls}>
    <View style={styles.zoomRow}>
      <Button
        title="Zoom out"
        onPress={() => onZoom(1 / ZOOM_STEP)}
        variant="secondary"
        size="small"
        style={styles.zoomButton}
      />
      <Button
        title="Zoom in"
        onPress={() => onZoom(ZOOM_STEP)}
        variant="secondary"
        size="small"
        style={styles.zoomButton}
      />
    </View>
    <View style={styles.zoomRow}>
      <Button
        title="Shorter"
        accessibilityLabel="Show shorter distances"
        accessibilityHint="Moves the zoomed chart toward shorter distances"
        onPress={() => onPan(-PAN_STEP)}
        variant="secondary"
        size="small"
        style={styles.zoomButton}
      />
      <Button
        title="Longer"
        accessibilityLabel="Show longer distances"
        accessibilityHint="Moves the zoomed chart toward longer distances"
        onPress={() => onPan(PAN_STEP)}
        variant="secondary"
        size="small"
        style={styles.zoomButton}
      />
      <Button
        title="Whole curve"
        accessibilityLabel="Show the whole curve"
        accessibilityHint="Resets the zoom so every distance shows"
        onPress={onReset}
        variant="secondary"
        size="small"
        style={styles.zoomButton}
      />
    </View>
  </View>
);

/** Key to the chart's two lines, and what a marker's opacity means. */
const ChartLegend: React.FC<{ loggedCount: number }> = ({ loggedCount }) => {
  const { colors } = useTheme().theme;
  return (
    <>
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: colors.primaryText }]} />
          <Text style={[styles.legendText, { color: colors.text.secondary }]}>
            Calculated Curve
          </Text>
        </View>
        {loggedCount > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.warningText }]} />
            <Text style={[styles.legendText, { color: colors.text.secondary }]}>
              Actual DOPE ({logsLabel(loggedCount)})
            </Text>
          </View>
        )}
      </View>
      {loggedCount > 0 && (
        <Text style={[styles.legendNote, { color: colors.text.secondary }]}>
          Fainter points rest on less evidence: fewer shots, fewer hits or a wider group.
        </Text>
      )}
    </>
  );
};

export const DOPECurve: React.FC<Props> = ({ route }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const { rifleId, ammoId } = route.params;

  const { rifles } = useRifleStore();
  const { ammoProfiles } = useAmmoStore();
  const { dopeLogs } = useDOPEStore();

  const [correctionUnit, setCorrectionUnit] = useState<'MIL' | 'MOA'>('MIL');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const chartRef = useRef<View>(null);

  const rifle = rifles.find((r) => r.id === rifleId);
  const ammo = ammoProfiles.find((a) => a.id === ammoId);

  // Filter DOPE logs for this rifle/ammo combination
  const filteredLogs = useMemo(() => {
    return dopeLogs.filter((log) => log.rifleId === rifleId && log.ammoId === ammoId);
  }, [dopeLogs, rifleId, ammoId]);

  // The drop curve the logs themselves describe: one point per distance, in
  // yards and the selected unit, the median correction there, and how well the
  // logs behind it are evidenced (#64, #123).
  const loggedCurve = useMemo(
    () => buildDropCurve(filteredLogs, correctionUnit),
    [filteredLogs, correctionUnit]
  );
  const loggedCount = loggedCurve.reduce((sum, p) => sum + p.sampleCount, 0);

  const maxDistance = Math.max(1000, ...loggedCurve.map((p) => p.distance));

  // Standard atmosphere: the curve is a reference line, not any one day. One
  // trajectory read at every point, rather than a full solve per point.
  const table = useMemo(
    () =>
      rifle && ammo
        ? elevationTable(rifle, ammo, undefined, maxDistance, correctionUnit)
        : undefined,
    [rifle, ammo, maxDistance, correctionUnit]
  );

  // Generate calculated ballistic curve
  const calculatedCurve: DataPoint[] = useMemo(() => {
    if (!table) return [];
    const distances: number[] = [];
    for (let d = 100; d <= maxDistance; d += 50) {
      distances.push(d);
    }
    return distances.map((distance) => ({ distance, elevation: table(distance) ?? 0 }));
  }, [table, maxDistance]);

  // The calculated grid plus every logged distance, so both lines share one x
  // axis and each logged point is drawn where it was shot.
  const chartData: ChartPoint[] = useMemo(() => {
    if (!table) return [];
    const loggedAt = new Map(loggedCurve.map((p) => [p.distance, p.correction]));
    const distances = [
      ...new Set([...calculatedCurve.map((p) => p.distance), ...loggedAt.keys()]),
    ].sort((a, b) => a - b);
    return distances.map((distance) => ({
      distance,
      elevation: table(distance) ?? 0,
      logged: loggedAt.get(distance),
    }));
  }, [table, calculatedCurve, loggedCurve]);

  const confidenceAt = useMemo(
    () => new Map(loggedCurve.map((p) => [p.distance, p.confidence])),
    [loggedCurve]
  );

  const font = useMemo(axisFont, []);

  // Zoom and pan along the distance axis. Gestures and buttons share one
  // matrix; the buttons read it live, so they continue from wherever a pinch
  // left the chart.
  const { state: transformState } = useChartTransformState();
  const [plotWidth, setPlotWidth] = useState(0);
  const horizontalPan = useHorizontalChartPan(transformState);
  const chartGestures = useMemo(() => Gesture.Race(horizontalPan), [horizontalPan]);
  // The plot width on the UI thread, where the snap-back below runs. Written
  // from onChartBoundsChange, never during render: Reanimated drops a write
  // made while React renders, which left this 0 and snapped every zoom to 1x.
  const plotWidthOnUi = useSharedValue(0);

  // victory-native's pinch and pan have no limits: a pinch could zoom out
  // past 1x and squeeze the curve into part of an empty chart. Once both
  // gestures are idle, bring the view back into range.
  useAnimatedReaction(
    () => ({
      idle: !transformState.zoomActive.value && !transformState.panActive.value,
      matrix: transformState.matrix.value,
    }),
    ({ idle, matrix }) => {
      if (!idle) return;
      const { scaleX, translateX } = getTransformComponents(matrix);
      const next = clampView({ scale: scaleX, translate: translateX }, plotWidthOnUi.value);
      if (next.scale !== scaleX || next.translate !== translateX) {
        transformState.matrix.value = setTranslate(
          setScale(matrix, next.scale, 1),
          next.translate,
          0
        );
      }
    }
  );

  const keepMarkersRound = useDerivedValue(() =>
    counterScale(getTransformComponents(transformState.matrix.value).scaleX)
  );
  const currentView = (): ChartView => {
    const { scaleX, translateX } = getTransformComponents(transformState.matrix.value);
    return { scale: scaleX, translate: translateX };
  };
  const showView = (next: ChartView) => {
    transformState.matrix.value = setTranslate(
      setScale(transformState.matrix.value, next.scale, 1),
      next.translate,
      0
    );
  };

  const chartLabel = useMemo(
    () => describeChart(loggedCurve, maxDistance, correctionUnit),
    [loggedCurve, maxDistance, correctionUnit]
  );

  const outliers = useMemo(
    () => detectOutliers(filteredLogs, correctionUnit),
    [filteredLogs, correctionUnit]
  );

  const { corrections, applyCorrection } = useInputCorrections({
    logs: filteredLogs,
    rifle,
    ammo,
    unit: correctionUnit,
  });

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleExportImage = async () => {
    if (!chartRef.current) {
      Alert.alert('Error', 'Chart not available for export');
      return;
    }

    setIsExporting(true);
    try {
      // Capture the chart view as an image
      const uri = await captureRef(chartRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      // Share the image
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Export Ballistic Curve',
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
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: colors.text.primary }]}>
              Elevation Drop Curve
            </Text>
            <Button
              title={isExporting ? 'Exporting...' : 'Export'}
              onPress={handleExportImage}
              variant="secondary"
              size="small"
              disabled={isExporting || !hasData}
            />
          </View>

          {/* Everything Export captures: the PNG is read away from the app, so it
              carries the axis units and the legend, not just the plot. */}
          <View
            ref={chartRef}
            collapsable={false}
            testID="chart-export"
            style={[styles.exportArea, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.axisCaption, { color: colors.text.secondary }]}>
              {`Elevation (${correctionUnit}) by distance (yards)`}
            </Text>

            {hasData ? (
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={chartLabel}
                accessibilityHint="The Drop Table below lists the same values."
                style={[
                  styles.chartContainer,
                  { height: chartHeight, backgroundColor: colors.background },
                ]}
              >
                <CartesianChart<ChartPoint, 'distance', 'elevation' | 'logged'>
                  data={chartData}
                  xKey="distance"
                  yKeys={['elevation', 'logged']}
                  domainPadding={{ left: 10, right: 10, top: 20, bottom: 10 }}
                  transformState={transformState}
                  // Distance only: scaling MIL too would stretch the elevation
                  // axis. victory-native's pan is replaced by one that lets a
                  // vertical drag through to the page scroll.
                  transformConfig={{ pinch: { dimensions: 'x' }, pan: { enabled: false } }}
                  customGestures={chartGestures}
                  onChartBoundsChange={({ left, right }) => {
                    plotWidthOnUi.value = right - left;
                    if (right - left !== plotWidth) setPlotWidth(right - left);
                  }}
                  axisOptions={{
                    font,
                    tickCount: { x: 5, y: 5 },
                    lineColor: colors.border,
                    labelColor: colors.text.secondary,
                    formatXLabel: (value: number) => `${value}`,
                    formatYLabel: (value?: number) =>
                      value === undefined ? '' : formatCorrection(value),
                  }}
                >
                  {({ points }) => (
                    <>
                      <Line
                        points={points.elevation}
                        color={colors.primaryText}
                        strokeWidth={2}
                        curveType="natural"
                      />
                      <Line
                        points={points.logged}
                        color={colors.warningText}
                        strokeWidth={2}
                        curveType="linear"
                        connectMissingData
                      />
                      {loggedMarkers(
                        points.logged,
                        confidenceAt,
                        colors.warningText,
                        keepMarkersRound
                      )}
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

            <ChartLegend loggedCount={loggedCount} />
          </View>

          {hasData && (
            <ZoomControls
              onZoom={(factor) => showView(zoomBy(currentView(), factor, plotWidth))}
              onPan={(steps) => showView(panBy(currentView(), steps, plotWidth))}
              onReset={() => showView(resetView())}
            />
          )}
        </Card>

        <InputCorrectionsCard corrections={corrections} onApply={applyCorrection} />
        <OutlierList outliers={outliers} unit={correctionUnit} />

        {/* Data Table */}
        <Card style={styles.tableCard}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Drop Table</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { color: colors.text.secondary }]}>Distance</Text>
            <Text style={[styles.tableHeaderCell, { color: colors.text.secondary }]}>
              Calculated ({correctionUnit})
            </Text>
            {loggedCurve.length > 0 && (
              <Text style={[styles.tableHeaderCell, { color: colors.text.secondary }]}>
                Actual ({correctionUnit})
              </Text>
            )}
          </View>
          {calculatedCurve
            .filter((_, i) => i % 2 === 0)
            .map((point) => {
              const actualPoint = loggedCurve.find(
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
                    {formatCorrection(point.elevation)}
                  </Text>
                  {loggedCurve.length > 0 && (
                    <Text
                      style={[
                        styles.tableCell,
                        { color: actualPoint ? colors.warningText : colors.text.secondary },
                      ]}
                    >
                      {actualPoint ? formatCorrection(actualPoint.correction) : '-'}
                    </Text>
                  )}
                </View>
              );
            })}
        </Card>

        {/* Data Summary */}
        <Card style={styles.summaryCard}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Data Summary</Text>

          {loggedCurve.length === 0 ? (
            <Text style={[styles.noDataText, { color: colors.text.secondary }]}>
              No DOPE logs recorded for this rifle/ammo combination.
              {'\n'}Log some shots to see your actual data compared to the calculated curve.
            </Text>
          ) : (
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
                  {loggedCount}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.text.secondary }]}>
                  Data Points
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
                  {`${Math.min(...loggedCurve.map((p) => p.distance))} yds`}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.text.secondary }]}>
                  Min Distance
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
                  {`${Math.max(...loggedCurve.map((p) => p.distance))} yds`}
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
            The calculated curve uses standard atmospheric conditions (59°F, 29.92 inHg). Your
            actual DOPE may vary based on environmental conditions.
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
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Reaches as far as the chart's negative margin, so Export does not clip the
  // chart's left edge; the padding keeps everything else where it was.
  exportArea: {
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  axisCaption: {
    fontSize: 12,
    marginBottom: 8,
  },
  chartContainer: {
    marginHorizontal: -8,
  },
  noChartData: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomControls: {
    marginTop: 12,
    gap: 8,
  },
  zoomRow: {
    flexDirection: 'row',
    gap: 8,
  },
  zoomButton: {
    flex: 1,
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
  legendNote: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
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
