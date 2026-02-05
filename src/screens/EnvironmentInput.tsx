/**
 * Environmental Data Input Screen
 * Manual and sensor-based environmental condition entry
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/Button';
import { NumberInput } from '../components/NumberInput';
import { Picker } from '../components/Picker';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { EnvironmentSnapshotData } from '../models/EnvironmentSnapshot';
import * as Location from 'expo-location';

// Wind direction options in degrees
const WIND_DIRECTION_OPTIONS = [
  { label: '0° (Headwind)', value: '0' },
  { label: '45°', value: '45' },
  { label: '90° (Right)', value: '90' },
  { label: '135°', value: '135' },
  { label: '180° (Tailwind)', value: '180' },
  { label: '225°', value: '225' },
  { label: '270° (Left)', value: '270' },
  { label: '315°', value: '315' },
];

// Environmental presets for common conditions
const PRESETS = {
  standard: {
    name: 'Standard Atmosphere (ICAO)',
    temperature: 59,
    humidity: 50,
    pressure: 29.92,
    altitude: 0,
  },
  hot: {
    name: 'Hot Day',
    temperature: 95,
    humidity: 60,
    pressure: 29.92,
    altitude: 0,
  },
  cold: {
    name: 'Cold Day',
    temperature: 30,
    humidity: 40,
    pressure: 30.2,
    altitude: 0,
  },
  highAltitude: {
    name: 'High Altitude (5000ft)',
    temperature: 50,
    humidity: 30,
    pressure: 24.9,
    altitude: 5000,
  },
};

export function EnvironmentInput() {
  const { theme } = useTheme();
  const { colors } = theme;
  const { current, setCurrent, saveCurrent, loading } = useEnvironmentStore();

  // Environmental parameters
  const [temperature, setTemperature] = useState<number | undefined>(current?.temperature || 59);
  const [humidity, setHumidity] = useState<number | undefined>(current?.humidity || 50);
  const [pressure, setPressure] = useState<number | undefined>(current?.pressure || 29.92);
  const [altitude, setAltitude] = useState<number | undefined>(current?.altitude || 0);
  const [windSpeed, setWindSpeed] = useState<number | undefined>(current?.windSpeed || 0);
  const [windDirection, setWindDirection] = useState<number | undefined>(
    current?.windDirection || 0
  );
  const [latitude, setLatitude] = useState<number | undefined>(current?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(current?.longitude);

  // Sensor availability
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);

  // Density altitude (calculated)
  const [densityAltitude, setDensityAltitude] = useState<number>(0);

  /**
   * Check and request sensor permissions
   */
  const checkSensorPermissions = async () => {
    try {
      // Check location permission
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');

      if (status === 'granted') {
        const locationStatus = await Location.hasServicesEnabledAsync();
        setLocationEnabled(locationStatus);
      }
    } catch (error) {
      console.error('Error checking sensor permissions:', error);
    }
  };

  /**
   * Request location permission
   */
  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');

      if (status === 'granted') {
        const locationStatus = await Location.hasServicesEnabledAsync();
        setLocationEnabled(locationStatus);
        if (locationStatus) {
          await fetchGPSData();
        }
      } else {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to automatically fetch GPS data.'
        );
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to request location permission');
    }
  };

  /**
   * Fetch GPS data (altitude and coordinates)
   */
  const fetchGPSData = async () => {
    if (!locationPermission || !locationEnabled) {
      Alert.alert(
        'Location Services',
        'Location services are not available. Please enable location permissions in settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enable', onPress: requestLocationPermission },
        ]
      );
      return;
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setAltitude(Math.round(location.coords.altitude || 0) * 3.28084); // meters to feet
      setLatitude(Number(location.coords.latitude.toFixed(6)));
      setLongitude(Number(location.coords.longitude.toFixed(6)));

      Alert.alert('Success', 'GPS data updated from device location');
    } catch (_error) {
      Alert.alert('Error', 'Failed to fetch GPS data. Please enter altitude manually.');
    }
  };

  /**
   * Calculate density altitude
   * Formula: DA = PA + (120 * (OAT - ISA))
   */
  const calculateDensityAltitude = () => {
    if (temperature === undefined || pressure === undefined || altitude === undefined) {
      setDensityAltitude(0);
      return;
    }

    const standardPressure = 29.92; // inHg at sea level
    const pressureAltitude = altitude + 1000 * (standardPressure - pressure);
    const standardTemp = 59 - 0.00356 * altitude; // ISA temp at altitude
    const tempDifference = temperature - standardTemp;
    const da = pressureAltitude + 120 * tempDifference;

    setDensityAltitude(Math.round(da));
  };

  useEffect(() => {
    checkSensorPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    calculateDensityAltitude();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temperature, pressure, altitude]);

  /**
   * Apply a preset
   */
  const applyPreset = (preset: (typeof PRESETS)[keyof typeof PRESETS]) => {
    setTemperature(preset.temperature);
    setHumidity(preset.humidity);
    setPressure(preset.pressure);
    setAltitude(preset.altitude);
    Alert.alert('Preset Applied', `Applied "${preset.name}" preset`);
  };

  /**
   * Validate and save current conditions
   */
  const handleSave = async () => {
    if (
      temperature === undefined ||
      humidity === undefined ||
      pressure === undefined ||
      altitude === undefined ||
      windSpeed === undefined ||
      windDirection === undefined
    ) {
      Alert.alert('Missing Data', 'Please fill in all required environmental parameters.');
      return;
    }

    try {
      const data: EnvironmentSnapshotData = {
        temperature,
        humidity,
        pressure,
        altitude,
        windSpeed,
        windDirection,
        latitude,
        longitude,
      };

      setCurrent(data);
      await saveCurrent();
      Alert.alert('Success', 'Environmental conditions saved');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save data');
    }
  };

  /**
   * Update current without saving to database
   */
  const handleUpdateCurrent = () => {
    if (
      temperature === undefined ||
      humidity === undefined ||
      pressure === undefined ||
      altitude === undefined ||
      windSpeed === undefined ||
      windDirection === undefined
    ) {
      Alert.alert('Missing Data', 'Please fill in all required environmental parameters.');
      return;
    }

    const data: EnvironmentSnapshotData = {
      temperature,
      humidity,
      pressure,
      altitude,
      windSpeed,
      windDirection,
      latitude,
      longitude,
    };

    setCurrent(data);
    Alert.alert('Success', 'Current conditions updated (not saved to history)');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Presets */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Quick Presets</Text>
          <View style={styles.presetGrid}>
            {Object.entries(PRESETS).map(([key, preset]) => (
              <TouchableOpacity
                key={key}
                style={[styles.presetButton, { backgroundColor: colors.surface }]}
                onPress={() => applyPreset(preset)}
              >
                <Text style={[styles.presetText, { color: colors.primary }]}>
                  {preset.name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Atmospheric Conditions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Atmospheric Conditions
          </Text>

          <NumberInput
            label="Temperature"
            value={temperature}
            onChangeValue={setTemperature}
            min={-50}
            max={150}
            precision={0}
            unit="°F"
            required
          />

          <NumberInput
            label="Humidity"
            value={humidity}
            onChangeValue={setHumidity}
            min={0}
            max={100}
            precision={0}
            unit="%"
            required
          />

          <NumberInput
            label="Barometric Pressure"
            value={pressure}
            onChangeValue={setPressure}
            min={20}
            max={35}
            precision={2}
            unit="inHg"
            required
          />

          <NumberInput
            label="Altitude"
            value={altitude}
            onChangeValue={setAltitude}
            min={-1000}
            max={30000}
            precision={0}
            unit="ft"
            required
          />

          {/* GPS Data Button */}
          <View style={styles.gpsButtonContainer}>
            <Button
              title={locationPermission ? 'Update from GPS' : 'Enable GPS'}
              onPress={locationPermission ? fetchGPSData : requestLocationPermission}
              variant="secondary"
            />
          </View>

          {/* Density Altitude Display */}
          <View style={[styles.densityAltitudeCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.densityAltitudeLabel, { color: colors.text.secondary }]}>
              Density Altitude
            </Text>
            <Text style={[styles.densityAltitudeValue, { color: colors.primary }]}>
              {densityAltitude.toLocaleString()} ft
            </Text>
          </View>
        </View>

        {/* Wind Conditions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Wind Conditions</Text>

          <NumberInput
            label="Wind Speed"
            value={windSpeed}
            onChangeValue={setWindSpeed}
            min={0}
            max={100}
            precision={0}
            unit="mph"
            required
          />

          <Picker
            label="Wind Direction"
            value={windDirection?.toString()}
            onValueChange={(value) => setWindDirection(value ? parseInt(value) : undefined)}
            options={WIND_DIRECTION_OPTIONS}
            placeholder="Select direction"
            required
          />
        </View>

        {/* GPS Coordinates (Optional) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            GPS Coordinates (Optional)
          </Text>

          <NumberInput
            label="Latitude"
            value={latitude}
            onChangeValue={setLatitude}
            min={-90}
            max={90}
            precision={6}
            unit="°"
          />

          <NumberInput
            label="Longitude"
            value={longitude}
            onChangeValue={setLongitude}
            min={-180}
            max={180}
            precision={6}
            unit="°"
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            title="Update Current"
            onPress={handleUpdateCurrent}
            variant="secondary"
            loading={loading}
          />
          <Button title="Save to History" onPress={handleSave} loading={loading} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 14,
    fontWeight: '600',
  },
  gpsButtonContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  densityAltitudeCard: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  densityAltitudeLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  densityAltitudeValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  buttonContainer: {
    gap: 12,
    marginTop: 8,
    marginBottom: 32,
  },
});
