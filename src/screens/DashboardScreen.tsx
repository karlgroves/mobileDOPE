/**
 * Dashboard Screen - Quick DOPE Solution
 * Minimal, field-optimized interface for immediate ballistic solutions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import type { MainTabScreenProps } from '../navigation/types';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { useAppStore } from '../store';
import { calculateBallisticSolution } from '../utils/ballistics';
import type { RifleConfig, AmmoConfig, ShotParameters } from '../types/ballistic.types';
import type { AtmosphericConditions } from '../utils/atmospheric';

type Props = MainTabScreenProps<'Dashboard'>;

export const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const { settings } = useAppStore();

  const { rifles, loadRifles } = useRifleStore();
  const { ammoProfiles, loadAmmoProfiles } = useAmmoStore();
  const { snapshots, loadSnapshots } = useEnvironmentStore();

  // Selected profiles
  const [selectedRifleId, setSelectedRifleId] = useState<number | null>(null);
  const [selectedAmmoId, setSelectedAmmoId] = useState<number | null>(null);

  // Load initial data
  useEffect(() => {
    loadRifles();
    loadAmmoProfiles();
    loadSnapshots(1); // Load most recent snapshot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shooting parameters
  const [distance, setDistance] = useState(300); // yards
  const [windSpeed, setWindSpeed] = useState(5); // mph
  const [windDirection, setWindDirection] = useState(180); // degrees (3 o'clock = 90, 9 o'clock = 270)

  // Ballistic solution
  const [elevation, setElevation] = useState<number | null>(null);
  const [windage, setWindage] = useState<number | null>(null);

  const selectedRifle = rifles.find((r) => r.id === selectedRifleId);
  const selectedAmmo = ammoProfiles.find((a) => a.id === selectedAmmoId);
  const latestEnv = snapshots[0];

  // Auto-select first rifle when rifles load and none selected
  const prevRiflesLength = React.useRef(rifles.length);
  if (!selectedRifleId && rifles.length > 0 && prevRiflesLength.current === 0) {
    setSelectedRifleId(rifles[0].id!);
    // Also auto-select compatible ammo
    const compatibleAmmo = ammoProfiles.find((a) => a.caliber === rifles[0].caliber);
    if (compatibleAmmo) {
      setSelectedAmmoId(compatibleAmmo.id!);
    }
  }
  prevRiflesLength.current = rifles.length;

  // Auto-select compatible ammo when ammo profiles load
  const prevAmmoLength = React.useRef(ammoProfiles.length);
  if (selectedRifle && !selectedAmmoId && ammoProfiles.length > 0 && prevAmmoLength.current === 0) {
    const compatibleAmmo = ammoProfiles.find((a) => a.caliber === selectedRifle.caliber);
    if (compatibleAmmo) {
      setSelectedAmmoId(compatibleAmmo.id!);
    }
  }
  prevAmmoLength.current = ammoProfiles.length;

  // Calculate ballistic solution
  const calculateSolution = useCallback(() => {
    if (!selectedRifle || !selectedAmmo || !latestEnv) {
      setElevation(null);
      setWindage(null);
      return;
    }

    try {
      // Validate required data
      if (!selectedRifle.scopeHeight || selectedRifle.scopeHeight <= 0) {
        console.warn('Invalid sight height:', selectedRifle.scopeHeight);
        setElevation(null);
        setWindage(null);
        return;
      }

      if (!selectedRifle.zeroDistance || selectedRifle.zeroDistance <= 0) {
        console.warn('Invalid zero distance:', selectedRifle.zeroDistance);
        setElevation(null);
        setWindage(null);
        return;
      }

      if (!selectedAmmo.muzzleVelocity || selectedAmmo.muzzleVelocity <= 0) {
        console.warn('Invalid muzzle velocity:', selectedAmmo.muzzleVelocity);
        setElevation(null);
        setWindage(null);
        return;
      }

      if (!selectedAmmo.ballisticCoefficientG7 || selectedAmmo.ballisticCoefficientG7 <= 0) {
        console.warn('Invalid BC G7:', selectedAmmo.ballisticCoefficientG7);
        setElevation(null);
        setWindage(null);
        return;
      }

      const rifleConfig: RifleConfig = {
        sightHeight: selectedRifle.scopeHeight,
        zeroDistance: selectedRifle.zeroDistance,
        twistRate: selectedRifle.twistRate,
        barrelLength: selectedRifle.barrelLength,
      };

      const ammoConfig: AmmoConfig = {
        muzzleVelocity: selectedAmmo.muzzleVelocity,
        ballisticCoefficient: selectedAmmo.ballisticCoefficientG7,
        dragModel: 'G7',
        bulletWeight: selectedAmmo.bulletWeight,
      };

      const shotParams: ShotParameters = {
        distance: distance,
        angle: 0,
        windSpeed: windSpeed,
        windDirection: windDirection,
      };

      const atmosphere: AtmosphericConditions = {
        temperature: latestEnv.temperature,
        pressure: latestEnv.pressure,
        humidity: latestEnv.humidity,
        altitude: latestEnv.altitude,
      };

      console.log('Calculating ballistics with:', {
        rifle: rifleConfig,
        ammo: ammoConfig,
        shot: shotParams,
        atmosphere,
      });

      const solution = calculateBallisticSolution(
        rifleConfig,
        ammoConfig,
        shotParams,
        atmosphere,
        false
      );

      console.log('Ballistic solution:', solution);

      const unit = settings.defaultCorrectionUnit;
      const elevVal = unit === 'MIL' ? solution.elevationMIL : solution.elevationMOA;
      const windVal = unit === 'MIL' ? solution.windageMIL : solution.windageMOA;

      if (!isFinite(elevVal) || !isFinite(windVal)) {
        console.error('Invalid solution values:', { elevation: elevVal, windage: windVal });
        setElevation(null);
        setWindage(null);
        return;
      }

      setElevation(elevVal);
      setWindage(windVal);
    } catch (error) {
      console.error('Ballistic calculation error:', error);
      setElevation(null);
      setWindage(null);
    }
  }, [selectedRifle, selectedAmmo, latestEnv, distance, windSpeed, windDirection, settings]);

  useEffect(() => {
    calculateSolution();
  }, [calculateSolution]);

  const adjustDistance = (delta: number) => {
    setDistance((prev) => Math.max(25, Math.min(2000, prev + delta)));
  };

  const adjustWindSpeed = (delta: number) => {
    setWindSpeed((prev) => Math.max(0, Math.min(50, prev + delta)));
  };

  const cycleWindDirection = () => {
    // Cycle through common clock positions: 3, 6, 9, 12 o'clock
    const clockPositions = [90, 180, 270, 0];
    const currentIndex = clockPositions.findIndex((pos) => pos === windDirection);
    const nextIndex = (currentIndex + 1) % clockPositions.length;
    setWindDirection(clockPositions[nextIndex]);
  };

  const getWindDirectionText = (degrees: number): string => {
    if (degrees === 0) return "12 o'clock";
    if (degrees === 90) return "3 o'clock";
    if (degrees === 180) return "6 o'clock";
    if (degrees === 270) return "9 o'clock";
    return `${degrees}°`;
  };

  const getWindHoldDirection = (): string => {
    if (windDirection >= 315 || windDirection < 45) return 'Head/Tail';
    if (windDirection >= 45 && windDirection < 135) return 'L→R';
    if (windDirection >= 135 && windDirection < 225) return 'Head/Tail';
    return 'R→L';
  };

  const handleConfirmShot = () => {
    if (!selectedRifle || !selectedAmmo) {
      Alert.alert('Setup Required', 'Please select a rifle and ammunition profile');
      return;
    }

    // Navigate to DOPE log entry with pre-filled data
    // @ts-expect-error Cross-stack navigation typing
    navigation.navigate('History', {
      screen: 'DOPELogEdit',
      params: {
        prefill: {
          rifleId: selectedRifleId,
          ammoId: selectedAmmoId,
          distance: distance,
          distanceUnit: settings.defaultDistanceUnit,
          elevationCorrection: elevation || 0,
          windageCorrection: windage || 0,
          correctionUnit: settings.defaultCorrectionUnit,
        },
      },
    });
  };

  const hasRifle = !!selectedRifle;
  const hasAmmo = !!selectedAmmo;
  const hasEnv = !!latestEnv;
  const canCalculate = hasRifle && hasAmmo && hasEnv;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* App Title */}
        <View style={styles.header}>
          <Text style={[styles.appTitle, { color: colors.text.primary }]}>Mobile DOPE</Text>
        </View>

        {/* Trust Indicators */}
        <View style={[styles.trustBar, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={() => navigation.navigate('Rifles')} style={styles.trustItem}>
            <Text
              style={[
                styles.trustText,
                { color: hasRifle ? colors.primary : colors.text.secondary },
              ]}
            >
              Rifle {hasRifle ? '✓' : '○'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.trustDivider, { color: colors.text.secondary }]}>•</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Ammo')} style={styles.trustItem}>
            <Text
              style={[
                styles.trustText,
                { color: hasAmmo ? colors.primary : colors.text.secondary },
              ]}
            >
              Ammo {hasAmmo ? '✓' : '○'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.trustDivider, { color: colors.text.secondary }]}>•</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Session')} style={styles.trustItem}>
            <Text
              style={[styles.trustText, { color: hasEnv ? colors.primary : colors.text.secondary }]}
            >
              Env {hasEnv ? '✓' : '○'}
            </Text>
          </TouchableOpacity>
        </View>

        {canCalculate ? (
          <>
            {/* Distance Selector */}
            <View style={[styles.distanceSection, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionLabel, { color: colors.text.secondary }]}>DISTANCE</Text>
              <Text style={[styles.distanceValue, { color: colors.text.primary }]}>
                {distance} yd
              </Text>
              <View style={styles.distanceButtons}>
                <TouchableOpacity
                  style={[styles.quickAdjustButton, { backgroundColor: colors.background }]}
                  onPress={() => adjustDistance(-25)}
                >
                  <Text style={[styles.quickAdjustText, { color: colors.text.primary }]}>-25</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickAdjustButton, { backgroundColor: colors.background }]}
                  onPress={() => adjustDistance(-10)}
                >
                  <Text style={[styles.quickAdjustText, { color: colors.text.primary }]}>-10</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickAdjustButton, { backgroundColor: colors.background }]}
                  onPress={() => adjustDistance(10)}
                >
                  <Text style={[styles.quickAdjustText, { color: colors.text.primary }]}>+10</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickAdjustButton, { backgroundColor: colors.background }]}
                  onPress={() => adjustDistance(25)}
                >
                  <Text style={[styles.quickAdjustText, { color: colors.text.primary }]}>+25</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Elevation Solution - Largest on screen */}
            <View style={[styles.elevationSection, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionLabel, { color: colors.text.secondary }]}>ELEVATION</Text>
              <Text style={[styles.elevationValue, { color: colors.primary }]}>
                {elevation !== null ? elevation.toFixed(2) : '--'} {settings.defaultCorrectionUnit}
              </Text>
            </View>

            {/* Wind Hold */}
            <View style={[styles.windHoldSection, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionLabel, { color: colors.text.secondary }]}>WIND HOLD</Text>
              <Text style={[styles.windHoldValue, { color: colors.text.primary }]}>
                {windage !== null ? Math.abs(windage).toFixed(2) : '--'}{' '}
                {settings.defaultCorrectionUnit} ({getWindHoldDirection()})
              </Text>
            </View>

            {/* Wind Controls */}
            <View style={[styles.windControls, { backgroundColor: colors.surface }]}>
              <View style={styles.windControlRow}>
                <Text style={[styles.windLabel, { color: colors.text.secondary }]}>Wind Dir:</Text>
                <TouchableOpacity
                  style={[styles.windButton, { backgroundColor: colors.background }]}
                  onPress={cycleWindDirection}
                >
                  <Text style={[styles.windValue, { color: colors.text.primary }]}>
                    {getWindDirectionText(windDirection)}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.windControlRow}>
                <Text style={[styles.windLabel, { color: colors.text.secondary }]}>Wind:</Text>
                <View style={styles.windSpeedControls}>
                  <TouchableOpacity
                    style={[styles.windAdjustButton, { backgroundColor: colors.background }]}
                    onPress={() => adjustWindSpeed(-1)}
                  >
                    <Text style={[styles.windAdjustText, { color: colors.text.primary }]}>−</Text>
                  </TouchableOpacity>
                  <Text style={[styles.windSpeedValue, { color: colors.text.primary }]}>
                    {windSpeed} mph
                  </Text>
                  <TouchableOpacity
                    style={[styles.windAdjustButton, { backgroundColor: colors.background }]}
                    onPress={() => adjustWindSpeed(1)}
                  >
                    <Text style={[styles.windAdjustText, { color: colors.text.primary }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Confirm Shot Button */}
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: colors.primary }]}
              onPress={handleConfirmShot}
              activeOpacity={0.8}
            >
              <Text style={[styles.confirmButtonText, { color: colors.text.inverse }]}>
                CONFIRM SHOT
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.setupRequired}>
            <Text style={[styles.setupTitle, { color: colors.text.primary }]}>Setup Required</Text>
            <Text style={[styles.setupMessage, { color: colors.text.secondary }]}>
              Tap the indicators above to configure:
            </Text>
            {!hasRifle && (
              <Text style={[styles.setupItem, { color: colors.text.secondary }]}>
                • Select a rifle profile
              </Text>
            )}
            {!hasAmmo && (
              <Text style={[styles.setupItem, { color: colors.text.secondary }]}>
                • Select ammunition
              </Text>
            )}
            {!hasEnv && (
              <Text style={[styles.setupItem, { color: colors.text.secondary }]}>
                • Record weather conditions
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  trustBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  trustItem: {
    paddingVertical: 4,
  },
  trustText: {
    fontSize: 16,
    fontWeight: '600',
  },
  trustDivider: {
    fontSize: 16,
  },
  distanceSection: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  distanceValue: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  distanceButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quickAdjustButton: {
    minWidth: 60,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickAdjustText: {
    fontSize: 16,
    fontWeight: '600',
  },
  elevationSection: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  elevationValue: {
    fontSize: 64,
    fontWeight: 'bold',
    letterSpacing: -2,
  },
  windHoldSection: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  windHoldValue: {
    fontSize: 28,
    fontWeight: '600',
  },
  windControls: {
    padding: 20,
    borderRadius: 12,
    gap: 16,
  },
  windControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  windLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  windButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  windValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  windSpeedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  windAdjustButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  windAdjustText: {
    fontSize: 24,
    fontWeight: '600',
  },
  windSpeedValue: {
    fontSize: 18,
    fontWeight: '600',
    minWidth: 70,
    textAlign: 'center',
  },
  confirmButton: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  setupRequired: {
    padding: 32,
    alignItems: 'center',
  },
  setupTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  setupMessage: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  setupItem: {
    fontSize: 16,
    marginBottom: 8,
  },
});
