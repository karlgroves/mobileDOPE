import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, Text, StyleSheet, Alert, Pressable, Switch } from 'react-native';

import { Card, Button, NumberPicker } from '../components';
import { AdjustmentConfidenceBadge } from '../components/AdjustmentConfidenceBadge';
import { BarrelStateNotice } from '../components/BarrelStateNotice';
import { RelevantDopeList } from '../components/RelevantDopeList';
import { useTheme } from '../contexts/ThemeContext';
import { useBarrelState } from '../hooks/useBarrelState';
import { useDopeAdjustment } from '../hooks/useDopeAdjustment';
import { EnvironmentSnapshot } from '../models/EnvironmentSnapshot';
import { RangeSession } from '../models/RangeSession';
import { environmentRepository } from '../services/database/EnvironmentRepository';
import { rangeSessionRepository } from '../services/database/RangeSessionRepository';
import { useAmmoStore } from '../store/useAmmoStore';
import { useAppStore } from '../store/useAppStore';
import { useDOPEStore } from '../store/useDOPEStore';
import { useRifleStore } from '../store/useRifleStore';
import { BallisticSolution } from '../types/ballistic.types';
import { calculateBallisticSolution } from '../utils/ballistics';
import { SOLVER_DISTANCE_UNIT, toSolverYards } from '../utils/distanceUnits';
import { SOLVER_ONLY_REASON } from '../utils/dopeAdjustment';

import type { SessionStackScreenProps } from '../navigation/types';

type Props = SessionStackScreenProps<'RangeSessionActive'>;

/**
 * The unit `range_sessions.distance` is stored in.
 *
 * `RangeSessionStart` writes it from a picker labelled yards, and the column has
 * no unit beside it -- unlike `dope_logs`, which stores its own `distance_unit`.
 * Named rather than left implicit for two reasons: it is the single place to
 * change on the day the session grows a unit of its own, and #106's boundary
 * sweep requires any screen handling a distance unit to actually cross the
 * boundary through `toSolverYards` rather than assuming.
 *
 * It is the solver's own unit today, so the conversion below is the identity.
 * That is the point -- the identity is a fact about the schema, not a licence to
 * skip the call.
 */
const SESSION_DISTANCE_UNIT = SOLVER_DISTANCE_UNIT;

