import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';

import { TextInput, NumberInput, Picker, Button } from '../components';
import { CALIBER_OPTIONS } from '../constants/calibers';
import { useTheme } from '../contexts/ThemeContext';
import { RifleProfileData } from '../models/RifleProfile';
import { useRifleStore } from '../store/useRifleStore';

type RootStackParamList = {
  RifleProfileForm: { rifleId?: number };
  RifleProfileList: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RifleProfileForm'>;
type RoutePropType = RouteProp<RootStackParamList, 'RifleProfileForm'>;

export const RifleProfileForm: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { theme } = useTheme();
  const { colors } = theme;

  const { rifles, createRifle, updateRifle } = useRifleStore();

  const rifleId = route.params?.rifleId;
  const isEditing = rifleId !== undefined;
  const existingRifle = isEditing ? rifles.find((r) => r.id === rifleId) : undefined;

  // Form state
  const [name, setName] = useState(existingRifle?.name || '');
  const [caliber, setCaliber] = useState(existingRifle?.caliber || '');
  const [barrelLength, setBarrelLength] = useState<number | undefined>(existingRifle?.barrelLength);
  const [twistRate, setTwistRate] = useState(existingRifle?.twistRate || '');
  const [zeroDistance, setZeroDistance] = useState<number | undefined>(existingRifle?.zeroDistance);
  const [opticManufacturer, setOpticManufacturer] = useState(
    existingRifle?.opticManufacturer || ''
  );
  const [opticModel, setOpticModel] = useState(existingRifle?.opticModel || '');
  const [reticleType, setReticleType] = useState(existingRifle?.reticleType || '');
  const [clickValueType, setClickValueType] = useState<'MIL' | 'MOA'>(
    existingRifle?.clickValueType || 'MIL'
  );
  const [clickValue, setClickValue] = useState<number | undefined>(existingRifle?.clickValue);
  const [scopeHeight, setScopeHeight] = useState<number | undefined>(existingRifle?.scopeHeight);
  const [notes, setNotes] = useState(existingRifle?.notes || '');

  // Validation errors
  const [errors, setErrors] = useState<Partial<Record<keyof RifleProfileData, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof RifleProfileData, string>> = {};

    if (!name.trim()) {
      newErrors.name = 'Rifle name is required';
    }

    if (!caliber.trim()) {
      newErrors.caliber = 'Caliber is required';
    }

    if (!barrelLength || barrelLength <= 0 || barrelLength > 50) {
      newErrors.barrelLength = 'Barrel length must be between 0 and 50 inches';
    }

    if (!twistRate || !twistRate.match(/^1:\d+$/)) {
      newErrors.twistRate = 'Twist rate must be in format "1:X" (e.g., 1:10)';
    }

    if (!zeroDistance || zeroDistance <= 0 || zeroDistance > 1000) {
      newErrors.zeroDistance = 'Zero distance must be between 0 and 1000 yards';
    }

    if (!opticManufacturer.trim()) {
      newErrors.opticManufacturer = 'Optic manufacturer is required';
    }

    if (!opticModel.trim()) {
      newErrors.opticModel = 'Optic model is required';
    }

    if (!reticleType.trim()) {
      newErrors.reticleType = 'Reticle type is required';
    }

    if (!clickValue || clickValue <= 0 || clickValue > 1) {
      newErrors.clickValue = 'Click value must be between 0 and 1';
    }

    if (!scopeHeight || scopeHeight <= 0 || scopeHeight > 10) {
      newErrors.scopeHeight = 'Scope height must be between 0 and 10 inches';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      Alert.alert('Validation Error', 'Please fix the errors before saving.');
      return;
    }

    const rifleData: RifleProfileData = {
      name,
      caliber,
      barrelLength: barrelLength!,
      twistRate,
      zeroDistance: zeroDistance!,
      opticManufacturer,
      opticModel,
      reticleType,
      clickValueType,
      clickValue: clickValue!,
      scopeHeight: scopeHeight!,
      notes: notes.trim() || undefined,
    };

    try {
      if (isEditing && rifleId) {
        await updateRifle(rifleId, rifleData);
        Alert.alert('Success', 'Rifle profile updated successfully');
      } else {
        await createRifle(rifleData);
        Alert.alert('Success', 'Rifle profile created successfully');
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save rifle profile');
    }
  };

  const clickValueTypeOptions = [
    { label: 'MIL', value: 'MIL' },
    { label: 'MOA', value: 'MOA' },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <TextInput
        label="Rifle Name"
        accessibilityLabel="Rifle name"
        accessibilityHint="The name this rifle appears under in lists and DOPE cards"
        value={name}
        onChangeText={setName}
        placeholder="e.g., Remington 700"
        required
        error={errors.name}
        autoCapitalize="words"
      />

      <Picker
        label="Caliber"
        value={caliber}
        onValueChange={setCaliber}
        options={CALIBER_OPTIONS}
        placeholder="Select caliber"
        required
        error={errors.caliber}
        helperText="Common calibers: .308, 6.5 Creedmoor, .223"
      />

      <NumberInput
        label="Barrel Length"
        value={barrelLength}
        onChangeValue={setBarrelLength}
        min={1}
        max={50}
        precision={1}
        unit="inches"
        required
        error={errors.barrelLength}
        placeholder="Enter barrel length"
      />

      <TextInput
        label="Twist Rate"
        accessibilityLabel="Barrel twist rate, inches per turn"
        accessibilityHint="For example, 1 in 8. Used for spin drift and stability"
        value={twistRate}
        onChangeText={setTwistRate}
        placeholder="e.g., 1:10"
        required
        error={errors.twistRate}
        helperText="Format: 1:X (e.g., 1:10 for 1 turn in 10 inches)"
      />

      <NumberInput
        label="Zero Distance"
        value={zeroDistance}
        onChangeValue={setZeroDistance}
        min={25}
        max={1000}
        step={25}
        precision={0}
        unit="yards"
        required
        error={errors.zeroDistance}
        placeholder="Enter zero distance"
      />

      <TextInput
        label="Optic Manufacturer"
        accessibilityLabel="Optic manufacturer"
        accessibilityHint="For example, Vortex, Nightforce or Leupold"
        value={opticManufacturer}
        onChangeText={setOpticManufacturer}
        placeholder="e.g., Vortex, Leupold"
        required
        error={errors.opticManufacturer}
        autoCapitalize="words"
      />

      <TextInput
        label="Optic Model"
        accessibilityLabel="Optic model"
        accessibilityHint="For example, Razor H D Gen 3"
        value={opticModel}
        onChangeText={setOpticModel}
        placeholder="e.g., Razor HD Gen II"
        required
        error={errors.opticModel}
        autoCapitalize="words"
      />

      <TextInput
        label="Reticle Type"
        accessibilityLabel="Reticle type"
        accessibilityHint="For example, E B R 7C or Tremor 3"
        value={reticleType}
        onChangeText={setReticleType}
        placeholder="e.g., EBR-2C, Horus H59"
        required
        error={errors.reticleType}
      />

      <Picker
        label="Click Value Type"
        value={clickValueType}
        onValueChange={(value) => setClickValueType(value as 'MIL' | 'MOA')}
        options={clickValueTypeOptions}
        required
      />

      <NumberInput
        label="Click Value"
        value={clickValue}
        onChangeValue={setClickValue}
        min={0.001}
        max={1}
        step={0.001}
        precision={3}
        unit={clickValueType}
        required
        error={errors.clickValue}
        placeholder="Enter click value"
        helperText="Typical: 0.1 MIL or 0.25 MOA per click"
      />

      <NumberInput
        label="Scope Height"
        value={scopeHeight}
        onChangeValue={setScopeHeight}
        min={0.5}
        max={10}
        step={0.1}
        precision={2}
        unit="inches"
        required
        error={errors.scopeHeight}
        placeholder="Enter scope height"
        helperText="Height from center of bore to center of scope"
      />

      <TextInput
        label="Notes"
        accessibilityLabel="Notes about this rifle"
        accessibilityHint="Optional free text, for example zero history or maintenance"
        value={notes}
        onChangeText={setNotes}
        placeholder="Additional notes (optional)"
        multiline
        numberOfLines={4}
      />

      <View style={styles.buttonContainer}>
        <Button
          title="Cancel"
          onPress={() => navigation.goBack()}
          variant="secondary"
          style={styles.button}
        />
        <Button
          title={isEditing ? 'Update' : 'Create'}
          onPress={handleSave}
          variant="primary"
          style={styles.button}
        />
      </View>
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  button: {
    flex: 1,
  },
});
