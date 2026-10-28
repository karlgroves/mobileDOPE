/**
 * Settings Screen
 * User preferences and app configuration
 */

import React, { useEffect, useState } from 'react';
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

import { Card, Button, SegmentedControl } from '../components';
import { NumberInput } from '../components/NumberInput';
import { NumberPicker } from '../components/NumberPicker';
import { useTheme } from '../contexts/ThemeContext';
import { environmentRepository } from '../services/database/EnvironmentRepository';
import { isBarometerAvailable } from '../services/deviceBarometer';
import {
  exportFullBackup,
  exportAllRifleProfilesJSON,
  exportDOPELogsCSV,
  exportDOPELogsJSON,
  exportDOPELogsPDF,
  deleteAutomaticBackups,
  shareLatestAutomaticBackup,
} from '../services/ExportService';
import { importFullBackup, importRifleProfiles, importDOPELogs } from '../services/ImportService';
import { useAmmoStore } from '../store/useAmmoStore';
import { useAppStore, DEFAULT_DISTANCE_PRESETS, DEFAULT_SETTINGS } from '../store/useAppStore';
import { useDOPEStore } from '../store/useDOPEStore';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { useRifleStore } from '../store/useRifleStore';
import { AUTOMATIC_BACKUPS_KEPT, type BackupSchedule } from '../utils/backupSchedule';
import { MAX_BAROMETER_OFFSET_INHG, isValidBarometerOffset } from '../utils/barometer';
import {
  MAX_CONFIDENCE_THRESHOLD,
  MAX_DISTANCE_DELTA_YARDS,
  MIN_CONFIDENCE_THRESHOLD,
  MIN_DISTANCE_DELTA_YARDS,
  percentToThreshold,
  thresholdPercent,
} from '../utils/dopeSettings';
import { formatDateTime } from '../utils/formatting';
import { MergeStrategy } from '../utils/importMerge';

import type { RootStackScreenProps } from '../navigation/types';

type Props = RootStackScreenProps<'Settings'>;

/** Message shown when an export returns no error of its own. */
const EXPORT_FAILED = 'Export failed';

