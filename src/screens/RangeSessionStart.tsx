import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, StyleSheet, Alert, Switch } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { useAppStore } from '../store/useAppStore';
import { Card, Picker, NumberPicker, Button, EmptyState, LoadingSpinner } from '../components';
import { rangeSessionRepository } from '../services/database/RangeSessionRepository';
import type { SessionStackScreenProps } from '../navigation/types';

type Props = SessionStackScreenProps<'RangeSessionStart'>;

export const RangeSessionStart: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors } = theme;

  const { rifles, loadRifles, loading: riflesLoading } = useRifleStore();
  const { ammoProfiles, loadAmmoProfiles, loading: ammoLoading } = useAmmoStore();
  const { snapshots, loadSnapshots, createSnapshot, loading: envLoading } = useEnvironmentStore();
  const { settings } = useAppStore();

  // Form state
  const [selectedRifleId, setSelectedRifleId] = useState<number | undefined>();
  const [selectedAmmoId, setSelectedAmmoId] = useState<number | undefined>();
  const [distance, setDistance] = useState<number>(100);
  const [sessionName] = useState<string>('');
  const [coldBoreShot, setColdBoreShot] = useState<boolean>(true);
  const [isStarting, setIsStarting] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadRifles();
    loadAmmoProfiles();
    loadSnapshots(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRifle = rifles.find((r) => r.id === selectedRifleId);
  const availableAmmo = selectedRifle
    ? ammoProfiles.filter((a) => a.caliber === selectedRifle.caliber)
    : [];

  // Reset ammo selection when rifle changes
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    const selectedAmmo = ammoProfiles.find((a) => a.id === selectedAmmoId);
    if (selectedRifle && selectedAmmo?.caliber !== selectedRifle.caliber) {
      setSelectedAmmoId(undefined);
    }
  }, [selectedRifleId, selectedRifle, ammoProfiles, selectedAmmoId]);

  const latestSnapshot = snapshots[0];

  const handleStartSession = async () => {
    if (!selectedRifleId || !selectedAmmoId) {
      Alert.alert('Missing Selection', 'Please select both a rifle and ammunition profile.');
      return;
    }

    if (!latestSnapshot) {
      Alert.alert(
        'No Environmental Data',
        'Please record environmental conditions before starting a session.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Weather', onPress: () => navigation.navigate('EnvironmentInput') },
        ]
      );
      return;
    }

    setIsStarting(true);

    try {
      // Create a new environment snapshot for this session
      const newEnv = await createSnapshot({
        temperature: latestSnapshot.temperature,
        humidity: latestSnapshot.humidity,
        pressure: latestSnapshot.pressure,
        altitude: latestSnapshot.altitude,
        windSpeed: latestSnapshot.windSpeed,
        windDirection: latestSnapshot.windDirection,
        densityAltitude: latestSnapshot.densityAltitude,
        timestamp: new Date().toISOString(),
      });

      // Create the range session
      const session = await rangeSessionRepository.create({
        rifleId: selectedRifleId,
        ammoId: selectedAmmoId,
        environmentId: newEnv.id!,
        sessionName: sessionName || undefined,
        startTime: new Date().toISOString(),
        distance,
        shotCount: 0,
        coldBoreShot,
      });

      // Navigate to active session
      navigation.navigate('RangeSessionActive', { sessionId: session.id! });
    } catch (error) {
      console.error('Failed to start session:', error);
      Alert.alert('Error', 'Failed to start range session. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleAddWeather = () => {
    navigation.navigate('EnvironmentInput');
  };

  const loading = riflesLoading || ammoLoading || envLoading;

  if (loading && rifles.length === 0) {
    return <LoadingSpinner />;
  }

  if (rifles.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          title="No Rifle Profiles"
          message="Create a rifle profile to start a range session."
          actionLabel="Go to Rifles"
          onAction={() => {
            // Navigate to rifles tab
          }}
        />
      </View>
    );
  }

  const rifleOptions = rifles.map((r) => ({ label: r.name, value: r.id!.toString() }));
  const ammoOptions = availableAmmo.map((a) => ({ label: a.name, value: a.id!.toString() }));
  const distancePresets = settings.distancePresets;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Environmental Conditions Card */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Current Conditions
            </Text>
            <Button
              title={latestSnapshot ? 'Update' : 'Add'}
              onPress={handleAddWeather}
              variant="secondary"
              size="small"
            />
          </View>
          {latestSnapshot ? (
            <View style={styles.envGrid}>
              <View style={styles.envRow}>
                <View style={styles.envItem}>
                  <Text style={[styles.envLabel, { color: colors.text.secondary }]}>Temp</Text>
                  <Text style={[styles.envValue, { color: colors.text.primary }]}>
                    {latestSnapshot.temperature}°F
                  </Text>
                </View>
                <View style={styles.envItem}>
                  <Text style={[styles.envLabel, { color: colors.text.secondary }]}>Wind</Text>
                  <Text style={[styles.envValue, { color: colors.text.primary }]}>
                    {latestSnapshot.windSpeed} mph
                  </Text>
                </View>
                <View style={styles.envItem}>
                  <Text style={[styles.envLabel, { color: colors.text.secondary }]}>Alt</Text>
                  <Text style={[styles.envValue, { color: colors.text.primary }]}>
                    {latestSnapshot.altitude} ft
                  </Text>
                </View>
              </View>
              <View style={styles.envRow}>
                <View style={styles.envItem}>
                  <Text style={[styles.envLabel, { color: colors.text.secondary }]}>Pressure</Text>
                  <Text style={[styles.envValue, { color: colors.text.primary }]}>
                    {latestSnapshot.pressure} inHg
                  </Text>
                </View>
                <View style={styles.envItem}>
                  <Text style={[styles.envLabel, { color: colors.text.secondary }]}>Humidity</Text>
                  <Text style={[styles.envValue, { color: colors.text.primary }]}>
                    {latestSnapshot.humidity}%
                  </Text>
                </View>
                {latestSnapshot.densityAltitude !== undefined && (
                  <View style={styles.envItem}>
                    <Text style={[styles.envLabel, { color: colors.text.secondary }]}>DA</Text>
                    <Text style={[styles.envValue, { color: colors.text.primary }]}>
                      {latestSnapshot.densityAltitude} ft
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <Text style={[styles.noDataText, { color: colors.text.secondary }]}>
              No weather data. Add conditions to start a session.
            </Text>
          )}
        </Card>

        {/* Profile Selection */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Session Setup</Text>
          <Picker
            label="Rifle"
            value={selectedRifleId?.toString() || ''}
            onValueChange={(value) => setSelectedRifleId(parseInt(value))}
            options={rifleOptions}
            placeholder="Select a rifle"
            required
          />
          <Picker
            label="Ammunition"
            value={selectedAmmoId?.toString() || ''}
            onValueChange={(value) => setSelectedAmmoId(parseInt(value))}
            options={ammoOptions}
            placeholder="Select ammunition"
            required
            disabled={!selectedRifleId}
            helperText={
              !selectedRifleId
                ? 'Select a rifle first'
                : availableAmmo.length === 0
                  ? 'No ammo profiles for this caliber'
                  : undefined
            }
          />
        </Card>

        {/* Distance Selection */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Target Distance</Text>
          <NumberPicker
            label="Distance"
            value={distance}
            onValueChange={setDistance}
            min={25}
            max={2000}
            step={25}
            unit="yards"
            presets={distancePresets}
            helperText="Distance to target"
          />
        </Card>

        {/* Cold Bore Option */}
        <Card style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={[styles.switchTitle, { color: colors.text.primary }]}>
                Cold Bore Shot
              </Text>
              <Text style={[styles.switchHelp, { color: colors.text.secondary }]}>
                First shot of the day/session
              </Text>
            </View>
            <Switch
              value={coldBoreShot}
              onValueChange={setColdBoreShot}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={coldBoreShot ? '#ffffff' : '#f4f3f4'}
            />
          </View>
        </Card>

        {/* Start Button */}
        <Button
          title={isStarting ? 'Starting Session...' : 'Start Range Session'}
          onPress={handleStartSession}
          variant="primary"
          size="large"
          disabled={!selectedRifleId || !selectedAmmoId || !latestSnapshot || isStarting}
        />
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
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
  noDataText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    flex: 1,
    marginRight: 16,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  switchHelp: {
    fontSize: 12,
  },
});
