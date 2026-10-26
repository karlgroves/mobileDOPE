/**
 * Manage Calibers (#67, "add caliber database management").
 *
 * The built-in caliber list is fixed: each entry's diameter was looked up, and
 * the solver trusts it. This screen adds the shooter's own beside it, and lets
 * them rename or delete those. Custom calibers appear in every caliber picker.
 *
 * What happens to profiles is decided in `services/CaliberService.ts`; this
 * screen's job is to say so before it happens. A rename that would carry
 * profiles with it asks first and names how many; a delete is refused while
 * any profile uses the caliber, and says what does.
 */

import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, NumberInput, TextInput } from '../components';
import { CALIBERS, type CustomCaliber } from '../constants/calibers';
import { useTheme } from '../contexts/ThemeContext';
import {
  deleteCustomCaliber,
  getCaliberUsage,
  saveCustomCaliber,
  type CaliberUsage,
} from '../services/CaliberService';
import { useAppStore } from '../store/useAppStore';

import type { RootStackScreenProps } from '../navigation/types';
import type { CustomCaliberValidation } from '../utils/customCalibers';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 rifles and 1 ammo profile", leaving out a kind with none. */
const describeUsage = ({ rifles, ammos }: CaliberUsage): string =>
  [
    rifles > 0 ? plural(rifles, 'rifle', 'rifles') : '',
    ammos > 0 ? plural(ammos, 'ammo profile', 'ammo profiles') : '',
  ]
    .filter(Boolean)
    .join(' and ');

const inUse = ({ rifles, ammos }: CaliberUsage) => rifles + ammos > 0;

export const CaliberManagerScreen: React.FC<RootStackScreenProps<'Calibers'>> = () => {
  const { colors } = useTheme().theme;
  const customCalibers = useAppStore((state) => state.settings.customCalibers);

  // The caliber being edited, or undefined while the form adds a new one.
  const [editing, setEditing] = useState<string>();
  const [name, setName] = useState('');
  const [diameter, setDiameter] = useState<number>();
  const [errors, setErrors] = useState<CustomCaliberValidation['errors']>({});

  const resetForm = () => {
    setEditing(undefined);
    setName('');
    setDiameter(undefined);
    setErrors({});
  };

  const startEditing = (caliber: CustomCaliber) => {
    setEditing(caliber.name);
    setName(caliber.name);
    setDiameter(caliber.diameter);
    setErrors({});
  };

  const save = async () => {
    try {
      const result = await saveCustomCaliber({ name, diameter }, editing);
      if (result.ok) {
        resetForm();
      } else {
        setErrors(result.errors);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not save the caliber');
    }
  };

  const handleSave = async () => {
    const renaming = editing !== undefined && name.trim() !== editing;
    if (!renaming) {
      await save();
      return;
    }
    const usage = await getCaliberUsage(editing);
    if (!inUse(usage)) {
      await save();
      return;
    }
    Alert.alert(
      'Rename Caliber',
      `${describeUsage(usage)} use ${editing}. They will be changed to ${name.trim()}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Rename', onPress: () => save() },
      ]
    );
  };

  const handleDelete = async (caliber: CustomCaliber) => {
    const usage = await getCaliberUsage(caliber.name);
    if (inUse(usage)) {
      Alert.alert(
        'Caliber In Use',
        `${describeUsage(usage)} ${usage.rifles + usage.ammos === 1 ? 'uses' : 'use'} ` +
          `${caliber.name}. Change their caliber first, then delete it.`
      );
      return;
    }
    Alert.alert('Delete Caliber', `Delete ${caliber.name}? No profile uses it.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCustomCaliber(caliber.name);
          if (editing === caliber.name) resetForm();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.intro, { color: colors.text.secondary }]}>
        Add calibers that are not in the list. They appear in every caliber picker. The{' '}
        {CALIBERS.length} built-in calibers cannot be changed or deleted.
      </Text>

      <Card style={styles.card}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          {editing === undefined ? 'Add a Caliber' : `Edit ${editing}`}
        </Text>
        <TextInput
          label="Name"
          accessibilityLabel="Caliber name"
          // TextInput spreads this over its own error hint, so carry the error.
          accessibilityHint={errors.name ?? 'As it should appear in the caliber pickers'}
          value={name}
          onChangeText={setName}
          placeholder="e.g., 6.5 PRC"
          error={errors.name}
          autoCapitalize="none"
        />
        <NumberInput
          label="Bullet Diameter"
          accessibilityLabel="Bullet diameter, inches"
          accessibilityHint={
            errors.diameter ??
            "The bullet's diameter in inches, for example 0.264 for 6.5 millimetre"
          }
          value={diameter}
          onChangeValue={setDiameter}
          precision={4}
          unit="inches"
          error={errors.diameter}
          helperText="The bullet's diameter, not the number in the name: 0.264 for 6.5 mm. Used for spin drift."
        />
        <Button
          title={editing === undefined ? 'Add Caliber' : 'Save Changes'}
          onPress={() => void handleSave()}
          size="medium"
          style={styles.button}
        />
        {editing !== undefined && (
          <Button
            title="Cancel"
            onPress={resetForm}
            variant="secondary"
            size="medium"
            style={styles.button}
          />
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Your Calibers</Text>
        {customCalibers.length === 0 ? (
          <Text style={[styles.empty, { color: colors.text.secondary }]}>
            No custom calibers yet
          </Text>
        ) : (
          customCalibers.map((caliber) => (
            <View key={caliber.name} style={[styles.row, { borderColor: colors.border }]}>
              <View style={styles.rowText}>
                <Text style={[styles.rowName, { color: colors.text.primary }]}>{caliber.name}</Text>
                <Text style={[styles.rowDetail, { color: colors.text.secondary }]}>
                  {`${caliber.diameter.toFixed(3)} in`}
                </Text>
              </View>
              <Button
                title="Edit"
                onPress={() => startEditing(caliber)}
                variant="secondary"
                size="small"
                accessibilityLabel={`Edit ${caliber.name}`}
                accessibilityHint="Loads this caliber into the form above to rename it or change its diameter"
              />
              <Button
                title="Delete"
                onPress={() => void handleDelete(caliber)}
                variant="danger"
                size="small"
                style={styles.deleteButton}
                accessibilityLabel={`Delete ${caliber.name}`}
                accessibilityHint="Deletes this caliber if no rifle or ammo profile uses it"
              />
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  button: {
    marginTop: 12,
  },
  empty: {
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    marginRight: 8,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '500',
  },
  rowDetail: {
    fontSize: 13,
    marginTop: 2,
  },
  deleteButton: {
    marginLeft: 8,
  },
});
