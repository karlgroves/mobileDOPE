/**
 * Settings Screen
 * User preferences and app configuration
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  Alert,
  Switch,
  TextInput,
  Pressable,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Card, Button, SegmentedControl } from '../components';
import type { RootStackScreenProps } from '../navigation/types';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import { useDOPEStore } from '../store/useDOPEStore';
import { useAppStore, DEFAULT_DISTANCE_PRESETS } from '../store/useAppStore';
import {
  exportFullBackup,
  exportAllRifleProfilesJSON,
  exportDOPELogsCSV,
  exportDOPELogsJSON,
  exportDOPELogsPDF,
} from '../services/ExportService';
import { importFullBackup, importRifleProfiles, importDOPELogs } from '../services/ImportService';

type Props = RootStackScreenProps<'Settings'>;

export const SettingsScreen: React.FC<Props> = () => {
  const { theme, setThemeMode } = useTheme();
  const { settings, updateSettings } = useAppStore();
  const { colors } = theme;

  const { rifles } = useRifleStore();
  const { ammoProfiles } = useAmmoStore();
  const { dopeLogs } = useDOPEStore();

  // Distance preset customization state
  const [newPresetValue, setNewPresetValue] = useState<string>('');

  const handleAddPreset = async () => {
    const value = parseInt(newPresetValue, 10);
    if (isNaN(value) || value < 25 || value > 3000) {
      Alert.alert('Invalid Distance', 'Please enter a distance between 25 and 3000.');
      return;
    }
    if (settings.distancePresets.includes(value)) {
      Alert.alert('Duplicate', 'This distance is already in your presets.');
      return;
    }
    const newPresets = [...settings.distancePresets, value].sort((a, b) => a - b);
    await updateSettings({ distancePresets: newPresets });
    setNewPresetValue('');
  };

  const handleRemovePreset = async (value: number) => {
    if (settings.distancePresets.length <= 1) {
      Alert.alert('Cannot Remove', 'You must have at least one distance preset.');
      return;
    }
    const newPresets = settings.distancePresets.filter((p) => p !== value);
    await updateSettings({ distancePresets: newPresets });
  };

  const handleResetPresets = () => {
    Alert.alert(
      'Reset Distance Presets',
      'Reset to default presets (100-1000 in 100-yard increments)?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            await updateSettings({ distancePresets: DEFAULT_DISTANCE_PRESETS });
          },
        },
      ]
    );
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all rifle profiles, ammunition profiles, and DOPE logs. This action cannot be undone.\n\nAre you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All Data',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement database clear
            Alert.alert('Not Implemented', 'Database clear functionality coming soon.');
          },
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'Choose what to export:',
      [
        {
          text: 'Full Backup (All Data)',
          onPress: async () => {
            const result = await exportFullBackup(rifles, ammoProfiles, dopeLogs);
            if (result.success) {
              Alert.alert(
                'Success',
                `Exported ${rifles.length} rifles, ${ammoProfiles.length} ammo profiles, and ${dopeLogs.length} DOPE logs.`
              );
            } else {
              Alert.alert('Error', result.error || 'Export failed');
            }
          },
        },
        {
          text: 'Rifle Profiles (JSON)',
          onPress: async () => {
            if (rifles.length === 0) {
              Alert.alert('No Data', 'You have no rifle profiles to export.');
              return;
            }
            const result = await exportAllRifleProfilesJSON(rifles);
            if (result.success) {
              Alert.alert('Success', `Exported ${rifles.length} rifle profiles.`);
            } else {
              Alert.alert('Error', result.error || 'Export failed');
            }
          },
        },
        {
          text: 'DOPE Logs (CSV)',
          onPress: async () => {
            if (dopeLogs.length === 0) {
              Alert.alert('No Data', 'You have no DOPE logs to export.');
              return;
            }
            const result = await exportDOPELogsCSV(dopeLogs, rifles, ammoProfiles);
            if (result.success) {
              Alert.alert('Success', `Exported ${dopeLogs.length} DOPE logs.`);
            } else {
              Alert.alert('Error', result.error || 'Export failed');
            }
          },
        },
        {
          text: 'DOPE Logs (JSON)',
          onPress: async () => {
            if (dopeLogs.length === 0) {
              Alert.alert('No Data', 'You have no DOPE logs to export.');
              return;
            }
            const result = await exportDOPELogsJSON(dopeLogs);
            if (result.success) {
              Alert.alert('Success', `Exported ${dopeLogs.length} DOPE logs.`);
            } else {
              Alert.alert('Error', result.error || 'Export failed');
            }
          },
        },
        {
          text: 'DOPE Logs (PDF Report)',
          onPress: async () => {
            if (dopeLogs.length === 0) {
              Alert.alert('No Data', 'You have no DOPE logs to export.');
              return;
            }
            const result = await exportDOPELogsPDF(dopeLogs, rifles, ammoProfiles);
            if (result.success) {
              Alert.alert('Success', `Exported ${dopeLogs.length} DOPE logs as PDF report.`);
            } else {
              Alert.alert('Error', result.error || 'Export failed');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const handleImportData = () => {
    Alert.alert(
      'Import Data',
      'Choose what to import:',
      [
        {
          text: 'Full Backup',
          onPress: async () => {
            const result = await importFullBackup();
            if (result.success && result.imported) {
              Alert.alert(
                'Success',
                `Imported:\n• ${result.imported.rifles || 0} rifle profiles\n• ${result.imported.ammos || 0} ammo profiles\n• ${result.imported.logs || 0} DOPE logs`
              );
            } else {
              Alert.alert('Error', result.error || 'Import failed');
            }
          },
        },
        {
          text: 'Rifle Profiles Only',
          onPress: async () => {
            const result = await importRifleProfiles();
            if (result.success && result.imported) {
              Alert.alert('Success', `Imported ${result.imported.rifles || 0} rifle profiles`);
            } else {
              Alert.alert('Error', result.error || 'Import failed');
            }
          },
        },
        {
          text: 'DOPE Logs Only',
          onPress: async () => {
            const result = await importDOPELogs();
            if (result.success && result.imported) {
              Alert.alert('Success', `Imported ${result.imported.logs || 0} DOPE logs`);
            } else {
              Alert.alert('Error', result.error || 'Import failed');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const themeOptions = [
    { label: 'Dark', value: 'dark' },
    { label: 'Light', value: 'light' },
    { label: 'Night Vision', value: 'nightVision' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Appearance */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Appearance</Text>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Theme</Text>
            <SegmentedControl
              options={themeOptions}
              selectedValue={settings.themeMode}
              onValueChange={(value) => setThemeMode(value as 'dark' | 'light' | 'nightVision')}
            />
          </View>
        </Card>

        {/* Default Units */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Default Units</Text>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Angular Unit</Text>
            <SegmentedControl
              options={[
                { label: 'MIL', value: 'MIL' },
                { label: 'MOA', value: 'MOA' },
              ]}
              selectedValue={settings.defaultCorrectionUnit}
              onValueChange={async (value) => {
                await updateSettings({ defaultCorrectionUnit: value as 'MIL' | 'MOA' });
              }}
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Distance Unit</Text>
            <SegmentedControl
              options={[
                { label: 'Yards', value: 'yards' },
                { label: 'Meters', value: 'meters' },
              ]}
              selectedValue={settings.defaultDistanceUnit}
              onValueChange={async (value) => {
                await updateSettings({ defaultDistanceUnit: value as 'yards' | 'meters' });
              }}
            />
          </View>
        </Card>

        {/* Distance Presets */}
        <Card style={styles.card}>
          <View style={styles.presetHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Distance Presets
            </Text>
            <Pressable onPress={handleResetPresets}>
              <Text style={[styles.resetLink, { color: colors.primary }]}>Reset</Text>
            </Pressable>
          </View>
          <Text style={[styles.settingHelp, { color: colors.text.secondary, marginBottom: 12 }]}>
            Quick-select distances shown in calculators and range sessions
          </Text>
          <View style={styles.presetsContainer}>
            {settings.distancePresets.map((preset) => (
              <Pressable
                key={preset}
                style={[
                  styles.presetChip,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onLongPress={() => handleRemovePreset(preset)}
              >
                <Text style={[styles.presetChipText, { color: colors.text.primary }]}>
                  {preset}
                </Text>
                <Pressable
                  onPress={() => handleRemovePreset(preset)}
                  style={styles.presetRemoveButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.presetRemoveText, { color: colors.text.secondary }]}>×</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
          <View style={styles.addPresetRow}>
            <TextInput
              style={[
                styles.presetInput,
                {
                  color: colors.text.primary,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              value={newPresetValue}
              onChangeText={setNewPresetValue}
              placeholder="Add distance..."
              placeholderTextColor={colors.text.secondary}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={handleAddPreset}
            />
            <Button
              title="Add"
              onPress={handleAddPreset}
              variant="secondary"
              size="small"
              disabled={!newPresetValue}
            />
          </View>
        </Card>

        {/* Feedback */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Feedback</Text>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>
                Haptic Feedback
              </Text>
              <Text style={[styles.settingHelp, { color: colors.text.secondary }]}>
                Vibration feedback when recording shots
              </Text>
            </View>
            <Switch
              value={settings.hapticFeedbackEnabled}
              onValueChange={async (value) => {
                await updateSettings({ hapticFeedbackEnabled: value });
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={settings.hapticFeedbackEnabled ? '#ffffff' : '#f4f3f4'}
            />
          </View>
        </Card>

        {/* Range Session Settings */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Range Session</Text>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>
                Keep Screen Awake
              </Text>
              <Text style={[styles.settingHelp, { color: colors.text.secondary }]}>
                Prevent screen from sleeping during active range sessions
              </Text>
            </View>
            <Switch
              value={settings.keepScreenAwakeDuringSession}
              onValueChange={async (value) => {
                await updateSettings({ keepScreenAwakeDuringSession: value });
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={settings.keepScreenAwakeDuringSession ? '#ffffff' : '#f4f3f4'}
            />
          </View>
        </Card>

        {/* Data Management */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Data Management</Text>
          <Button
            title="Export All Data"
            onPress={handleExportData}
            variant="secondary"
            size="medium"
            style={styles.button}
          />
          <Button
            title="Import Data"
            onPress={handleImportData}
            variant="secondary"
            size="medium"
            style={styles.button}
          />
          <Button
            title="Clear All Data"
            onPress={handleClearData}
            variant="danger"
            size="medium"
            style={styles.button}
          />
        </Card>

        {/* About */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>About</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>Version:</Text>
            <Text style={[styles.infoValue, { color: colors.text.primary }]}>1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>Build:</Text>
            <Text style={[styles.infoValue, { color: colors.text.primary }]}>Development</Text>
          </View>
        </Card>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.text.secondary }]}>Mobile DOPE App</Text>
          <Text style={[styles.footerText, { color: colors.text.secondary }]}>
            For precision shooting data management
          </Text>
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
    marginBottom: 16,
  },
  settingRow: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  button: {
    marginBottom: 12,
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
  settingHelp: {
    fontSize: 12,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 15,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  presetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resetLink: {
    fontSize: 14,
    fontWeight: '500',
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  presetRemoveButton: {
    marginLeft: 6,
    padding: 2,
  },
  presetRemoveText: {
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 18,
  },
  addPresetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  presetInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
});
