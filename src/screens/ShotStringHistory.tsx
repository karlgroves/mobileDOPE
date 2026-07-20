import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, Pressable } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AmmoStackParamList } from '../navigation/types';
import { useAmmoStore } from '../store/useAmmoStore';
import { Card, Button, EmptyState } from '../components';
import { AmmoProfileData } from '../models/AmmoProfile';
import { useTheme } from '../contexts/ThemeContext';
import {
  shotStringRepository,
  ShotStringStatistics,
} from '../services/database/ShotStringRepository';
import { ShotString } from '../models/ShotString';

type ShotStringHistoryNavigationProp = NativeStackNavigationProp<
  AmmoStackParamList,
  'ShotStringHistory'
>;
type ShotStringHistoryRouteProp = RouteProp<AmmoStackParamList, 'ShotStringHistory'>;

interface SessionSummary {
  date: string;
  stats: ShotStringStatistics | null;
  shots: ShotString[];
}

interface SessionCardProps {
  session: SessionSummary;
  onDelete: (date: string) => void;
  onUpdateVelocity: (avgVelocity: number) => void;
}

const SessionCard: React.FC<SessionCardProps> = ({ session, onDelete, onUpdateVelocity }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const [expanded, setExpanded] = useState(false);

  const formattedDate = new Date(session.date).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  if (!session.stats) {
    return null;
  }

  return (
    <Card style={styles.sessionCard}>
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.sessionHeader}>
        <View style={styles.sessionInfo}>
          <Text style={[styles.sessionTitle, { color: colors.text.primary }]}>{formattedDate}</Text>
          <Text style={[styles.sessionSubtitle, { color: colors.text.secondary }]}>
            {session.stats.count} shots - Avg: {session.stats.averageVelocity} fps
          </Text>
        </View>
        <View style={styles.sessionRight}>
          <Text style={[styles.esText, { color: colors.text.secondary }]}>
            ES: {session.stats.extremeSpread}
          </Text>
          <Text style={[styles.chevron, { color: colors.text.secondary }]}>
            {expanded ? '▼' : '▶'}
          </Text>
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.statsRow}>
            <View style={styles.statColumn}>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>SD</Text>
              <Text style={[styles.statValue, { color: colors.text.primary }]}>
                {session.stats.standardDeviation} fps
              </Text>
            </View>
            <View style={styles.statColumn}>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Min</Text>
              <Text style={[styles.statValue, { color: colors.text.primary }]}>
                {session.stats.minVelocity} fps
              </Text>
            </View>
            <View style={styles.statColumn}>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Max</Text>
              <Text style={[styles.statValue, { color: colors.text.primary }]}>
                {session.stats.maxVelocity} fps
              </Text>
            </View>
          </View>

          <View style={styles.shotsSection}>
            <Text style={[styles.shotsSectionTitle, { color: colors.text.primary }]}>
              Individual Shots
            </Text>
            {session.shots.map((shot) => (
              <View key={shot.id} style={styles.shotRow}>
                <Text style={[styles.shotNumber, { color: colors.text.secondary }]}>
                  #{shot.shotNumber}
                </Text>
                <Text style={[styles.shotVelocity, { color: colors.text.primary }]}>
                  {shot.velocity} fps
                </Text>
                <Text style={[styles.shotTemp, { color: colors.text.secondary }]}>
                  {shot.temperature}°F
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.sessionActions}>
            <Button
              title="Use as Muzzle Velocity"
              onPress={() => onUpdateVelocity(session.stats!.averageVelocity)}
              variant="secondary"
              size="small"
            />
            <Button
              title="Delete Session"
              onPress={() => onDelete(session.date)}
              variant="danger"
              size="small"
            />
          </View>
        </View>
      )}
    </Card>
  );
};

export const ShotStringHistory: React.FC = () => {
  const navigation = useNavigation<ShotStringHistoryNavigationProp>();
  const route = useRoute<ShotStringHistoryRouteProp>();
  const { theme } = useTheme();
  const { colors } = theme;

  const { ammoProfiles, updateAmmoProfile } = useAmmoStore();
  const { ammoId } = route.params;

  const ammo = ammoProfiles.find((a) => a.id === ammoId);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    if (!ammoId) return;

    setIsLoading(true);
    try {
      const sessionDates = await shotStringRepository.getSessionDates(ammoId);

      const sessionPromises = sessionDates.map(async (date) => {
        const stats = await shotStringRepository.getSessionStatistics(ammoId, date);
        const shots = await shotStringRepository.getBySession(ammoId, date);
        return { date, stats, shots };
      });

      const loadedSessions = await Promise.all(sessionPromises);
      setSessions(loadedSessions.filter((s) => s.stats !== null));
    } catch (error) {
      console.error('Failed to load sessions:', error);
      Alert.alert('Error', 'Failed to load session history.');
    } finally {
      setIsLoading(false);
    }
  }, [ammoId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  if (!ammo) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>Ammo profile not found</Text>
      </View>
    );
  }

  const handleDeleteSession = async (date: string) => {
    Alert.alert('Delete Session', `Delete all shots from ${date}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await shotStringRepository.deleteBySession(ammoId, date);
            await loadSessions();
          } catch (error) {
            console.error('Failed to delete session:', error);
            Alert.alert('Error', 'Failed to delete session.');
          }
        },
      },
    ]);
  };

  const handleUpdateVelocity = async (avgVelocity: number) => {
    Alert.alert(
      'Update Muzzle Velocity',
      `Update the ammo profile muzzle velocity to ${avgVelocity} fps?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            try {
              const existingAmmo = ammo?.toJSON() as AmmoProfileData;
              await updateAmmoProfile(ammoId, {
                ...existingAmmo,
                muzzleVelocity: avgVelocity,
              });
              Alert.alert('Success', 'Ammo profile muzzle velocity updated.');
            } catch (error) {
              console.error('Failed to update ammo velocity:', error);
              Alert.alert('Error', 'Failed to update ammo profile.');
            }
          },
        },
      ]
    );
  };

  const handleNewSession = () => {
    navigation.navigate('ChronographInput', { ammoId });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
          Loading sessions...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Card style={styles.headerCard}>
          <Text style={[styles.title, { color: colors.text.primary }]}>{ammo.name}</Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            Current Muzzle Velocity: {ammo.muzzleVelocity} fps
          </Text>
        </Card>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            title="No Sessions Yet"
            message="Start a chronograph session to record velocity data."
            actionLabel="New Session"
            onAction={handleNewSession}
          />
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.date}
          renderItem={({ item }) => (
            <SessionCard
              session={item}
              onDelete={handleDeleteSession}
              onUpdateVelocity={handleUpdateVelocity}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Button title="New Session" onPress={handleNewSession} variant="primary" />
          }
        />
      )}
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
  header: {
    padding: 16,
    paddingBottom: 0,
  },
  headerCard: {
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 24,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  sessionCard: {
    marginBottom: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sessionSubtitle: {
    fontSize: 14,
  },
  sessionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chevron: {
    fontSize: 12,
  },
  esText: {
    fontSize: 12,
    fontWeight: '500',
  },
  expandedContent: {
    paddingTop: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statColumn: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  shotsSection: {
    marginBottom: 16,
  },
  shotsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  shotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  shotNumber: {
    fontSize: 12,
    fontWeight: '500',
    width: 40,
  },
  shotVelocity: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  shotTemp: {
    fontSize: 12,
    width: 50,
    textAlign: 'right',
  },
  sessionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
});
