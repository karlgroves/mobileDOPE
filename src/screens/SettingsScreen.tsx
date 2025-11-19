/**
 * Settings Screen
 * User preferences and app configuration
 */

import React from 'react';
import { View, ScrollView, Text, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Card, Button, SegmentedControl } from '../components';
import type { RootStackScreenProps } from '../navigation/types';

type Props = RootStackScreenProps<'Settings'>;

export const SettingsScreen: React.FC<Props> = () => {
  const { theme, currentTheme, setTheme } = useTheme();
  const { colors } = theme;

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
    Alert.alert('Not Implemented', 'Data export functionality coming soon.');
  };

  const handleImportData = () => {
    Alert.alert('Not Implemented', 'Data import functionality coming soon.');
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
