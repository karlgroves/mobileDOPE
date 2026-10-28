/**
 * Saved environmental conditions: edit one, or compare two (#62).
 *
 * Two of this issue's boxes need the same thing and neither can be built
 * without it. "Allow editing of saved environmental data" needs somewhere to
 * choose which reading to edit, and "compare environmental conditions across
 * sessions" needs somewhere to choose the two. `useEnvironmentStore` holds
 * `current` plus a flat `snapshots` array and nothing has ever listed it.
 *
 * `src/utils/environmentComparison.ts` has existed, tested, since before this
 * screen, with no caller at all -- the issue's own comment says so. The reason
 * it was left that way is worth keeping in view: comparing `current` against
 * the most recent snapshot without being asked would have produced a comparison
 * nobody requested, between two things the shooter did not choose, and ticked
 * the box while leaving the feature unbuilt. This is the affordance that was
 * missing.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable } from 'react-native';

import { Card, Button, EmptyState, LoadingSpinner } from '../components';
import { useTheme } from '../contexts/ThemeContext';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import {
  compareEnvironments,
  describeEnvironmentDelta,
  summariseConditions,
} from '../utils/environmentComparison';
import { formatDateTime } from '../utils/formatting';
import { snapshotTime } from '../utils/matchConditions';

import type { SessionStackScreenProps } from '../navigation/types';

type Props = SessionStackScreenProps<'EnvironmentHistory'>;

/**
 * When a reading was taken, in words.
 *
 * Goes through `snapshotTime` rather than `new Date(timestamp)` because the
 * schema default writes `YYYY-MM-DD HH:MM:SS` in UTC with no zone, which a bare
 * `Date` constructor reads as local time -- hours out anywhere but UTC. The
 * same reasoning, and the same helper, as #190's ranking.
 */
const recordedAt = (timestamp: string | undefined): string => {
  const at = snapshotTime(timestamp);
  return at === undefined ? 'Time not recorded' : formatDateTime(new Date(at));
};

/** How many readings can be selected for a comparison at once. */
const COMPARISON_SIZE = 2;

