import React from 'react';
import { View, ScrollView, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProfilesStackParamList } from '../navigation/types';
import { useAmmoStore } from '../store/useAmmoStore';
import { Card, Button } from '../components';
import { useTheme } from '../contexts/ThemeContext';

type AmmoProfileDetailNavigationProp = NativeStackNavigationProp<
  ProfilesStackParamList,
  'AmmoProfileDetail'
>;
type AmmoProfileDetailRouteProp = RouteProp<ProfilesStackParamList, 'AmmoProfileDetail'>;

interface DetailRowProps {
  label: string;
  value: string | number | undefined;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value }) => {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text.primary }]}>
        {value !== undefined ? value : '-'}
      </Text>
    </View>
  );
};

export const AmmoProfileDetail: React.FC = () => {
  const navigation = useNavigation<AmmoProfileDetailNavigationProp>();
  const route = useRoute<AmmoProfileDetailRouteProp>();
  const { theme } = useTheme();
  const { colors } = theme;

  const { ammoProfiles } = useAmmoStore();
  const { ammoId, rifleId } = route.params;

  const ammo = ammoProfiles.find((a) => a.id === ammoId);

  if (!ammo) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>
          Ammo profile not found
        </Text>
      </View>
    );
  }

  const handleEdit = () => {
    navigation.navigate('AmmoProfileForm', { rifleId, ammoId });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Card style={styles.headerCard}>
          <Text style={[styles.title, { color: colors.text.primary }]}>{ammo.name}</Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            {ammo.manufacturer}
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Bullet Specifications
          </Text>
          <DetailRow label="Bullet Weight" value={`${ammo.bulletWeight} grains`} />
          <DetailRow label="Bullet Type" value={ammo.bulletType} />
          <DetailRow
            label="G1 Ballistic Coefficient"
            value={ammo.ballisticCoefficientG1.toFixed(3)}
          />
          <DetailRow
            label="G7 Ballistic Coefficient"
            value={ammo.ballisticCoefficientG7.toFixed(3)}
          />
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Velocity & Performance
          </Text>
          <DetailRow label="Muzzle Velocity" value={`${ammo.muzzleVelocity} fps`} />
        </Card>

        {(ammo.powderType || ammo.powderWeight || ammo.lotNumber) && (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Load Details
            </Text>
            {ammo.powderType && <DetailRow label="Powder Type" value={ammo.powderType} />}
            {ammo.powderWeight && (
              <DetailRow label="Powder Weight" value={`${ammo.powderWeight} grains`} />
            )}
            {ammo.lotNumber && <DetailRow label="Lot Number" value={ammo.lotNumber} />}
          </Card>
        )}

        {ammo.notes && (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Notes</Text>
            <Text style={[styles.notes, { color: colors.text.primary }]}>{ammo.notes}</Text>
          </Card>
        )}

        <Button title="Edit Profile" onPress={handleEdit} variant="primary" />
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
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 24,
  },
  headerCard: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500',
  },
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  notes: {
    fontSize: 14,
    lineHeight: 20,
  },
});
