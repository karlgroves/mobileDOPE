import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProfilesStackParamList } from '../navigation/types';
import { useAmmoStore } from '../store/useAmmoStore';
import { useRifleStore } from '../store/useRifleStore';
import { AmmoProfile } from '../models/AmmoProfile';
import {
  Card,
  LoadingSpinner,
  EmptyState,
  IconButton,
  ConfirmationDialog,
} from '../components';
import { useTheme } from '../contexts/ThemeContext';

type AmmoProfileListNavigationProp = NativeStackNavigationProp<
  ProfilesStackParamList,
  'AmmoProfileList'
>;
type AmmoProfileListRouteProp = RouteProp<ProfilesStackParamList, 'AmmoProfileList'>;

export const AmmoProfileList: React.FC = () => {
  const navigation = useNavigation<AmmoProfileListNavigationProp>();
  const route = useRoute<AmmoProfileListRouteProp>();
  const { theme } = useTheme();
  const { colors } = theme;

  const { rifleId } = route.params;
  const { ammoProfiles, loading, loadAmmoProfiles, deleteAmmoProfile } = useAmmoStore();
  const { rifles } = useRifleStore();

  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [ammoToDelete, setAmmoToDelete] = useState<AmmoProfile | null>(null);

  const rifle = rifles.find((r) => r.id === rifleId);
  const rifleAmmo = ammoProfiles.filter((a) => a.rifleId === rifleId);

  useEffect(() => {
    loadAmmoProfiles(rifleId);
  }, [rifleId]);

  const handleCreate = () => {
    navigation.navigate('AmmoProfileForm', { rifleId });
  };

  const handleView = (ammo: AmmoProfile) => {
    navigation.navigate('AmmoProfileDetail', { ammoId: ammo.id!, rifleId });
  };

  const handleEdit = (ammo: AmmoProfile) => {
    navigation.navigate('AmmoProfileForm', { rifleId, ammoId: ammo.id });
  };

  const handleDeletePress = (ammo: AmmoProfile) => {
    setAmmoToDelete(ammo);
    setDeleteConfirmVisible(true);
  };

  const handleDeleteConfirm = async () => {
    if (ammoToDelete?.id) {
      try {
        await deleteAmmoProfile(ammoToDelete.id);
      } catch (error: any) {
        console.error('Failed to delete ammo profile:', error);
      }
    }
    setAmmoToDelete(null);
  };

  const renderAmmoItem = ({ item }: { item: AmmoProfile }) => (
    <Card
      style={styles.card}
      onPress={() => handleView(item)}
      title={item.name}
      subtitle={`${item.manufacturer} • ${item.bulletWeight}gr ${item.bulletType} • ${item.muzzleVelocity} fps`}
    >
      <View style={styles.cardActions}>
        <IconButton
          icon="✏️"
          onPress={() => handleEdit(item)}
          variant="ghost"
          accessibilityLabel="Edit ammo profile"
        />
        <IconButton
          icon="🗑️"
          onPress={() => handleDeletePress(item)}
          variant="ghost"
          accessibilityLabel="Delete ammo profile"
        />
      </View>
    </Card>
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {rifleAmmo.length === 0 ? (
        <EmptyState
          title="No Ammunition Profiles"
          message={`No ammunition profiles found for ${rifle?.name || 'this rifle'}. Create one to get started.`}
          actionLabel="Create Ammo Profile"
          onAction={handleCreate}
        />
      ) : (
        <>
          <FlatList
            data={rifleAmmo}
            renderItem={renderAmmoItem}
            keyExtractor={(item) => item.id!.toString()}
            contentContainerStyle={styles.listContent}
          />
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={handleCreate}
            accessibilityLabel="Create new ammo profile"
            accessibilityRole="button"
          >
            <Text style={[styles.fabIcon, { color: colors.text.inverse }]}>+</Text>
          </TouchableOpacity>
        </>
      )}

      <ConfirmationDialog
        visible={deleteConfirmVisible}
        onClose={() => {
          setDeleteConfirmVisible(false);
          setAmmoToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Ammo Profile"
        message={`Are you sure you want to delete "${ammoToDelete?.name}"? This will also delete all associated DOPE logs.`}
        variant="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  fabIcon: {
    fontSize: 28,
    fontWeight: 'bold',
  },
});
