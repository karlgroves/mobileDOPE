import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Card, LoadingSpinner, EmptyState } from '../components';
import { useTheme } from '../contexts/ThemeContext';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import type { RangeStackScreenProps } from '../navigation/types';

type Props = RangeStackScreenProps<'RangeSessionStart'>;

export const RangeScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const { snapshots, loadSnapshots, loading } = useEnvironmentStore();

  useEffect(() => {
    loadSnapshots(1); // Load only the most recent snapshot
  }, [loadSnapshots]);

  const latestSnapshot = snapshots[0];

  const handleAdd = () => {
    navigation.navigate('EnvironmentInput');
  };

  if (loading && snapshots.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {!latestSnapshot ? (
        <EmptyState
          title="No Weather Data"
          message="Record environmental conditions for accurate ballistic calculations"
          actionLabel="Add Weather Data"
          onAction={handleAdd}
        />
      ) : (
        <>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
            <Card style={styles.card}>
              <Text style={[styles.cardTitle, { color: colors.text.primary }]}>
                Latest Conditions
              </Text>
              {latestSnapshot.timestamp && (
                <Text style={[styles.timestamp, { color: colors.text.secondary }]}>
                  {new Date(latestSnapshot.timestamp).toLocaleString()}
                </Text>
              )}

              <View style={styles.dataGrid}>
                <View style={styles.dataRow}>
                  <View style={styles.dataItem}>
                    <Text style={[styles.dataLabel, { color: colors.text.secondary }]}>
                      Temperature
                    </Text>
                    <Text style={[styles.dataValue, { color: colors.text.primary }]}>
                      {latestSnapshot.temperature}°F
                    </Text>
                  </View>
                  <View style={styles.dataItem}>
                    <Text style={[styles.dataLabel, { color: colors.text.secondary }]}>
                      Humidity
                    </Text>
                    <Text style={[styles.dataValue, { color: colors.text.primary }]}>
                      {latestSnapshot.humidity}%
                    </Text>
                  </View>
                </View>

                <View style={styles.dataRow}>
                  <View style={styles.dataItem}>
                    <Text style={[styles.dataLabel, { color: colors.text.secondary }]}>
                      Pressure
                    </Text>
                    <Text style={[styles.dataValue, { color: colors.text.primary }]}>
                      {latestSnapshot.pressure} inHg
                    </Text>
                  </View>
                  <View style={styles.dataItem}>
                    <Text style={[styles.dataLabel, { color: colors.text.secondary }]}>
                      Altitude
                    </Text>
                    <Text style={[styles.dataValue, { color: colors.text.primary }]}>
                      {latestSnapshot.altitude} ft
                    </Text>
                  </View>
                </View>

                <View style={styles.dataRow}>
                  <View style={styles.dataItem}>
                    <Text style={[styles.dataLabel, { color: colors.text.secondary }]}>
                      Wind Speed
                    </Text>
                    <Text style={[styles.dataValue, { color: colors.text.primary }]}>
                      {latestSnapshot.windSpeed} mph
                    </Text>
                  </View>
                  <View style={styles.dataItem}>
                    <Text style={[styles.dataLabel, { color: colors.text.secondary }]}>
                      Wind Direction
                    </Text>
                    <Text style={[styles.dataValue, { color: colors.text.primary }]}>
                      {latestSnapshot.windDirection}°
                    </Text>
                  </View>
                </View>

                {latestSnapshot.densityAltitude !== undefined && (
                  <View style={styles.dataRow}>
                    <View style={[styles.dataItem, styles.fullWidth]}>
                      <Text style={[styles.dataLabel, { color: colors.text.secondary }]}>
                        Density Altitude
                      </Text>
                      <Text style={[styles.dataValue, { color: colors.text.primary }]}>
                        {latestSnapshot.densityAltitude} ft
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </Card>
          </ScrollView>

          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={handleAdd}
            accessibilityLabel="Add weather conditions"
            accessibilityRole="button"
          >
            <Text style={[styles.fabIcon, { color: colors.text.inverse }]}>+</Text>
          </TouchableOpacity>
        </>
      )}
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
    paddingBottom: 80,
  },
  card: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 14,
    marginBottom: 16,
  },
  dataGrid: {
    gap: 12,
  },
  dataRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dataItem: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  fullWidth: {
    flex: 1,
  },
  dataLabel: {
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  dataValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  fabIcon: {
    fontSize: 28,
    fontWeight: 'bold',
  },
});