export const EnvironmentHistory: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const { snapshots, loadSnapshots, deleteSnapshot, loading } = useEnvironmentStore();

  /**
   * The ids chosen for comparison, oldest choice first.
   *
   * A third selection drops the first rather than refusing, so the shooter can
   * walk through a list comparing each reading with the one they are holding on
   * to, without having to clear the selection between pairs.
   */
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    loadSnapshots().catch((error) => {
      console.error('Failed to load environment snapshots:', error);
      Alert.alert('Error', 'Could not load your saved conditions.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: number) => {
    setSelected((chosen) => {
      if (chosen.includes(id)) return chosen.filter((candidate) => candidate !== id);
      return [...chosen, id].slice(-COMPARISON_SIZE);
    });
  };

  /**
   * The comparison, earlier reading first.
   *
   * Ordered by when the conditions were *measured*, not by the order they were
   * tapped: `compareEnvironments` reports `later - earlier`, so a shooter who
   * happened to tap the older one second would be told the air got thinner when
   * it got denser. An unreadable timestamp falls back to the list's own order,
   * which is newest first.
   */
  const comparison = useMemo(() => {
    if (selected.length !== COMPARISON_SIZE) return undefined;

    const chosen = selected
      .map((id) => snapshots.find((snapshot) => snapshot.id === id))
      .filter((snapshot): snapshot is NonNullable<typeof snapshot> => snapshot !== undefined);
    if (chosen.length !== COMPARISON_SIZE) return undefined;

    const byMeasurement = [...chosen].sort((a, b) => {
      const at = snapshotTime(a.timestamp);
      const bt = snapshotTime(b.timestamp);
      if (at === undefined || bt === undefined) {
        return snapshots.indexOf(b) - snapshots.indexOf(a);
      }
      return at - bt;
    });

    const [earlier, later] = byMeasurement;
    return {
      earlier,
      later,
      change: compareEnvironments(earlier, later),
    };
  }, [selected, snapshots]);

  const confirmDelete = (id: number) => {
    Alert.alert(
      'Delete Reading',
      'Delete this set of conditions? A DOPE log that was shot in them keeps its own copy, ' +
        'so your logs are unaffected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSnapshot(id);
              setSelected((chosen) => chosen.filter((candidate) => candidate !== id));
            } catch (error) {
              console.error('Failed to delete snapshot:', error);
              Alert.alert('Error', 'Could not delete this reading.');
            }
          },
        },
      ]
    );
  };

  if (loading && snapshots.length === 0) {
    return <LoadingSpinner />;
  }

  if (snapshots.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          title="No Saved Conditions"
          message="Record the weather on the Environmental Data screen and it will be listed here, ready to compare."
          actionLabel="Record Conditions"
          onAction={() => navigation.navigate('EnvironmentInput')}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* The comparison, once two are chosen. A headline in words rather than
            four deltas to interpret -- see `environmentComparison`'s own
            reasoning for why density altitude is the one figure that answers
            "why did today not match my DOPE?". */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Compare</Text>
          {comparison === undefined ? (
            <Text
              style={[styles.helpText, { color: colors.text.secondary }]}
              testID="compare-prompt"
            >
              {selected.length === 0
                ? 'Choose two readings below to see how the air changed between them.'
                : 'Choose one more reading to compare.'}
            </Text>
          ) : (
            <View testID="comparison">
              <Text
                style={[styles.comparisonHeadline, { color: colors.text.primary }]}
                testID="comparison-summary"
              >
                {describeEnvironmentDelta(comparison.change)}
              </Text>
              <Text style={[styles.helpText, { color: colors.text.secondary }]}>
                {`${recordedAt(comparison.earlier.timestamp)} → ${recordedAt(
                  comparison.later.timestamp
                )}`}
              </Text>
              {comparison.change.significant && (
                <Text
                  style={[styles.significantNote, { color: colors.warningText }]}
                  testID="comparison-significant"
                >
                  Enough to matter to a solution — expect your DOPE from the earlier day to need
                  adjusting.
                </Text>
              )}
              <View style={styles.deltaGrid}>
                {[
                  {
                    label: 'Density altitude',
                    value: comparison.change.densityAltitudeDelta,
                    unit: 'ft',
                    places: 0,
                  },
                  {
                    label: 'Temperature',
                    value: comparison.change.temperatureDelta,
                    unit: '°F',
                    places: 1,
                  },
                  {
                    label: 'Pressure',
                    value: comparison.change.pressureDelta,
                    unit: 'inHg',
                    places: 2,
                  },
                  {
                    label: 'Wind',
                    value: comparison.change.windSpeedDelta,
                    unit: 'mph',
                    places: 1,
                  },
                ].map((row) => (
                  <View key={row.label} style={styles.deltaRow}>
                    <Text style={[styles.deltaLabel, { color: colors.text.secondary }]}>
                      {row.label}
                    </Text>
                    <Text style={[styles.deltaValue, { color: colors.text.primary }]}>
                      {row.value === undefined
                        ? '—'
                        : `${row.value >= 0 ? '+' : ''}${row.value.toFixed(row.places)} ${row.unit}`}
                    </Text>
                  </View>
                ))}
              </View>
              <Button
                title="Clear Selection"
                onPress={() => setSelected([])}
                variant="secondary"
                size="small"
              />
            </View>
          )}
        </Card>

        {snapshots.map((snapshot) => {
          const id = snapshot.id;
          if (id === undefined) return null;
          const isSelected = selected.includes(id);
          const summary = summariseConditions(snapshot);

          return (
            <Card key={id} style={styles.card}>
              <Pressable
                onPress={() => toggle(id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`Conditions recorded ${recordedAt(snapshot.timestamp)}`}
                accessibilityHint="Choose two readings to compare the air between them"
                testID={`snapshot-${id}`}
                style={[
                  styles.row,
                  isSelected && { borderColor: colors.primary, borderWidth: 2, borderRadius: 8 },
                ]}
              >
                <View style={styles.rowHeader}>
                  <Text style={[styles.rowDate, { color: colors.text.primary }]}>
                    {recordedAt(snapshot.timestamp)}
                  </Text>
                  {/* The selection is named in words, not only drawn as a border
                      (WCAG 1.4.1), and the accessible state carries it too. */}
                  <Text style={[styles.rowSelected, { color: colors.primaryText }]}>
                    {isSelected ? 'Selected' : ''}
                  </Text>
                </View>
                <Text style={[styles.rowConditions, { color: colors.text.secondary }]}>
                  {`${snapshot.temperature}°F • ${snapshot.pressure} inHg • ${snapshot.humidity}% • ${snapshot.windSpeed} mph @ ${snapshot.windDirection}°`}
                </Text>
                <Text style={[styles.rowDensity, { color: colors.text.secondary }]}>
                  {summary.densityAltitude === undefined
                    ? 'Density altitude unknown'
                    : `Density altitude ${Math.round(summary.densityAltitude)} ft`}
                </Text>
              </Pressable>
              <View style={styles.rowActions}>
                <Button
                  title="Edit"
                  onPress={() => navigation.navigate('EnvironmentInput', { snapshotId: id })}
                  variant="secondary"
                  size="small"
                />
                <Button
                  title="Delete"
                  onPress={() => confirmDelete(id)}
                  variant="danger"
                  size="small"
                />
              </View>
            </Card>
          );
        })}
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    lineHeight: 18,
  },
  comparisonHeadline: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  significantNote: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  deltaGrid: {
    marginTop: 12,
    marginBottom: 12,
  },
  deltaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  deltaLabel: {
    fontSize: 13,
  },
  deltaValue: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  row: {
    minHeight: 44,
    padding: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowDate: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowSelected: {
    fontSize: 13,
    fontWeight: '600',
  },
  rowConditions: {
    fontSize: 13,
    marginTop: 4,
  },
  rowDensity: {
    fontSize: 13,
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
});
