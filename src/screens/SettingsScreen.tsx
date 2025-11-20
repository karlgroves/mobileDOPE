/**
 * Settings Screen
 * User preferences and app configuration
 */

import React, { useState } from 'react';
import { View, ScrollView, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Card, Button, SegmentedControl } from '../components';
import type { RootStackScreenProps } from '../navigation/types';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import { useDOPELogStore } from '../store/useDOPELogStore';
import {
  exportFullBackup,
  exportAllRifleProfilesJSON,
  exportDOPELogsCSV,
  exportDOPELogsJSON,
} from '../services/ExportService';

type Props = RootStackScreenProps<'Settings'>;

export const SettingsScreen: React.FC<Props> = () => {
  const { theme, currentTheme, setTheme } = useTheme();
  const { colors } = theme;
  const [exporting, setExporting] = useState(false);

  const { rifles } = useRifleStore();
  const { ammoProfiles } = useAmmoStore();
  const { dopeLogs } = useDOPELogStore();

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
            setExporting(true);
            const result = await exportFullBackup(rifles, ammoProfiles, dopeLogs);
            setExporting(false);
            if (result.success) {
              Alert.alert('Success', `Exported ${rifles.length} rifles, ${ammoProfiles.length} ammo profiles, and ${dopeLogs.length} DOPE logs.`);
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
            setExporting(true);
            const result = await exportAllRifleProfilesJSON(rifles);
            setExporting(false);
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
            setExporting(true);
            const result = await exportDOPELogsCSV(dopeLogs, rifles, ammoProfiles);
            setExporting(false);
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
            setExporting(true);
            const result = await exportDOPELogsJSON(dopeLogs);
            setExporting(false);
            if (result.success) {
              Alert.alert('Success', `Exported ${dopeLogs.length} DOPE logs.`);
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
    Alert.alert('Not Implemented', 'Data import functionality coming in Phase 2.');
  };

  const themeOptions = [
    { label: 'Dark', value: 'dark' },
    { label: 'Light', value: 'light' },
    { label: 'Night Vision', value: 'night' },
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
              selectedValue={currentTheme}
              onValueChange={(value) => setTheme(value as 'dark' | 'light' | 'night')}
            />
          </View>
        </Card>

        {/* Default Units */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Default Units
          </Text>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text.primary }]}>
              Angular Unit
            </Text>
            <SegmentedControl
              options={[
                { label: 'MIL', value: 'MIL' },
                { label: 'MOA', value: 'MOA' },
              ]}
              selectedValue="MIL"
              onValueChange={() => {
                Alert.alert('Not Implemented', 'Unit preferences coming soon.');
              }}
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text.primary }]}>
              Distance Unit
            </Text>
            <SegmentedControl
              options={[
                { label: 'Yards', value: 'yards' },
                { label: 'Meters', value: 'meters' },
              ]}
              selectedValue="yards"
              onValueChange={() => {
                Alert.alert('Not Implemented', 'Unit preferences coming soon.');
              }}
            />
          </View>
        </Card>

        {/* Data Management */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Data Management
          </Text>
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
            <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>
              Build:
            </Text>
            <Text style={[styles.infoValue, { color: colors.text.primary }]}>
              Development
            </Text>
          </View>
        </Card>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.text.secondary }]}>
            Mobile DOPE App
          </Text>
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
});
