import React from 'react';
import { View, ScrollView, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Button, EmptyState } from '../components';
import { useRifleStore } from '../store/useRifleStore';
import { useTheme } from '../contexts/ThemeContext';

type RootStackParamList = {
  RifleProfileForm: { rifleId?: number };
  RifleProfileDetail: { rifleId: number };
  RifleProfileList: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RifleProfileDetail'>;
type RoutePropType = RouteProp<RootStackParamList, 'RifleProfileDetail'>;

interface DetailRowProps {
  label: string;
  value: string | number;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value }) => {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text.primary }]}>{value}</Text>
    </View>
  );
};

export const RifleProfileDetail: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { theme } = useTheme();
  const { colors } = theme;

  const { rifles } = useRifleStore();
  const rifle = rifles.find((r) => r.id === route.params.rifleId);

  if (!rifle) {
    return (
      <EmptyState
        title="Rifle Not Found"
        message="The requested rifle profile could not be found."
        actionLabel="Back to List"
        onAction={() => navigation.goBack()}
      />
    );
  }

  const handleEdit = () => {
    navigation.navigate('RifleProfileForm', { rifleId: rifle.id });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.card}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{rifle.name}</Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>{rifle.caliber}</Text>
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          Barrel Specifications
        </Text>
        <DetailRow label="Barrel Length" value={`${rifle.barrelLength} inches`} />
        <DetailRow label="Twist Rate" value={rifle.twistRate} />
        <DetailRow label="Zero Distance" value={`${rifle.zeroDistance} yards`} />
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          Optic Configuration
        </Text>
        <DetailRow label="Manufacturer" value={rifle.opticManufacturer} />
        <DetailRow label="Model" value={rifle.opticModel} />
        <DetailRow label="Reticle Type" value={rifle.reticleType} />
        <DetailRow label="Click Value Type" value={rifle.clickValueType} />
        <DetailRow label="Click Value" value={`${rifle.clickValue} ${rifle.clickValueType}`} />
        <DetailRow label="Scope Height" value={`${rifle.scopeHeight} inches`} />
      </Card>

      {rifle.notes && (
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Notes</Text>
          <Text style={[styles.notes, { color: colors.text.primary }]}>{rifle.notes}</Text>
        </Card>
      )}

      <View style={styles.buttonContainer}>
        <Button
          title="Edit Profile"
          onPress={handleEdit}
          variant="primary"
          size="large"
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
  card: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 16,
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  notes: {
    fontSize: 16,
    lineHeight: 24,
  },
  buttonContainer: {
    marginTop: 8,
  },
  button: {
    width: '100%',
  },
});
