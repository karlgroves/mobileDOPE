import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProfilesStackParamList } from '../navigation/types';
import { useAmmoStore } from '../store/useAmmoStore';
import { AmmoProfileData } from '../models/AmmoProfile';
import { TextInput, NumberInput, Button } from '../components';
import { useTheme } from '../contexts/ThemeContext';

type AmmoProfileFormNavigationProp = NativeStackNavigationProp<
  ProfilesStackParamList,
  'AmmoProfileForm'
>;
type AmmoProfileFormRouteProp = RouteProp<ProfilesStackParamList, 'AmmoProfileForm'>;

export const AmmoProfileForm: React.FC = () => {
  const navigation = useNavigation<AmmoProfileFormNavigationProp>();
  const route = useRoute<AmmoProfileFormRouteProp>();
  const { theme } = useTheme();
  const { colors } = theme;

  const { ammoProfiles, createAmmoProfile, updateAmmoProfile } = useAmmoStore();
  const { ammoId } = route.params || {};
  const isEditing = ammoId !== undefined;

  const existingAmmo = isEditing ? ammoProfiles.find((a) => a.id === ammoId) : undefined;

  // Form state
  const [name, setName] = useState(existingAmmo?.name || '');
  const [manufacturer, setManufacturer] = useState(existingAmmo?.manufacturer || '');
  const [caliber, setCaliber] = useState(existingAmmo?.caliber || '');
  const [bulletWeight, setBulletWeight] = useState<number | undefined>(existingAmmo?.bulletWeight);
  const [bulletType, setBulletType] = useState(existingAmmo?.bulletType || '');
  const [bcG1, setBcG1] = useState<number | undefined>(existingAmmo?.ballisticCoefficientG1);
  const [bcG7, setBcG7] = useState<number | undefined>(existingAmmo?.ballisticCoefficientG7);
  const [muzzleVelocity, setMuzzleVelocity] = useState<number | undefined>(
    existingAmmo?.muzzleVelocity
  );
  const [powderType, setPowderType] = useState(existingAmmo?.powderType || '');
  const [powderWeight, setPowderWeight] = useState<number | undefined>(existingAmmo?.powderWeight);
  const [lotNumber, setLotNumber] = useState(existingAmmo?.lotNumber || '');
  const [notes, setNotes] = useState(existingAmmo?.notes || '');

  const [errors, setErrors] = useState<Partial<Record<keyof AmmoProfileData, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof AmmoProfileData, string>> = {};

    if (!name.trim()) newErrors.name = 'Ammo name is required';
    if (!manufacturer.trim()) newErrors.manufacturer = 'Manufacturer is required';
    if (!caliber.trim()) newErrors.caliber = 'Caliber is required';
    if (!bulletWeight) newErrors.bulletWeight = 'Bullet weight is required';
    if (!bulletType.trim()) newErrors.bulletType = 'Bullet type is required';
    if (bcG1 === undefined) newErrors.ballisticCoefficientG1 = 'G1 BC is required';
    if (bcG7 === undefined) newErrors.ballisticCoefficientG7 = 'G7 BC is required';
    if (!muzzleVelocity) newErrors.muzzleVelocity = 'Muzzle velocity is required';

    // Range validations
    if (bulletWeight && (bulletWeight <= 0 || bulletWeight > 1000)) {
      newErrors.bulletWeight = 'Bullet weight must be between 0 and 1000 grains';
    }
    if (bcG1 !== undefined && (bcG1 < 0 || bcG1 > 1)) {
      newErrors.ballisticCoefficientG1 = 'G1 BC must be between 0 and 1';
    }
    if (bcG7 !== undefined && (bcG7 < 0 || bcG7 > 1)) {
      newErrors.ballisticCoefficientG7 = 'G7 BC must be between 0 and 1';
    }
    if (muzzleVelocity && (muzzleVelocity <= 0 || muzzleVelocity > 5000)) {
      newErrors.muzzleVelocity = 'Muzzle velocity must be between 0 and 5000 fps';
    }
    if (powderWeight !== undefined && powderWeight < 0) {
      newErrors.powderWeight = 'Powder weight cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      Alert.alert('Validation Error', 'Please fix the errors before saving.');
      return;
    }

    const ammoData: AmmoProfileData = {
      name,
      manufacturer,
      caliber,
      bulletWeight: bulletWeight!,
      bulletType,
      ballisticCoefficientG1: bcG1!,
      ballisticCoefficientG7: bcG7!,
      muzzleVelocity: muzzleVelocity!,
      powderType: powderType || undefined,
      powderWeight: powderWeight || undefined,
      lotNumber: lotNumber || undefined,
      notes: notes || undefined,
    };

    try {
      if (isEditing && ammoId) {
        await updateAmmoProfile(ammoId, ammoData);
      } else {
        await createAmmoProfile(ammoData);
      }
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save ammo profile');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <TextInput
          label="Ammo Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g., Hornady 168gr ELD-M"
          required
          error={errors.name}
        />

        <TextInput
          label="Manufacturer"
          value={manufacturer}
          onChangeText={setManufacturer}
          placeholder="e.g., Hornady, Federal, Winchester"
          required
          error={errors.manufacturer}
        />

        <TextInput
          label="Caliber"
          value={caliber}
          onChangeText={setCaliber}
          placeholder="e.g., .308 Win, 6.5 Creedmoor, .223 Rem"
          required
          error={errors.caliber}
          helperText="Caliber designation of the ammunition"
        />

        <NumberInput
          label="Bullet Weight"
          value={bulletWeight}
          onChangeValue={setBulletWeight}
          min={1}
          max={1000}
          precision={1}
          unit="grains"
          required
          error={errors.bulletWeight}
          helperText="Weight of the bullet in grains"
        />

        <TextInput
          label="Bullet Type"
          value={bulletType}
          onChangeText={setBulletType}
          placeholder="e.g., HPBT, ELD-M, ELD-X, SPCE"
          required
          error={errors.bulletType}
          helperText="Type of bullet (e.g., HPBT, ELD-M, SPCE)"
        />

        <NumberInput
          label="G1 Ballistic Coefficient"
          value={bcG1}
          onChangeValue={setBcG1}
          min={0}
          max={1}
          precision={3}
          required
          error={errors.ballisticCoefficientG1}
          helperText="G1 BC typically between 0.2 and 0.7"
        />

        <NumberInput
          label="G7 Ballistic Coefficient"
          value={bcG7}
          onChangeValue={setBcG7}
          min={0}
          max={1}
          precision={3}
          required
          error={errors.ballisticCoefficientG7}
          helperText="G7 BC typically between 0.1 and 0.4"
        />

        <NumberInput
          label="Muzzle Velocity"
          value={muzzleVelocity}
          onChangeValue={setMuzzleVelocity}
          min={500}
          max={5000}
          precision={0}
          unit="fps"
          required
          error={errors.muzzleVelocity}
          helperText="Average muzzle velocity in feet per second"
        />

        <TextInput
          label="Powder Type"
          value={powderType}
          onChangeText={setPowderType}
          placeholder="e.g., H4350, Varget, IMR 4064"
          error={errors.powderType}
          helperText="Optional: Type of powder used"
        />

        <NumberInput
          label="Powder Weight"
          value={powderWeight}
          onChangeValue={setPowderWeight}
          min={0}
          max={200}
          precision={1}
          unit="grains"
          error={errors.powderWeight}
          helperText="Optional: Powder charge weight in grains"
        />

        <TextInput
          label="Lot Number"
          value={lotNumber}
          onChangeText={setLotNumber}
          placeholder="e.g., LOT 2024-001"
          error={errors.lotNumber}
          helperText="Optional: Manufacturer lot number for tracking"
        />

        <TextInput
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Additional notes about this ammunition"
          multiline
          numberOfLines={4}
          error={errors.notes}
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
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
  },
});