export const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { theme, setThemeMode } = useTheme();
  const { settings, updateSettings } = useAppStore();
  const { colors } = theme;

  const { rifles } = useRifleStore();
  const { ammoProfiles } = useAmmoStore();
  const { dopeLogs } = useDOPEStore();
  const { loadSnapshots } = useEnvironmentStore();

  // Distance preset customization state
  const [newPresetValue, setNewPresetValue] = useState<string>('');

  // Barometer calibration (#62). Shown only where the device has a barometer,
  // the same condition under which the Environment screen offers to read it.
  const [barometerAvailable, setBarometerAvailable] = useState(false);
  const [barometerOffset, setBarometerOffset] = useState<number | undefined>(
    settings.barometerOffsetInHg
  );

  useEffect(() => {
    let mounted = true;
    void isBarometerAvailable().then((available) => {
      if (mounted) setBarometerAvailable(available);
    });
    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Keep what the user is typing, but persist only a usable offset. An offset
   * past the limit stays in the field, where NumberInput shows the limit, and
   * never reaches the readings. An emptied field -- or a half-typed "-", which
   * parses as empty -- means no offset and saves 0, so a blank field never hides
   * an old offset that is still being applied.
   */
  const handleBarometerOffsetChange = async (value: number | undefined) => {
    setBarometerOffset(value);
    const offset = value ?? 0;
    if (isValidBarometerOffset(offset)) {
      await updateSettings({ barometerOffsetInHg: offset });
    }
  };

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

  /**
   * Puts the three DOPE-assisted settings back where they started (#167 and
   * #70 §10's "reset to defaults").
   *
   * Scoped to this section rather than reusing `resetSettings`, which clears
   * the theme, the units, the custom calibers and the barometer calibration
   * too. A shooter who wants their matching window back has not asked to lose
   * a measured sensor offset.
   */
  const handleResetDopeSettings = () => {
    Alert.alert(
      'Reset DOPE-Assisted Aiming',
      `Put the matching window back to ${DEFAULT_SETTINGS.dopeDistanceDeltaYards} yards, ` +
        `the confidence threshold to ${thresholdPercent(DEFAULT_SETTINGS.dopeConfidenceThreshold)}%, ` +
        'and the adjustment back on? Nothing else changes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            await updateSettings({
              dopeAdjustmentEnabled: DEFAULT_SETTINGS.dopeAdjustmentEnabled,
              dopeDistanceDeltaYards: DEFAULT_SETTINGS.dopeDistanceDeltaYards,
              dopeConfidenceThreshold: DEFAULT_SETTINGS.dopeConfidenceThreshold,
            });
          },
        },
      ]
    );
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

  /**
   * Write a full backup, asking first whether to include stored coordinates.
   *
   * A backup is the only route by which data leaves the device, and it carries the
   * approximate latitude of every place the user has shot. The choice is offered at
   * the point of sharing rather than buried in settings, because that is the moment
   * it matters. See issue #44.
   */
  const runFullBackup = async () => {
    // Load every snapshot, not just the recent ones already in the store: a DOPE log
    // whose environment is missing from the backup cannot be restored (issue #39).
    await loadSnapshots();
    const allEnvironments = useEnvironmentStore.getState().snapshots;
    const withCoordinates = allEnvironments.filter((s) => s.latitude !== undefined).length;

    const write = async (includeCoordinates: boolean) => {
      const result = await exportFullBackup(rifles, ammoProfiles, dopeLogs, allEnvironments, {
        includeCoordinates,
      });
      if (result.success) {
        Alert.alert(
          'Success',
          `Exported ${rifles.length} rifles, ${ammoProfiles.length} ammo profiles, ` +
            `${allEnvironments.length} environment snapshots, and ${dopeLogs.length} DOPE logs.` +
            (includeCoordinates ? '' : '\n\nLocation data was left out.')
        );
      } else {
        Alert.alert('Error', result.error || EXPORT_FAILED);
      }
    };

    if (withCoordinates === 0) {
      await write(true);
      return;
    }

    Alert.alert(
      'This backup contains location data',
      `${withCoordinates} of your ${allEnvironments.length} environment snapshots include ` +
        'an approximate latitude (rounded to about 11 km) for where the reading was taken. ' +
        'Anyone you share this file with can read it.\n\n' +
        'A backup without it still restores completely.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave Location Out', onPress: () => void write(false) },
        { text: 'Include Location', onPress: () => void write(true) },
      ]
    );
  };

  /**
   * Remove the stored latitude from every environment snapshot, keeping the
   * ballistic readings. Backs the retention commitment in the privacy policy.
   */
  const handleDeleteLocationData = () => {
    Alert.alert(
      'Delete Stored Location Data',
      'This removes the approximate latitude from every environment snapshot. ' +
        'Temperature, pressure, wind and altitude readings are kept, and no DOPE logs ' +
        'are affected.\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const cleared = await environmentRepository.clearStoredCoordinates();
              await loadSnapshots();
              Alert.alert(
                'Location Data Deleted',
                cleared === 0
                  ? 'No stored coordinates were found.'
                  : `Cleared coordinates from ${cleared} snapshot${cleared === 1 ? '' : 's'}.`
              );
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to delete location data'
              );
            }
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
          onPress: () => {
            void runFullBackup();
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
              Alert.alert('Error', result.error || EXPORT_FAILED);
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
            // Every snapshot, for each log's conditions (#138).
            let environments;
            try {
              environments = await environmentRepository.getAll();
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : EXPORT_FAILED);
              return;
            }
            const result = await exportDOPELogsCSV(dopeLogs, rifles, ammoProfiles, environments);
            if (result.success) {
              Alert.alert('Success', `Exported ${dopeLogs.length} DOPE logs.`);
            } else {
              Alert.alert('Error', result.error || EXPORT_FAILED);
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
              Alert.alert('Error', result.error || EXPORT_FAILED);
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
              Alert.alert('Error', result.error || EXPORT_FAILED);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  /**
   * A full backup restored onto a device that has been in use since has to say
   * what happens to records it already holds (#66). Asked as its own step rather
   * than guessed at, because the two answers are not recoverable from each
   * other: keeping yours can leave the file's edits behind, and letting the file
   * win overwrites work done since the backup.
   */
  const chooseBackupMergeStrategy = () => {
    Alert.alert(
      'Restore Full Backup',
      'Some records in this backup may already be on this device. What should happen to those?',
      [
        {
          text: 'Keep mine',
          onPress: () => runFullBackupImport('skip-existing'),
        },
        {
          text: "Use the backup's",
          onPress: () => runFullBackupImport('replace-existing'),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const runFullBackupImport = async (strategy: MergeStrategy) => {
    const result = await importFullBackup(strategy);

    if (!result.success || !result.imported) {
      Alert.alert('Error', result.error || 'Import failed');
      return;
    }

    const { imported, replaced, skipped, warnings } = result;
    const lines = [
      `• ${imported.rifles || 0} rifle profiles`,
      `• ${imported.ammos || 0} ammo profiles`,
      `• ${imported.logs || 0} DOPE logs`,
    ];

    const replacedTotal =
      (replaced?.rifles || 0) +
      (replaced?.ammos || 0) +
      (replaced?.environments || 0) +
      (replaced?.logs || 0);
    if (replacedTotal > 0) {
      lines.push(`\n${replacedTotal} existing record(s) were replaced.`);
    }

    // Reported rather than silent: "0 imported" on a backup full of data looks
    // like a failure unless it says the records were already here.
    const skippedTotal =
      (skipped?.rifles || 0) +
      (skipped?.ammos || 0) +
      (skipped?.environments || 0) +
      (skipped?.logs || 0);
    if (skippedTotal > 0) {
      lines.push(`\n${skippedTotal} record(s) were already on this device.`);
    }

    if (warnings && warnings.length > 0) {
      lines.push(`\n${warnings.join('\n')}`);
    }

    Alert.alert('Import Complete', `Imported:\n${lines.join('\n')}`);
  };

  const handleImportData = () => {
    Alert.alert(
      'Import Data',
      'Choose what to import:',
      [
        {
          text: 'Full Backup',
          onPress: chooseBackupMergeStrategy,
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

  /**
   * Share the newest automatic backup (#66). It goes through the same share
   * sheet as a manual export; it holds no latitude, so there is no location
   * question to ask first.
   */
  const handleShareAutomaticBackup = async () => {
    const result = await shareLatestAutomaticBackup();
    if (!result.success) {
      Alert.alert('Error', result.error || EXPORT_FAILED);
    }
  };

  /**
   * Delete the automatic backups saved on this device (#66). Choosing Manual
   * stops new ones but keeps old ones, so without this the only way to remove
   * them would be to uninstall the app. Manual exports are not touched.
   */
  const handleDeleteAutomaticBackups = () => {
    Alert.alert(
      'Delete Automatic Backups',
      'This deletes every automatic backup saved on this device. Your profiles, ' +
        'readings and DOPE logs are not affected, and backups you exported yourself ' +
        'are kept.' +
        // The schedule is left as it is, and with no last-run time a backup is
        // due at once: say so rather than let a new file appear unexplained.
        (settings.backupSchedule === 'manual'
          ? ''
          : '\n\nYour schedule stays on, so a new backup is saved the next time the app ' +
            'opens. Choose Manual first to stop them.') +
        '\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const deleted = deleteAutomaticBackups();
              await updateSettings({ lastAutomaticBackupAt: undefined });
              Alert.alert(
                'Automatic Backups Deleted',
                deleted === 0
                  ? 'No automatic backups were found.'
                  : `Deleted ${deleted} automatic backup${deleted === 1 ? '' : 's'}.`
              );
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to delete automatic backups'
              );
            }
          },
        },
      ]
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
            <Pressable accessibilityRole="button" onPress={handleResetPresets}>
              <Text style={[styles.resetLink, { color: colors.primaryText }]}>Reset</Text>
            </Pressable>
          </View>
          <Text style={[styles.settingHelp, { color: colors.text.secondary, marginBottom: 12 }]}>
            Quick-select distances shown in calculators and range sessions
          </Text>
          <View style={styles.presetsContainer}>
            {settings.distancePresets.map((preset) => (
              <Pressable
                accessibilityRole="button"
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
                  accessibilityRole="button"
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
              accessibilityLabel="New distance preset, yards"
              accessibilityHint="Enter a distance, then activate Add to save it as a preset"
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

        {/* Calibers (#67) */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Calibers</Text>
          <Text style={[styles.settingHelp, { color: colors.text.secondary, marginBottom: 12 }]}>
            {settings.customCalibers.length === 0
              ? 'Add calibers that are not in the built-in list'
              : `${settings.customCalibers.length} custom caliber${
                  settings.customCalibers.length === 1 ? '' : 's'
                } alongside the built-in list`}
          </Text>
          <Button
            title="Manage Calibers"
            onPress={() => navigation.navigate('Calibers')}
            variant="secondary"
            size="medium"
            style={styles.button}
          />
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

        {/* Advanced Ballistics */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Advanced Ballistics
          </Text>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>
                Apply Spin Drift and Coriolis
              </Text>
              <Text style={[styles.settingHelp, { color: colors.text.secondary }]}>
                Folds both corrections into the dialled solution. Small inside a few hundred yards.
                Off by default so a DOPE card built against the plain solution does not shift
                underneath you; the calculator shows both figures either way. Coriolis needs a
                latitude on the shot.
              </Text>
            </View>
            <Switch
              value={settings.advancedBallisticsEnabled}
              onValueChange={async (value) => {
                await updateSettings({ advancedBallisticsEnabled: value });
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={settings.advancedBallisticsEnabled ? '#ffffff' : '#f4f3f4'}
              accessibilityLabel="Apply spin drift and Coriolis corrections"
              accessibilityHint="Includes spin drift and Coriolis in the elevation and windage the calculator tells you to dial"
            />
          </View>
        </Card>

        {/* DOPE-assisted aiming (#167). Every control says what it changes, not
            what it is called: a "distance delta" means nothing to a shooter,
            and the number it governs is which of their logs get a say. */}
        <Card style={styles.card}>
          <View style={styles.presetHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              DOPE-Assisted Aiming
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset DOPE-assisted aiming settings"
              accessibilityHint="Puts the matching window, confidence threshold and adjustment default back to their shipped values"
              onPress={handleResetDopeSettings}
            >
              <Text style={[styles.resetLink, { color: colors.primaryText }]}>Reset</Text>
            </Pressable>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>
                Adjust by My DOPE
              </Text>
              <Text style={[styles.settingHelp, { color: colors.text.secondary }]}>
                Where the calculator&apos;s switch starts. On, it corrects the solver&apos;s
                elevation by what your own logs say it gets wrong in conditions like today&apos;s.
                Off, you get the solver alone until you turn it on for a shot. The solver&apos;s own
                figure is on screen either way.
              </Text>
            </View>
            <Switch
              value={settings.dopeAdjustmentEnabled}
              onValueChange={async (value) => {
                await updateSettings({ dopeAdjustmentEnabled: value });
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={settings.dopeAdjustmentEnabled ? '#ffffff' : '#f4f3f4'}
              accessibilityLabel="Adjust by my DOPE"
              accessibilityHint="Sets whether the calculator starts with the DOPE adjustment on"
              testID="dope-adjustment-default"
            />
          </View>

          <View style={styles.settingRow}>
            <NumberPicker
              label="Matching Window"
              value={settings.dopeDistanceDeltaYards}
              onValueChange={async (value) => {
                await updateSettings({ dopeDistanceDeltaYards: value });
              }}
              min={MIN_DISTANCE_DELTA_YARDS}
              max={MAX_DISTANCE_DELTA_YARDS}
              step={5}
              unit="yards"
              presets={[25, 50, 75, 100]}
              helperText={
                'How far from the shot a log can have been fired and still count. At 50 ' +
                'yards, a shot at 600 is informed by logs from 550 to 650. Wider finds ' +
                'more logs and leans on each one less, because a log at the edge of the ' +
                'window already counts for much less than one at the exact distance.'
              }
            />
          </View>

          <View style={styles.settingRow}>
            <NumberPicker
              label="Confidence Threshold"
              value={thresholdPercent(settings.dopeConfidenceThreshold)}
              onValueChange={async (value) => {
                await updateSettings({ dopeConfidenceThreshold: percentToThreshold(value) });
              }}
              min={thresholdPercent(MIN_CONFIDENCE_THRESHOLD)}
              max={thresholdPercent(MAX_CONFIDENCE_THRESHOLD)}
              step={5}
              unit="%"
              presets={[20, 40, 60, 80]}
              helperText={
                'How much the app has to believe its own recommendation before it uses ' +
                'it. Below this it shows the solver alone and says why. Raise it to be ' +
                'told less often and trust it more when you are; lower it to use thinner ' +
                'evidence. At 0 any single log moves the figure.'
              }
            />
          </View>
        </Card>

        {/* Barometer calibration (#62) */}
        {barometerAvailable && (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Barometer</Text>
            <NumberInput
              label="Barometer Offset"
              helperText={
                "Added to every reading from this phone's barometer. Compare the phone " +
                'with a trusted station-pressure source, such as a Kestrel, and enter the ' +
                'difference: if the phone reads 0.03 low, enter 0.03; if it reads high, ' +
                'enter -0.03. Leave at 0 if you have nothing to compare against. A pressure ' +
                'typed by hand is never changed.'
              }
              value={barometerOffset}
              onChangeValue={handleBarometerOffsetChange}
              min={-MAX_BAROMETER_OFFSET_INHG}
              max={MAX_BAROMETER_OFFSET_INHG}
              precision={2}
              unit="inHg"
              // The iOS decimal pad has no minus key, so the step buttons are how a
              // negative offset is entered there.
              showButtons
              step={0.01}
            />
          </Card>
        )}

        {/* Privacy */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Privacy</Text>
          <Text style={[styles.privacyBlurb, { color: colors.text.secondary }]}>
            This app has no network connection. Location is used only for altitude and an
            approximate latitude, rounded to about 11 km before it is saved.
          </Text>
          <Button
            title="Privacy Policy"
            onPress={() => navigation.navigate('PrivacyPolicy')}
            variant="secondary"
            size="medium"
            style={styles.button}
          />
          <Button
            title="Delete Stored Location Data"
            onPress={handleDeleteLocationData}
            variant="danger"
            size="medium"
            style={styles.button}
          />
        </Card>

        {/* Automatic Backup (#66) */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Automatic Backup
          </Text>
          <Text style={[styles.privacyBlurb, { color: colors.text.secondary }]}>
            A full backup is saved on this device when the app opens or comes back to the
            foreground, if one is due. The newest {AUTOMATIC_BACKUPS_KEPT} are kept. Location is
            never included, and nothing leaves the device unless you share it.
          </Text>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Schedule</Text>
            <SegmentedControl
              options={[
                { label: 'Manual', value: 'manual' },
                { label: 'Daily', value: 'daily' },
                { label: 'Weekly', value: 'weekly' },
              ]}
              selectedValue={settings.backupSchedule}
              onValueChange={async (value) => {
                await updateSettings({ backupSchedule: value as BackupSchedule });
              }}
            />
          </View>
          <Text style={[styles.settingHelp, styles.lastBackup, { color: colors.text.secondary }]}>
            {settings.lastAutomaticBackupAt
              ? `Last automatic backup: ${formatDateTime(new Date(settings.lastAutomaticBackupAt))}`
              : 'No automatic backup yet'}
          </Text>
          <Button
            title="Share Latest Backup"
            onPress={() => void handleShareAutomaticBackup()}
            variant="secondary"
            size="medium"
            style={styles.button}
            disabled={!settings.lastAutomaticBackupAt}
            accessibilityLabel="Share latest automatic backup"
            accessibilityHint="Opens the share sheet with the newest backup saved on this device"
          />
          <Button
            title="Delete Automatic Backups"
            onPress={handleDeleteAutomaticBackups}
            variant="danger"
            size="medium"
            style={styles.button}
            // Not gated on lastAutomaticBackupAt: files can outlive that setting
            // (a settings reset), and the confirmation reports when there are none.
            accessibilityHint="Asks for confirmation, then deletes the backups saved on this device"
          />
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
  lastBackup: {
    fontSize: 14,
    marginBottom: 12,
  },
  privacyBlurb: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
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