export const RangeSessionActive: React.FC<Props> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const { sessionId } = route.params;

  const { rifles } = useRifleStore();
  const { ammoProfiles } = useAmmoStore();
  const { settings } = useAppStore();
  const { createDopeLog, loadDopeLogs } = useDOPEStore();

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

  /**
   * DOPE-assisted aiming in session mode (#166).
   *
   * The same switch as the calculator's (#168), starting from the same stored
   * default (#167). Local state seeded from the setting, so turning it off for
   * one string does not turn it off tomorrow.
   */
  const [adjustByDope, setAdjustByDope] = useState(settings.dopeAdjustmentEnabled);
  const [showDopeDetails, setShowDopeDetails] = useState(false);
  /** Both barrel-state corrections are opt-in, per #165. */
  const [applyColdBore, setApplyColdBore] = useState(false);
  const [applyHeatShift, setApplyHeatShift] = useState(false);
  /** Set after a DOPE log is written here, to say the figure has just moved. */
  const [updatedFromLastShot, setUpdatedFromLastShot] = useState(false);
  const [isLoggingDope, setIsLoggingDope] = useState(false);

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

  // Screen wake lock - keep screen on during active session (if enabled in settings)
  useEffect(() => {
    if (settings.keepScreenAwakeDuringSession) {
      activateKeepAwakeAsync('rangeSession');
    }

    return () => {
      deactivateKeepAwake('rangeSession');
    };
  }, [settings.keepScreenAwakeDuringSession]);

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
        distance: toSolverYards(distance, SESSION_DISTANCE_UNIT),
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

  /**
   * The logs, so the adjustment has something to rank.
   *
   * `useDOPEStore` is filled by the History tab, which a shooter who went
   * straight to a session has never opened -- so without this the session would
   * show "No historical data, using solver only" for a rifle with fifty logs.
   *
   * Every log, not just this rifle's: `loadDopeLogs` *replaces* the shared
   * store, and the History list and the full-backup export both read it. A
   * filtered load here would leave a backup taken after a session silently
   * missing every other rifle's logs. Both hooks filter by rifle and load
   * themselves.
   *
   * Keyed on the session having loaded rather than on the session object,
   * which SHOT replaces on every press.
   */
  const sessionLoaded = session !== null;
  useEffect(() => {
    if (!sessionLoaded) return;
    loadDopeLogs().catch((error) => {
      // The recommendation falls back to the solver alone, which is the same
      // thing it shows for a rifle with no logs, so this is not fatal.
      console.error('Failed to load DOPE logs for the session:', error);
    });
  }, [sessionLoaded, loadDopeLogs]);

  const unit = settings.defaultCorrectionUnit;
  const solverElevation = solution
    ? unit === 'MIL'
      ? solution.elevationMIL
      : solution.elevationMOA
    : 0;
  const solverWindage = solution ? (unit === 'MIL' ? solution.windageMIL : solution.windageMOA) : 0;

  /** 1-based position of the shot about to be taken, for the heat-shift figure. */
  const nextShotNumber = (session?.shotCount ?? 0) + 1;
  /** The one the shooter is logging: the shot just fired, or the first. */
  const loggingShotNumber = Math.max(1, session?.shotCount ?? 0);
  const isColdBoreShot = (session?.coldBoreShot ?? false) && (session?.shotCount ?? 0) === 0;

  /**
   * The same recommendation the calculator shows, from the same hook (#166).
   *
   * Session mode is where it matters most, and a second copy of the ranking,
   * the per-snapshot predictions and the confidence gate is how the two screens
   * come to disagree about the same shot. `useDopeAdjustment` was lifted out of
   * `BallisticSolutionResults` for exactly this.
   *
   * Called unconditionally with ids of 0 before the session loads -- hooks
   * cannot be conditional, and no log matches rifle 0, so the hook returns the
   * solver's figure untouched.
   */
  const {
    relevantDope,
    dopeAdjusted,
    confident,
    interpolated,
    applied,
    shownConfidence,
    shownElevation,
  } = useDopeAdjustment({
    rifleId: session?.rifleId ?? 0,
    ammoId: session?.ammoId ?? 0,
    distanceYards: toSolverYards(distance, SESSION_DISTANCE_UNIT),
    solverElevation,
    unit,
    enabled: adjustByDope,
  });

  /** Cold-bore bias and heat shift from this shooter's own history (#165). */
  const barrelState = useBarrelState({
    rifleId: session?.rifleId ?? 0,
    ammoId: session?.ammoId ?? 0,
    shotNumber: nextShotNumber,
    unit,
  });

  /**
   * What the two barrel-state switches add, when they are on.
   *
   * Kept separate from the DOPE offset rather than folded into it: they are
   * corrections the shooter chose, and the expandable breakdown has to be able
   * to show each one on its own line.
   */
  const coldBoreApplied =
    applyColdBore && isColdBoreShot ? (barrelState.coldBoreCorrection ?? 0) : 0;
  const heatShiftApplied = applyHeatShift ? (barrelState.heatShiftCorrection ?? 0) : 0;
  const barrelCorrection = coldBoreApplied + heatShiftApplied;

  /** The figure to dial, before the manual trim the +/- buttons apply. */
  const recommendedElevation = shownElevation + barrelCorrection;

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
    Alert.alert('End Session', 'Are you sure you want to end this range session?', [
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
    ]);
  };

  // Handle distance change
  const handleDistanceChange = async (newDistance: number) => {
    setDistance(newDistance);
    // Reset adjustments when distance changes
    setElevationAdjustment(0);
    setWindageAdjustment(0);
    // The recommendation for a different distance was not updated from the last
    // shot, whatever the previous one was.
    setUpdatedFromLastShot(false);
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

  /**
   * Records what was dialled for this shot, and moves the next recommendation.
   *
   * **Which figure is stored, and why it is not the one in the big type.**
   * #189 settled that a figure derived from the logs must not be written back,
   * because every offset is measured against the solver -- storing the adjusted
   * elevation would make the history agree with itself rather than with the
   * target. That rule applies to the DOPE offset and to both barrel-state
   * corrections, all three of which come out of the log history.
   *
   * The manual trim is different in kind. It is the shooter's own observation at
   * the target, arrived at by watching where the bullet went, and it is the only
   * thing on this screen that is evidence rather than inference. So the log
   * records `solver + manual trim`, and the alert says so in those terms before
   * anything is written.
   *
   * That is also what makes the loop close: dial the recommendation, miss, trim
   * with the +/- buttons, log -- and the trim enters the history, so the next
   * recommendation moves. #166 asks for the figure to update straight away from
   * a logged shot, and this is the path by which it genuinely can.
   */
  const handleLogDope = () => {
    if (!session || !solution) return;

    const elevation = solverElevation + elevationAdjustment;
    const windage = solverWindage + windageAdjustment;
    const trim =
      elevationAdjustment === 0
        ? ''
        : ` (solver ${solverElevation.toFixed(2)} plus your ${elevationAdjustment > 0 ? '+' : ''}${elevationAdjustment.toFixed(1)} trim)`;

    Alert.alert(
      'Log this shot',
      `Records ${elevation.toFixed(2)} ${unit} elevation${trim} as shot ${loggingShotNumber} of this session. ` +
        'Corrections read from your own DOPE are not stored, because your logs are measured against the solver.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Shot',
          onPress: async () => {
            setIsLoggingDope(true);
            try {
              await createDopeLog({
                rifleId: session.rifleId,
                ammoId: session.ammoId,
                environmentId: session.environmentId,
                distance,
                distanceUnit: SESSION_DISTANCE_UNIT,
                elevationCorrection: elevation,
                windageCorrection: windage,
                correctionUnit: unit,
                targetType: 'other',
                // #164's remaining criterion: session logging supplies the shot
                // number, so barrel-state analysis has a string to fit.
                shotNumberInSession: loggingShotNumber,
                coldBoreShot: loggingShotNumber === 1 ? session.coldBoreShot : false,
              });
              setUpdatedFromLastShot(true);
              setElevationAdjustment(0);
              setWindageAdjustment(0);
              if (settings.hapticFeedbackEnabled) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (error) {
              console.error('Failed to log DOPE:', error);
              Alert.alert('Error', 'Failed to log this shot');
            } finally {
              setIsLoggingDope(false);
            }
          },
        },
      ]
    );
  };

  // Calculate adjusted values. The base is the DOPE-assisted recommendation
  // (#166) rather than the solver's raw figure, with the manual trim on top.
  const adjustedElevation = solution ? recommendedElevation + elevationAdjustment : null;
  const adjustedWindage = solution ? solverWindage + windageAdjustment : null;

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
        <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
          Loading session...
        </Text>
      </View>
    );
  }

  const rifle = session ? rifles.find((r) => r.id === session.rifleId) : null;
  const ammo = session ? ammoProfiles.find((a) => a.id === session.ammoId) : null;
  const distancePresets = settings.distancePresets;

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
              <Text style={[styles.timerLabel, { color: colors.text.secondary }]}>
                Session Time
              </Text>
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
              <Pressable
                onPress={resetAdjustments}
                style={styles.resetButton}
                accessibilityRole="button"
                accessibilityLabel="Reset elevation and windage adjustments"
                accessibilityHint="Returns both corrections to the calculated solution"
              >
                <Text style={[styles.resetButtonText, { color: colors.primaryText }]}>Reset</Text>
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
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease elevation correction, ${unit}`}
                  accessibilityHint={`Subtracts 0.1 ${unit}. Currently ${
                    adjustedElevation !== null ? adjustedElevation.toFixed(1) : 'no solution'
                  }`}
                >
                  <Text style={[styles.adjustButtonText, { color: colors.text.primary }]}>−</Text>
                </Pressable>
                <Text style={[styles.correctionValue, { color: colors.primaryText }]}>
                  {adjustedElevation !== null ? adjustedElevation.toFixed(1) : '--'}
                </Text>
                <Pressable
                  style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                  onPress={() => adjustElevation(0.1)}
                  accessibilityRole="button"
                  accessibilityLabel={`Increase elevation correction, ${unit}`}
                  accessibilityHint={`Adds 0.1 ${unit}. Currently ${
                    adjustedElevation !== null ? adjustedElevation.toFixed(1) : 'no solution'
                  }`}
                >
                  <Text style={[styles.adjustButtonText, { color: colors.text.primary }]}>+</Text>
                </Pressable>
              </View>
              <Text style={[styles.correctionUnit, { color: colors.text.secondary }]}>{unit}</Text>
              {elevationAdjustment !== 0 && (
                <Text style={[styles.adjustmentIndicator, { color: colors.warningText }]}>
                  {elevationAdjustment > 0 ? '+' : ''}
                  {elevationAdjustment.toFixed(1)}
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
                  accessibilityRole="button"
                  accessibilityLabel={`Adjust windage correction left, ${unit}`}
                  accessibilityHint={`Moves the hold 0.1 ${unit} left. Currently ${
                    adjustedWindage !== null
                      ? `${Math.abs(adjustedWindage).toFixed(1)} ${
                          adjustedWindage >= 0 ? 'right' : 'left'
                        }`
                      : 'no solution'
                  }`}
                >
                  <Text style={[styles.adjustButtonText, { color: colors.text.primary }]}>−</Text>
                </Pressable>
                <Text style={[styles.correctionValue, { color: colors.primaryText }]}>
                  {adjustedWindage !== null
                    ? `${adjustedWindage >= 0 ? 'R ' : 'L '}${Math.abs(adjustedWindage).toFixed(1)}`
                    : '--'}
                </Text>
                <Pressable
                  style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                  onPress={() => adjustWindage(0.1)}
                  accessibilityRole="button"
                  accessibilityLabel={`Adjust windage correction right, ${unit}`}
                  accessibilityHint={`Moves the hold 0.1 ${unit} right. Currently ${
                    adjustedWindage !== null
                      ? `${Math.abs(adjustedWindage).toFixed(1)} ${
                          adjustedWindage >= 0 ? 'right' : 'left'
                        }`
                      : 'no solution'
                  }`}
                >
                  <Text style={[styles.adjustButtonText, { color: colors.text.primary }]}>+</Text>
                </Pressable>
              </View>
              <Text style={[styles.correctionUnit, { color: colors.text.secondary }]}>{unit}</Text>
              {windageAdjustment !== 0 && (
                <Text style={[styles.adjustmentIndicator, { color: colors.warningText }]}>
                  {windageAdjustment > 0 ? '+' : ''}
                  {windageAdjustment.toFixed(1)}
                </Text>
              )}
            </View>
          </View>

          {/* Where the figure above came from (#166). Said in words under the
              number, because in session mode the shooter reads the number and
              acts on it -- so what it is based on has to be right there, not a
              screen away. */}
          {solution && (
            <View style={styles.dopeBlock} testID="session-dope-recommendation">
              <Text
                style={[styles.dopeCaption, { color: colors.text.secondary }]}
                testID="session-dope-caption"
              >
                {adjustByDope
                  ? (applied?.caption ??
                    confident?.reason ??
                    dopeAdjusted?.reason ??
                    SOLVER_ONLY_REASON)
                  : 'Adjustment off. Showing the solver alone.'}
              </Text>

              {updatedFromLastShot && (
                <Text
                  style={[styles.updatedNote, { color: colors.warningText }]}
                  testID="session-updated-from-last-shot"
                >
                  Updated from your last shot
                </Text>
              )}

              {adjustByDope &&
                shownConfidence !== undefined &&
                shownConfidence.contributingLogs > 0 && (
                  <AdjustmentConfidenceBadge
                    confidence={shownConfidence}
                    solverOnly={interpolated === undefined && (confident?.solverOnly ?? false)}
                    testID="session-adjustment-confidence"
                  />
                )}

              <View style={styles.adjustRow}>
                <Text style={[styles.adjustLabel, { color: colors.text.primary }]}>
                  Adjust by my DOPE
                </Text>
                <Switch
                  value={adjustByDope}
                  onValueChange={setAdjustByDope}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={adjustByDope ? '#ffffff' : '#f4f3f4'}
                  accessibilityLabel="Adjust by my DOPE"
                  accessibilityHint="Off shows the solver's own elevation with no correction from your logs"
                  testID="session-dope-adjust-switch"
                />
              </View>

              <Pressable
                onPress={() => setShowDopeDetails((shown) => !shown)}
                style={styles.detailsToggle}
                accessibilityRole="button"
                accessibilityLabel={showDopeDetails ? 'Hide details' : 'Show details'}
                accessibilityHint="Shows the solver's own figure, the offset applied and the logs behind it"
                accessibilityState={{ expanded: showDopeDetails }}
                testID="session-dope-details-toggle"
              >
                <Text style={[styles.detailsToggleText, { color: colors.primaryText }]}>
                  {showDopeDetails ? 'Hide details' : 'Show details'}
                </Text>
              </Pressable>

              {showDopeDetails && (
                <View testID="session-dope-details">
                  <View style={styles.infoRow}>
                    <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                      Solver alone
                    </Text>
                    <Text
                      style={[styles.detailValue, { color: colors.text.primary }]}
                      testID="session-detail-solver"
                    >
                      {solverElevation.toFixed(2)} {unit}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                      From your DOPE
                    </Text>
                    <Text
                      style={[styles.detailValue, { color: colors.text.primary }]}
                      testID="session-detail-dope"
                    >
                      {applied === undefined
                        ? '—'
                        : `${applied.offset >= 0 ? '+' : ''}${applied.offset.toFixed(2)} ${unit}`}
                    </Text>
                  </View>
                  {coldBoreApplied !== 0 && (
                    <View style={styles.infoRow}>
                      <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                        Cold-bore shift
                      </Text>
                      <Text
                        style={[styles.detailValue, { color: colors.text.primary }]}
                        testID="session-detail-cold-bore"
                      >
                        {coldBoreApplied >= 0 ? '+' : ''}
                        {coldBoreApplied.toFixed(2)} {unit}
                      </Text>
                    </View>
                  )}
                  {heatShiftApplied !== 0 && (
                    <View style={styles.infoRow}>
                      <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                        Heat shift
                      </Text>
                      <Text
                        style={[styles.detailValue, { color: colors.text.primary }]}
                        testID="session-detail-heat-shift"
                      >
                        {heatShiftApplied >= 0 ? '+' : ''}
                        {heatShiftApplied.toFixed(2)} {unit}
                      </Text>
                    </View>
                  )}
                  {elevationAdjustment !== 0 && (
                    <View style={styles.infoRow}>
                      <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                        Your trim
                      </Text>
                      <Text
                        style={[styles.detailValue, { color: colors.text.primary }]}
                        testID="session-detail-trim"
                      >
                        {elevationAdjustment > 0 ? '+' : ''}
                        {elevationAdjustment.toFixed(1)} {unit}
                      </Text>
                    </View>
                  )}
                  {applied?.extrapolated && (
                    <Text
                      style={[styles.dopeCaption, { color: colors.text.primary }]}
                      testID="session-extrapolated-warning"
                    >
                      Beyond your logged distances — confirm with a sighter.
                    </Text>
                  )}
                  <RelevantDopeList
                    matches={relevantDope}
                    emptyMessage={
                      interpolated !== undefined
                        ? 'No log is close enough to this shot to compare one by one. The ' +
                          'adjustment above was read across the distances you have logged.'
                        : undefined
                    }
                    testID="session-relevant-dope"
                  />
                </View>
              )}
            </View>
          )}

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

        {/* Cold-bore bias and heat shift from this shooter's own logs (#165). */}
        <Card style={styles.card}>
          <BarrelStateNotice
            state={barrelState}
            applyColdBore={applyColdBore}
            onApplyColdBoreChange={setApplyColdBore}
            applyHeatShift={applyHeatShift}
            onApplyHeatShiftChange={setApplyHeatShift}
            isColdBoreShot={isColdBoreShot}
            unit={unit}
            testID="session-barrel-state"
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
              accessibilityRole="button"
              accessibilityLabel="Record shot"
              accessibilityHint={`Logs a shot at ${distance} yards with the corrections shown`}
              accessibilityState={{ disabled: isRecording, busy: isRecording }}
            >
              <Text style={styles.recordShotButtonText}>{isRecording ? '...' : 'SHOT'}</Text>
            </Pressable>
          </View>
          {/* A deliberate record, as distinct from the counter beside it (#164).
              SHOT still only counts rounds fired -- making every press write a
              permanent log would turn a 60-shot string into 60 log entries,
              which is a different feature from recording the DOPE you dialled. */}
          <Button
            title={isLoggingDope ? 'Logging...' : 'Log This Shot to DOPE'}
            onPress={handleLogDope}
            variant="secondary"
            size="large"
            disabled={isLoggingDope || !solution}
          />
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
        <Button title="End Session" onPress={handleEndSession} variant="danger" size="large" />
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
  dopeBlock: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  dopeCaption: {
    fontSize: 13,
    lineHeight: 18,
  },
  updatedNote: {
    fontSize: 13,
    fontWeight: '600',
  },
  adjustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  adjustLabel: {
    flex: 1,
    fontSize: 15,
    marginRight: 12,
  },
  detailsToggle: {
    minHeight: 44,
    justifyContent: 'center',
  },
  detailsToggleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
