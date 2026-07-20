import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AmmoStackParamList } from '../navigation/types';
import { useAmmoStore } from '../store/useAmmoStore';
import { AmmoProfileData } from '../models/AmmoProfile';
import { Card, Button, NumberInput } from '../components';
import { useTheme } from '../contexts/ThemeContext';
import {
  shotStringRepository,
  ShotStringStatistics,
} from '../services/database/ShotStringRepository';
import { ShotStringData } from '../models/ShotString';

type ChronographInputNavigationProp = NativeStackNavigationProp<
  AmmoStackParamList,
  'ChronographInput'
>;
type ChronographInputRouteProp = RouteProp<AmmoStackParamList, 'ChronographInput'>;

interface StatisticsCardProps {
  stats: ShotStringStatistics | null;
  shotCount: number;
}

const StatisticsCard: React.FC<StatisticsCardProps> = ({ stats, shotCount }) => {
  const { theme } = useTheme();
  const { colors } = theme;

  if (!stats && shotCount === 0) {
    return (
      <Card style={styles.statsCard}>
        <Text style={[styles.noDataText, { color: colors.text.secondary }]}>
          Enter velocities to see statistics
        </Text>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Card style={styles.statsCard}>
      <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Session Statistics</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Shots</Text>
          <Text style={[styles.statValue, { color: colors.text.primary }]}>{stats.count}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Avg Velocity</Text>
          <Text style={[styles.statValue, { color: colors.text.primary }]}>
            {stats.averageVelocity} fps
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.text.secondary }]}>ES</Text>
          <Text style={[styles.statValue, { color: colors.text.primary }]}>
            {stats.extremeSpread} fps
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.text.secondary }]}>SD</Text>
          <Text style={[styles.statValue, { color: colors.text.primary }]}>
            {stats.standardDeviation} fps
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Min</Text>
          <Text style={[styles.statValue, { color: colors.text.primary }]}>
            {stats.minVelocity} fps
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.text.secondary }]}>Max</Text>
          <Text style={[styles.statValue, { color: colors.text.primary }]}>
            {stats.maxVelocity} fps
          </Text>
        </View>
      </View>
    </Card>
  );
};

export const ChronographInput: React.FC = () => {
  const navigation = useNavigation<ChronographInputNavigationProp>();
  const route = useRoute<ChronographInputRouteProp>();
  const { theme } = useTheme();
  const { colors } = theme;

  const { ammoProfiles, updateAmmoProfile } = useAmmoStore();
  const { ammoId } = route.params;

  const ammo = ammoProfiles.find((a) => a.id === ammoId);

  // Session state
  const [sessionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [temperature, setTemperature] = useState(72);
  const [currentVelocity, setCurrentVelocity] = useState<number>(0);
  const [shotCount, setShotCount] = useState(0);
  const [statistics, setStatistics] = useState<ShotStringStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load existing session data
  const loadSessionData = useCallback(async () => {
    if (!ammoId) return;

    try {
      const stats = await shotStringRepository.getSessionStatistics(ammoId, sessionDate);
      const nextShot = await shotStringRepository.getNextShotNumber(ammoId, sessionDate);
      setStatistics(stats);
      setShotCount(nextShot - 1);
    } catch (error) {
      console.error('Failed to load session data:', error);
    }
  }, [ammoId, sessionDate]);

  useEffect(() => {
    loadSessionData();
  }, [loadSessionData]);

  if (!ammo) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>Ammo profile not found</Text>
      </View>
    );
  }

  const handleRecordShot = async () => {
    if (currentVelocity <= 0 || currentVelocity > 5000) {
      Alert.alert('Invalid Velocity', 'Please enter a velocity between 1 and 5000 fps');
      return;
    }

    setIsLoading(true);
    try {
      const nextShotNumber = await shotStringRepository.getNextShotNumber(ammoId, sessionDate);

      const shotData: ShotStringData = {
        ammoId,
        sessionDate,
        shotNumber: nextShotNumber,
        velocity: currentVelocity,
        temperature,
      };

      await shotStringRepository.create(shotData);

      // Reload statistics
      await loadSessionData();

      // Reset velocity input for next shot
      setCurrentVelocity(0);
    } catch (error) {
      console.error('Failed to record shot:', error);
      Alert.alert('Error', 'Failed to record shot. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAmmoVelocity = async () => {
    if (!statistics) {
      Alert.alert('No Data', 'Record some shots first to calculate average velocity.');
      return;
    }

    Alert.alert(
      'Update Muzzle Velocity',
      `Update the ammo profile muzzle velocity to ${statistics.averageVelocity} fps?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            try {
              const existingAmmo = ammo.toJSON() as AmmoProfileData;
              await updateAmmoProfile(ammoId, {
                ...existingAmmo,
                muzzleVelocity: statistics.averageVelocity,
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

  const handleClearSession = async () => {
    Alert.alert('Clear Session', 'Delete all shots from this session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await shotStringRepository.deleteBySession(ammoId, sessionDate);
            await loadSessionData();
          } catch (error) {
            console.error('Failed to clear session:', error);
            Alert.alert('Error', 'Failed to clear session.');
          }
        },
      },
    ]);
  };

  const handleViewHistory = () => {
    navigation.navigate('ShotStringHistory', { ammoId });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Card style={styles.headerCard}>
          <Text style={[styles.title, { color: colors.text.primary }]}>{ammo.name}</Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            {ammo.manufacturer} - {ammo.caliber}
          </Text>
          <Text style={[styles.currentVelocity, { color: colors.text.secondary }]}>
            Profile Muzzle Velocity: {ammo.muzzleVelocity} fps
          </Text>
        </Card>

        <Card style={styles.inputCard}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Record Velocity - Shot #{shotCount + 1}
          </Text>

          <NumberInput
            label="Velocity"
            value={currentVelocity}
            onChangeValue={(val) => setCurrentVelocity(val ?? 0)}
            unit="fps"
            min={0}
            max={5000}
            step={1}
            precision={0}
          />

          <NumberInput
            label="Temperature"
            value={temperature}
            onChangeValue={(val) => setTemperature(val ?? 72)}
            unit="°F"
            min={-60}
            max={140}
            step={1}
            precision={0}
          />

          <View style={styles.sessionInfo}>
            <Text style={[styles.sessionDate, { color: colors.text.secondary }]}>
              Session Date: {sessionDate}
            </Text>
          </View>

          <Button
            title={isLoading ? 'Recording...' : 'Record Shot'}
            onPress={handleRecordShot}
            variant="primary"
            disabled={isLoading || currentVelocity <= 0}
            size="large"
          />
        </Card>

        <StatisticsCard stats={statistics} shotCount={shotCount} />

        {statistics && (
          <View style={styles.actions}>
            <Button
              title="Update Ammo Profile Velocity"
              onPress={handleUpdateAmmoVelocity}
              variant="secondary"
            />
            <Button title="View Session History" onPress={handleViewHistory} variant="secondary" />
            <Button title="Clear This Session" onPress={handleClearSession} variant="danger" />
          </View>
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
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 24,
  },
  headerCard: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  currentVelocity: {
    fontSize: 14,
    marginTop: 8,
  },
  inputCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  sessionInfo: {
    marginVertical: 12,
  },
  sessionDate: {
    fontSize: 14,
  },
  statsCard: {
    marginBottom: 16,
  },
  noDataText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
});
