/**
 * Dashboard Screen
 * Main overview with quick stats and actions
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import type { MainTabScreenProps } from '../navigation/types';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import { useDOPEStore } from '../store/useDOPEStore';
import { useEnvironmentStore } from '../store/useEnvironmentStore';

type Props = MainTabScreenProps<'Dashboard'>;

export const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors } = theme;

  const { rifles, loadRifles } = useRifleStore();
  const { ammoProfiles, loadAmmoProfiles } = useAmmoStore();
  const { dopeLogs, loadDopeLogs } = useDOPEStore();
  const { current: currentEnv } = useEnvironmentStore();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([loadRifles(), loadAmmoProfiles(), loadDopeLogs()]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const recentLogs = dopeLogs.slice(0, 3);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Welcome Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Mobile DOPE</Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            Data On Previous Engagements
          </Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <Card style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{rifles.length}</Text>
            <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Rifles</Text>
          </Card>

          <Card style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{ammoProfiles.length}</Text>
            <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Ammo</Text>
          </Card>

          <Card style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{dopeLogs.length}</Text>
            <Text style={[styles.statLabel, { color: colors.text.secondary }]}>DOPE Logs</Text>
          </Card>
        </View>

        {/* Current Environment */}
        {currentEnv && (
          <Card style={styles.card}>
            <Text style={[styles.cardTitle, { color: colors.text.primary }]}>
              Current Conditions
            </Text>
            <View style={styles.envGrid}>
              <View style={styles.envItem}>
                <Text style={[styles.envLabel, { color: colors.text.secondary }]}>Temp</Text>
                <Text style={[styles.envValue, { color: colors.text.primary }]}>
                  {currentEnv.temperature}°F
                </Text>
              </View>
              <View style={styles.envItem}>
                <Text style={[styles.envLabel, { color: colors.text.secondary }]}>Pressure</Text>
                <Text style={[styles.envValue, { color: colors.text.primary }]}>
                  {currentEnv.pressure}"
                </Text>
              </View>
              <View style={styles.envItem}>
                <Text style={[styles.envLabel, { color: colors.text.secondary }]}>Altitude</Text>
                <Text style={[styles.envValue, { color: colors.text.primary }]}>
                  {currentEnv.altitude}'
                </Text>
              </View>
              <View style={styles.envItem}>
                <Text style={[styles.envLabel, { color: colors.text.secondary }]}>Wind</Text>
                <Text style={[styles.envValue, { color: colors.text.primary }]}>
                  {currentEnv.windSpeed} mph
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Recent DOPE Logs */}
        {recentLogs.length > 0 && (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text.primary }]}>
                Recent DOPE Logs
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Logs')}>
                <Text style={[styles.viewAllText, { color: colors.primary }]}>View All</Text>
              </TouchableOpacity>
            </View>
            {recentLogs.map((log) => (
              <View
                key={log.id}
                style={[styles.logItem, { borderBottomColor: colors.border }]}
              >
                <Text style={[styles.logDistance, { color: colors.text.primary }]}>
                  {log.distance} {log.distanceUnit}
                </Text>
                <Text style={[styles.logCorrection, { color: colors.primary }]}>
                  ↑ {log.elevationCorrection.toFixed(2)} {log.correctionUnit}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Quick Actions */}
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.text.primary }]}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <Button
              title="New DOPE Log"
              onPress={() => (navigation as any).navigate('Logs', {
                screen: 'DOPELogEdit',
                params: {},
              })}
              variant="primary"
            />
            <Button
              title="Calculator"
              onPress={() => navigation.navigate('Calculator')}
              variant="secondary"
            />
            <Button
              title="Environment"
              onPress={() => (navigation as any).navigate('Range', {
                screen: 'EnvironmentInput',
              })}
              variant="secondary"
            />
            <Button
              title="Profiles"
              onPress={() => navigation.navigate('Profiles')}
              variant="secondary"
            />
            <Button
              title="Settings"
              onPress={() => navigation.navigate('Settings')}
              variant="secondary"
            />
          </View>
        </Card>

        {/* Getting Started */}
        {rifles.length === 0 && (
          <Card style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text.primary }]}>
              Getting Started
            </Text>
            <Text style={[styles.gettingStartedText, { color: colors.text.secondary }]}>
              Welcome to Mobile DOPE! Start by creating a rifle profile, then add ammunition
              profiles for your loads. You can then use the ballistic calculator and log your
              shooting data.
            </Text>
            <View style={styles.gettingStartedButton}>
              <Button
                title="Create Rifle Profile"
                onPress={() => (navigation as any).navigate('Profiles', {
                  screen: 'RifleProfileForm',
                  params: {},
                })}
                variant="primary"
              />
            </View>
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
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  card: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  envGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  envItem: {
    flex: 1,
    minWidth: '40%',
  },
  envLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  envValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  logDistance: {
    fontSize: 15,
    fontWeight: '500',
  },
  logCorrection: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionGrid: {
    gap: 12,
  },
  gettingStartedText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  gettingStartedButton: {
    marginTop: 8,
  },
});
