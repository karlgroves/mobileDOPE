import React, { useEffect, useState, useMemo } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AmmoStackParamList } from '../navigation/types';
import { useAmmoStore } from '../store/useAmmoStore';
import { AmmoProfile } from '../models/AmmoProfile';
import {
  Card,
  LoadingSpinner,
  EmptyState,
  IconButton,
  ConfirmationDialog,
  SegmentedControl,
} from '../components';
import { useTheme } from '../contexts/ThemeContext';

type AllAmmoProfileListNavigationProp = NativeStackNavigationProp<
  AmmoStackParamList,
  'AllAmmoProfileList'
>;

interface AmmoWithCaliber {
  ammo: AmmoProfile;
  caliber: string;
}

export const AllAmmoProfileList: React.FC = () => {
  const navigation = useNavigation<AllAmmoProfileListNavigationProp>();
  const { theme } = useTheme();
  const { colors } = theme;

  const {
    ammoProfiles,
    loading: ammoLoading,
    loadAmmoProfiles,
    deleteAmmoProfile,
  } = useAmmoStore();

  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [ammoToDelete, setAmmoToDelete] = useState<AmmoProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'weight' | 'caliber' | 'recent'>('name');

  const loading = ammoLoading;

  // Enhance ammo profiles with caliber
  const ammoWithCaliber: AmmoWithCaliber[] = useMemo(() => {
    return ammoProfiles.map((ammo) => {
      return {
        ammo,
        caliber: ammo.caliber,
      };
    });
  }, [ammoProfiles]);

  // Filter and sort ammo
  const filteredAndSortedAmmo = useMemo(() => {
    let filtered = ammoWithCaliber;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = ammoWithCaliber.filter(
        (item) =>
          item.ammo.name.toLowerCase().includes(query) ||
          item.ammo.manufacturer.toLowerCase().includes(query) ||
          item.ammo.bulletType.toLowerCase().includes(query) ||
          item.ammo.bulletWeight.toString().includes(query) ||
          item.caliber.toLowerCase().includes(query)
      );
    }

    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.ammo.name.localeCompare(b.ammo.name);
        case 'weight':
          return a.ammo.bulletWeight - b.ammo.bulletWeight;
        case 'caliber':
          return a.caliber.localeCompare(b.caliber);
        case 'recent':
          const dateA = new Date(a.ammo.updatedAt || a.ammo.createdAt || 0).getTime();
          const dateB = new Date(b.ammo.updatedAt || b.ammo.createdAt || 0).getTime();
          return dateB - dateA;
        default:
          return 0;
      }
    });

    return sorted;
  }, [ammoWithCaliber, searchQuery, sortBy]);

  useEffect(() => {
    // Load all ammo profiles (no rifleId parameter)
    loadAmmoProfiles();
  }, []);

  const handleCreate = () => {
    // Ammunition is no longer tied to specific rifles
    navigation.navigate('AmmoProfileForm', {});
  };

  const handleView = (item: AmmoWithCaliber) => {
    navigation.navigate('AmmoProfileDetail', { ammoId: item.ammo.id! });
  };

  const handleEdit = (item: AmmoWithCaliber) => {
    navigation.navigate('AmmoProfileForm', { ammoId: item.ammo.id });
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

  const renderAmmoItem = ({ item }: { item: AmmoWithCaliber }) => (
    <Card
      style={styles.card}
      onPress={() => handleView(item)}
      title={item.ammo.name}
      subtitle={`${item.caliber} • ${item.ammo.manufacturer} • ${item.ammo.bulletWeight}gr ${item.ammo.bulletType} • ${item.ammo.muzzleVelocity} fps`}
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
          onPress={() => handleDeletePress(item.ammo)}
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
      {ammoProfiles.length === 0 ? (
        <EmptyState
          title="No Ammunition Profiles"
          message="No ammunition profiles found. Create a rifle profile and then add ammunition to get started."
          actionLabel="Create Ammo Profile"
          onAction={handleCreate}
        />
      ) : (
        <>
          {/* Search and Sort Controls */}
          <View style={[styles.controls, { backgroundColor: colors.surface }]}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text.primary,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Search ammo..."
              placeholderTextColor={colors.text.secondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            <View style={styles.sortContainer}>
              <Text style={[styles.sortLabel, { color: colors.text.secondary }]}>Sort by:</Text>
              <SegmentedControl
                options={[
                  { label: 'Name', value: 'name' },
                  { label: 'Weight', value: 'weight' },
                  { label: 'Caliber', value: 'caliber' },
                  { label: 'Recent', value: 'recent' },
                ]}
                selectedValue={sortBy}
                onValueChange={(value) =>
                  setSortBy(value as 'name' | 'weight' | 'caliber' | 'recent')
                }
              />
            </View>
          </View>

          <FlatList
            data={filteredAndSortedAmmo}
            renderItem={renderAmmoItem}
            keyExtractor={(item) => item.ammo.id!.toString()}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptySearch}>
                <Text style={[styles.emptySearchText, { color: colors.text.secondary }]}>
                  No ammo matches your search
                </Text>
              </View>
            }
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
  controls: {
    padding: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  sortContainer: {
    marginBottom: 8,
  },
  sortLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  emptySearch: {
    padding: 32,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 16,
    textAlign: 'center',
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
