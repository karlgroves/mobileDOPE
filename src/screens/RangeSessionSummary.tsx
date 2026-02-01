import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Text, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import { Card, Button, LoadingSpinner } from '../components';
import { rangeSessionRepository } from '../services/database/RangeSessionRepository';
import { environmentRepository } from '../services/database/EnvironmentRepository';
import { exportSessionReportMarkdown, exportSessionReportJSON } from '../services/ExportService';
import { RangeSession } from '../models/RangeSession';
import { EnvironmentSnapshot } from '../models/EnvironmentSnapshot';
import type { SessionStackScreenProps } from '../navigation/types';

type Props = SessionStackScreenProps<'RangeSessionSummary'>;

export const RangeSessionSummary: React.FC<Props> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const { sessionId } = route.params;

  const { rifles } = useRifleStore();
  const { ammoProfiles } = useAmmoStore();

  const [session, setSession] = useState<RangeSession | null>(null);
  const [environment, setEnvironment] = useState<EnvironmentSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const loadedSession = await rangeSessionRepository.getById(sessionId);
      if (!loadedSession) {
        Alert.alert('Error', 'Session not found');
        navigation.goBack();
        return;
      }

      setSession(loadedSession);

      const env = await environmentRepository.getById(loadedSession.environmentId);
      setEnvironment(env);

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load session:', error);
      Alert.alert('Error', 'Failed to load session data');
      navigation.goBack();
    }
  }, [sessionId, navigation]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleNewSession = () => {
    navigation.navigate('RangeSessionStart');
  };

  const handleDeleteSession = () => {
    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this session? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await rangeSessionRepository.delete(sessionId);
              navigation.navigate('RangeSessionStart');
            } catch (error) {
              console.error('Failed to delete session:', error);
              Alert.alert('Error', 'Failed to delete session');
            }
          },
        },
      ]
    );
  };

  const handleExportSession = () => {
    Alert.alert('Export Session', 'Choose export format:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Markdown (.md)',
        onPress: async () => {
          if (!session) return;
          const rifle = rifles.find((r) => r.id === session.rifleId) || null;
          const ammo = ammoProfiles.find((a) => a.id === session.ammoId) || null;
          const result = await exportSessionReportMarkdown(session, rifle, ammo, environment);
          if (!result.success) {
            Alert.alert('Export Failed', result.error || 'Unknown error');
          }
        },
      },
      {
        text: 'JSON',
        onPress: async () => {
          if (!session) return;
          const rifle = rifles.find((r) => r.id === session.rifleId) || null;
          const ammo = ammoProfiles.find((a) => a.id === session.ammoId) || null;
          const result = await exportSessionReportJSON(session, rifle, ammo, environment);
          if (!result.success) {
            Alert.alert('Export Failed', result.error || 'Unknown error');
          }
        },
      },
    ]);
  };

  // Calculate session duration
  const calculateDuration = (): string => {
    if (!session?.startTime || !session.endTime) return '--';

    const start = new Date(session.startTime);
    const end = new Date(session.endTime);
    const diffMs = end.getTime() - start.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    const hrs = Math.floor(diffSeconds / 3600);
    const mins = Math.floor((diffSeconds % 3600) / 60);
    const secs = diffSeconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Format date
  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format time
  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const rifle = session ? rifles.find((r) => r.id === session.rifleId) : null;
  const ammo = session ? ammoProfiles.find((a) => a.id === session.ammoId) : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Session Overview */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Session Complete
          </Text>
          {session?.sessionName && (
            <Text style={[styles.sessionName, { color: colors.text.secondary }]}>
              {session.sessionName}
            </Text>
          )}
          <Text style={[styles.dateText, { color: colors.text.secondary }]}>
            {session ? formatDate(session.startTime) : ''}
          </Text>
        </Card>

        {/* Statistics Card */}
        <Card style={styles.statsCard}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {session?.shotCount || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Shots Fired</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{calculateDuration()}</Text>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Duration</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {session?.distance || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Yards</Text>
            </View>
          </View>
        </Card>

        {/* Equipment Used */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Equipment</Text>
          <View style={styles.equipmentRow}>
            <View style={styles.equipmentItem}>
              <Text style={[styles.equipmentLabel, { color: colors.text.secondary }]}>Rifle</Text>
              <Text style={[styles.equipmentValue, { color: colors.text.primary }]}>
                {rifle?.name || 'Unknown'}
              </Text>
              {rifle && (
                <Text style={[styles.equipmentDetail, { color: colors.text.secondary }]}>
                  {rifle.caliber}
                </Text>
              )}
            </View>
          </View>
          <View style={[styles.equipmentRow, { marginTop: 16 }]}>
            <View style={styles.equipmentItem}>
              <Text style={[styles.equipmentLabel, { color: colors.text.secondary }]}>Ammunition</Text>
              <Text style={[styles.equipmentValue, { color: colors.text.primary }]}>
                {ammo?.name || 'Unknown'}
              </Text>
              {ammo && (
                <Text style={[styles.equipmentDetail, { color: colors.text.secondary }]}>
                  {ammo.bulletWeight}gr @ {ammo.muzzleVelocity} fps
                </Text>
              )}
            </View>
          </View>
        </Card>

        {/* Time Details */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Time Details</Text>
          <View style={styles.timeRow}>
            <Text style={[styles.timeLabel, { color: colors.text.secondary }]}>Started</Text>
            <Text style={[styles.timeValue, { color: colors.text.primary }]}>
              {session ? formatTime(session.startTime) : '--'}
            </Text>
          </View>
          <View style={styles.timeRow}>
            <Text style={[styles.timeLabel, { color: colors.text.secondary }]}>Ended</Text>
            <Text style={[styles.timeValue, { color: colors.text.primary }]}>
              {session?.endTime ? formatTime(session.endTime) : '--'}
            </Text>
          </View>
          {session?.coldBoreShot && (
            <View style={[styles.coldBoreBadge, { backgroundColor: colors.warning }]}>
              <Text style={styles.coldBoreText}>Cold Bore Session</Text>
            </View>
          )}
        </Card>

        {/* Environmental Conditions */}
        {environment && (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Environmental Conditions
            </Text>
            <View style={styles.envGrid}>
              <View style={styles.envRow}>
                <View style={styles.envItem}>
                  <Text style={[styles.envLabel, { color: colors.text.secondary }]}>Temp</Text>
                  <Text style={[styles.envValue, { color: colors.text.primary }]}>
                    {environment.temperature}°F
                  </Text>
                </View>
                <View style={styles.envItem}>
                  <Text style={[styles.envLabel, { color: colors.text.secondary }]}>Wind</Text>
                  <Text style={[styles.envValue, { color: colors.text.primary }]}>
                    {environment.windSpeed} mph
                  </Text>
                </View>
                <View style={styles.envItem}>
                  <Text style={[styles.envLabel, { color: colors.text.secondary }]}>Alt</Text>
                  <Text style={[styles.envValue, { color: colors.text.primary }]}>
                    {environment.altitude} ft
                  </Text>
                </View>
              </View>
              <View style={styles.envRow}>
                <View style={styles.envItem}>
                  <Text style={[styles.envLabel, { color: colors.text.secondary }]}>Pressure</Text>
                  <Text style={[styles.envValue, { color: colors.text.primary }]}>
                    {environment.pressure} inHg
                  </Text>
                </View>
                <View style={styles.envItem}>
                  <Text style={[styles.envLabel, { color: colors.text.secondary }]}>Humidity</Text>
                  <Text style={[styles.envValue, { color: colors.text.primary }]}>
                    {environment.humidity}%
                  </Text>
                </View>
                {environment.densityAltitude !== undefined && (
                  <View style={styles.envItem}>
                    <Text style={[styles.envLabel, { color: colors.text.secondary }]}>DA</Text>
                    <Text style={[styles.envValue, { color: colors.text.primary }]}>
                      {environment.densityAltitude} ft
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Card>
        )}

        {/* Notes */}
        {session?.notes && (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Notes</Text>
            <Text style={[styles.notesText, { color: colors.text.primary }]}>{session.notes}</Text>
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button title="Start New Session" onPress={handleNewSession} variant="primary" size="large" />
          <Button title="Export Session Report" onPress={handleExportSession} variant="secondary" size="large" />
          <Button title="Delete Session" onPress={handleDeleteSession} variant="danger" size="large" />
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  sessionName: {
    fontSize: 14,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
  },
  statsCard: {
    marginBottom: 16,
    paddingVertical: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
  },
  equipmentRow: {},
  equipmentItem: {},
  equipmentLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  equipmentValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  equipmentDetail: {
    fontSize: 14,
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  timeLabel: {
    fontSize: 14,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  coldBoreBadge: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  coldBoreText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 12,
  },
  envGrid: {
    gap: 8,
  },
  envRow: {
    flexDirection: 'row',
    gap: 8,
  },
  envItem: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    alignItems: 'center',
  },
  envLabel: {
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  envValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
});
