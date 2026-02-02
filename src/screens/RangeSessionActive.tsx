import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, Text, StyleSheet, Alert, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useTheme } from '../contexts/ThemeContext';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import { useAppStore } from '../store/useAppStore';
import { Card, Button, NumberPicker } from '../components';
import { rangeSessionRepository } from '../services/database/RangeSessionRepository';
import { environmentRepository } from '../services/database/EnvironmentRepository';
import { calculateBallisticSolution } from '../utils/ballistics';
import { BallisticSolution } from '../types/ballistic.types';
import { RangeSession } from '../models/RangeSession';
import { EnvironmentSnapshot } from '../models/EnvironmentSnapshot';
import type { SessionStackScreenProps } from '../navigation/types';

type Props = SessionStackScreenProps<'RangeSessionActive'>;

export const RangeSessionActive: React.FC<Props> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const { sessionId } = route.params;

  const { rifles } = useRifleStore();
  const { ammoProfiles } = useAmmoStore();
  const { settings } = useAppStore();

  // Session state
  const [session, setSession] = useState<RangeSession | null>(null);
  const [environment, setEnvironment] = useState<EnvironmentSnapshot | null>(null);
  const [solution, setSolution] = useState<BallisticSolution | null>(null);
  const [distance, setDistance] = useState<number>(100);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);

  // Quick adjustment state (manual corrections on top of calculated solution)
  const [elevationAdjustment, setElevationAdjustment] = useState<number>(0);
  const [windageAdjustment, setWindageAdjustment] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  // Load session data
  const loadSession = useCallback(async () => {
    try {
      const loadedSession = await rangeSessionRepository.getById(sessionId);
      if (!loadedSession) {
        Alert.alert('Error', 'Session not found');
        navigation.goBack();
        return;
      }

      setSession(loadedSession);
      setDistance(loadedSession.distance);

      // Load environment
      const env = await environmentRepository.getById(loadedSession.environmentId);
      setEnvironment(env);

      // Set start time for timer
      startTimeRef.current = new Date(loadedSession.startTime);

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

  // Screen wake lock - keep screen on during active session
  useEffect(() => {
    activateKeepAwakeAsync('rangeSession');

    return () => {
      deactivateKeepAwake('rangeSession');
    };
  }, []);

  // Timer effect
  useEffect(() => {
    if (!startTimeRef.current) return;

    const updateTimer = () => {
      if (startTimeRef.current) {
        const now = new Date();
        const diff = Math.floor((now.getTime() - startTimeRef.current.getTime()) / 1000);
        setElapsedTime(diff);
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [session]);

  // Calculate ballistic solution when distance or session changes
  useEffect(() => {
    if (!session || !environment) return;

    const rifle = rifles.find((r) => r.id === session.rifleId);
    const ammo = ammoProfiles.find((a) => a.id === session.ammoId);

    if (!rifle || !ammo) return;

    try {
      const rifleConfig = {
        zeroDistance: rifle.zeroDistance,
        sightHeight: rifle.scopeHeight,
        clickValueType: rifle.clickValueType as 'MIL' | 'MOA',
        clickValue: rifle.clickValue,
        twistRate: rifle.twistRate,
        barrelLength: rifle.barrelLength,
      };

      const ammoConfig = {
        bulletWeight: ammo.bulletWeight,
        ballisticCoefficient: ammo.ballisticCoefficientG1,
        muzzleVelocity: ammo.muzzleVelocity,
        dragModel: 'G1' as const,
      };

      const targetParams = {
        distance,
        angle: 0,
        windSpeed: environment.windSpeed,
        windDirection: environment.windDirection,
      };

      const atmosphere = {
        temperature: environment.temperature,
        pressure: environment.pressure,
        humidity: environment.humidity,
        altitude: environment.altitude,
      };

      const result = calculateBallisticSolution(
        rifleConfig,
        ammoConfig,
        targetParams,
        atmosphere,
        false
      );

      setSolution(result);
    } catch (error) {
      console.error('Failed to calculate solution:', error);
    }
  }, [session, environment, distance, rifles, ammoProfiles]);

  // Handle recording a shot
  const handleRecordShot = async () => {
    if (!session) return;

    // Haptic feedback on shot press (if enabled)
    if (settings.hapticFeedbackEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    setIsRecording(true);
    try {
      const updated = await rangeSessionRepository.incrementShotCount(session.id!);
      if (updated) {
        setSession(updated);
        // Success haptic feedback (if enabled)
        if (settings.hapticFeedbackEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error('Failed to record shot:', error);
      // Error haptic feedback (if enabled)
      if (settings.hapticFeedbackEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Error', 'Failed to record shot');
    } finally {
      setIsRecording(false);
    }
  };

  // Handle ending session
  const handleEndSession = async () => {
    Alert.alert(
      'End Session',
      'Are you sure you want to end this range session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          onPress: async () => {
            if (!session) return;
            try {
              await rangeSessionRepository.endSession(session.id!);
              navigation.navigate('RangeSessionSummary', { sessionId: session.id! });
            } catch (error) {
              console.error('Failed to end session:', error);
              Alert.alert('Error', 'Failed to end session');
            }
          },
        },
      ]
    );
  };

  // Handle distance change
  const handleDistanceChange = async (newDistance: number) => {
    setDistance(newDistance);
    // Reset adjustments when distance changes
    setElevationAdjustment(0);
    setWindageAdjustment(0);
    if (session) {
      try {
        await rangeSessionRepository.update(session.id!, { distance: newDistance });
      } catch (error) {
        console.error('Failed to update distance:', error);
      }
    }
  };

  // Quick adjustment handlers
  const adjustElevation = (delta: number) => {
    if (settings.hapticFeedbackEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setElevationAdjustment((prev) => Math.round((prev + delta) * 10) / 10);
  };

  const adjustWindage = (delta: number) => {
    if (settings.hapticFeedbackEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setWindageAdjustment((prev) => Math.round((prev + delta) * 10) / 10);
  };

  const resetAdjustments = () => {
    if (settings.hapticFeedbackEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setElevationAdjustment(0);
    setWindageAdjustment(0);
  };

  // Calculate adjusted values
  const adjustedElevation = solution ? solution.elevationMIL + elevationAdjustment : null;
  const adjustedWindage = solution ? solution.windageMIL + windageAdjustment : null;

  // Format elapsed time
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.text.secondary }]}>Loading session...</Text>
      </View>
    );
  }

  const rifle = session ? rifles.find((r) => r.id === session.rifleId) : null;
  const ammo = session ? ammoProfiles.find((a) => a.id === session.ammoId) : null;
  const distancePresets = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Session Info Header */}
        <Card style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={[styles.rifleName, { color: colors.text.primary }]}>
                {rifle?.name || 'Unknown Rifle'}
              </Text>
              <Text style={[styles.ammoName, { color: colors.text.secondary }]}>
                {ammo?.name || 'Unknown Ammo'}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={[styles.timerLabel, { color: colors.text.secondary }]}>Session Time</Text>
              <Text style={[styles.timerValue, { color: colors.text.primary }]}>
                {formatTime(elapsedTime)}
              </Text>
            </View>
          </View>
          {session?.coldBoreShot && session.shotCount === 0 && (
            <View style={[styles.coldBoreBanner, { backgroundColor: colors.warning }]}>
              <Text style={styles.coldBoreText}>Cold Bore Shot</Text>
            </View>
          )}
        </Card>

        {/* Ballistic Solution Card - THE MAIN DISPLAY */}
        <Card style={styles.solutionCard}>
          <View style={styles.solutionHeader}>
            <Text style={[styles.distanceText, { color: colors.text.secondary }]}>
              {distance} yards
            </Text>
            {(elevationAdjustment !== 0 || windageAdjustment !== 0) && (
              <Pressable onPress={resetAdjustments} style={styles.resetButton}>
                <Text style={[styles.resetButtonText, { color: colors.primary }]}>Reset</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.correctionRow}>
            {/* Elevation with adjustment controls */}
            <View style={styles.correctionItem}>
              <Text style={[styles.correctionLabel, { color: colors.text.secondary }]}>
                ELEVATION
              </Text>
              <View style={styles.adjustmentRow}>
                <Pressable
                  style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                  onPress={() => adjustElevation(-0.1)}
                >
                  <Text style={[styles.adjustButtonText, { color: colors.text.primary }]}>−</Text>
                </Pressable>
                <Text style={[styles.correctionValue, { color: colors.primary }]}>
                  {adjustedElevation !== null ? adjustedElevation.toFixed(1) : '--'}
                </Text>
                <Pressable
                  style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                  onPress={() => adjustElevation(0.1)}
                >
                  <Text style={[styles.adjustButtonText, { color: colors.text.primary }]}>+</Text>
                </Pressable>
              </View>
              <Text style={[styles.correctionUnit, { color: colors.text.secondary }]}>MIL</Text>
              {elevationAdjustment !== 0 && (
                <Text style={[styles.adjustmentIndicator, { color: colors.warning }]}>
                  {elevationAdjustment > 0 ? '+' : ''}{elevationAdjustment.toFixed(1)}
                </Text>
              )}
            </View>

            <View style={styles.correctionDivider} />

            {/* Windage with adjustment controls */}
            <View style={styles.correctionItem}>
              <Text style={[styles.correctionLabel, { color: colors.text.secondary }]}>
                WINDAGE
              </Text>
              <View style={styles.adjustmentRow}>
                <Pressable
                  style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                  onPress={() => adjustWindage(-0.1)}
                >
                  <Text style={[styles.adjustButtonText, { color: colors.text.primary }]}>−</Text>
                </Pressable>
                <Text style={[styles.correctionValue, { color: colors.primary }]}>
                  {adjustedWindage !== null
                    ? `${adjustedWindage >= 0 ? 'R ' : 'L '}${Math.abs(adjustedWindage).toFixed(1)}`
                    : '--'}
                </Text>
                <Pressable
                  style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                  onPress={() => adjustWindage(0.1)}
                >
                  <Text style={[styles.adjustButtonText, { color: colors.text.primary }]}>+</Text>
                </Pressable>
              </View>
              <Text style={[styles.correctionUnit, { color: colors.text.secondary }]}>MIL</Text>
              {windageAdjustment !== 0 && (
                <Text style={[styles.adjustmentIndicator, { color: colors.warning }]}>
                  {windageAdjustment > 0 ? '+' : ''}{windageAdjustment.toFixed(1)}
                </Text>
              )}
            </View>
          </View>

          {solution && (
            <View style={styles.additionalInfo}>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>TOF</Text>
                <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                  {solution.timeOfFlight.toFixed(2)}s
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>Velocity</Text>
                <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                  {Math.round(solution.velocity)} fps
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>Energy</Text>
                <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                  {Math.round(solution.energy)} ft-lb
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* Distance Selector */}
        <Card style={styles.card}>
          <NumberPicker
            label="Target Distance"
            value={distance}
            onValueChange={handleDistanceChange}
            min={25}
            max={2000}
            step={25}
            unit="yards"
            presets={distancePresets}
          />
        </Card>

        {/* Shot Counter */}
        <Card style={styles.shotCounterCard}>
          <View style={styles.shotCounterRow}>
            <View style={styles.shotCounterLeft}>
              <Text style={[styles.shotCountLabel, { color: colors.text.secondary }]}>
                SHOTS FIRED
              </Text>
              <Text style={[styles.shotCountValue, { color: colors.text.primary }]}>
                {session?.shotCount || 0}
              </Text>
            </View>
            <Pressable
              style={[styles.recordShotButton, { backgroundColor: colors.primary }]}
              onPress={handleRecordShot}
              disabled={isRecording}
            >
              <Text style={styles.recordShotButtonText}>
                {isRecording ? '...' : 'SHOT'}
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* Wind Conditions */}
        {environment && (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Wind Conditions
            </Text>
            <View style={styles.windRow}>
              <View style={styles.windItem}>
                <Text style={[styles.windLabel, { color: colors.text.secondary }]}>Speed</Text>
                <Text style={[styles.windValue, { color: colors.text.primary }]}>
                  {environment.windSpeed} mph
                </Text>
              </View>
              <View style={styles.windItem}>
                <Text style={[styles.windLabel, { color: colors.text.secondary }]}>Direction</Text>
                <Text style={[styles.windValue, { color: colors.text.primary }]}>
                  {environment.windDirection}°
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* End Session Button */}
        <Button
          title="End Session"
          onPress={handleEndSession}
          variant="danger"
          size="large"
        />
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
  loadingText: {
    fontSize: 16,
  },
  headerCard: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  rifleName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  ammoName: {
    fontSize: 14,
  },
  timerLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  timerValue: {
    fontSize: 20,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  coldBoreBanner: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  coldBoreText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 14,
  },
  solutionCard: {
    marginBottom: 16,
    paddingVertical: 20,
  },
  solutionHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  distanceText: {
    fontSize: 16,
    fontWeight: '500',
  },
  correctionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  correctionItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  correctionDivider: {
    width: 1,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  correctionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  correctionValue: {
    fontSize: 40,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  correctionUnit: {
    fontSize: 14,
    marginTop: 4,
  },
  additionalInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  shotCounterCard: {
    marginBottom: 16,
  },
  shotCounterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shotCounterLeft: {
    flex: 1,
  },
  shotCountLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 4,
  },
  shotCountValue: {
    fontSize: 32,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  recordShotButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  recordShotButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  windRow: {
    flexDirection: 'row',
    gap: 16,
  },
  windItem: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    alignItems: 'center',
  },
  windLabel: {
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  windValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  adjustmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  adjustButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustButtonText: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
  adjustmentIndicator: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
});
