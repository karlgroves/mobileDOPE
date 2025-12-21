import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Card,
  Button,
  EmptyState,
  LoadingSpinner,
  IconButton,
  ConfirmationDialog,
  SegmentedControl,
} from '../components';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import { useTheme } from '../contexts/ThemeContext';
import { RifleProfile } from '../models/RifleProfile';

type RootStackParamList = {
  RifleProfileForm: { rifleId?: number };
  RifleProfileDetail: { rifleId: number };
  RifleProfileList: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RifleProfileList'>;

export const RifleProfileList: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { colors } = theme;

  const { rifles, loading, deleteRifle } = useRifleStore();
  const { ammoProfiles } = useAmmoStore();

  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [rifleToDelete, setRifleToDelete] = useState<RifleProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'caliber' | 'recent'>('name');

  // Filter and sort rifles
  const filteredAndSortedRifles = useMemo(() => {
    let filtered = rifles;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = rifles.filter(
        (rifle) =>
          rifle.name.toLowerCase().includes(query) ||
          rifle.caliber.toLowerCase().includes(query) ||
          rifle.opticManufacturer.toLowerCase().includes(query) ||
          rifle.opticModel.toLowerCase().includes(query)
      );
    }

    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'caliber':
          return a.caliber.localeCompare(b.caliber);
        case 'recent':
          // Sort by updatedAt or createdAt, most recent first
          const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return dateB - dateA;
        default:
          return 0;
      }
    });

    return sorted;
  }, [rifles, searchQuery, sortBy]);

  const handleCreate = () => {
    navigation.navigate('RifleProfileForm', {});
  };

  const handleEdit = (rifle: RifleProfile) => {
    if (rifle.id) {
      navigation.navigate('RifleProfileForm', { rifleId: rifle.id });
    }
  };

  const handleView = (rifle: RifleProfile) => {
    if (rifle.id) {
      navigation.navigate('RifleProfileDetail', { rifleId: rifle.id });
    }
  };

  const handleClone = async (rifle: RifleProfile) => {
    try {
      // Create a copy with modified name
      const clonedData = {
        ...rifle,
        id: undefined, // Clear ID so it creates a new record
        name: `${rifle.name} (Copy)`,
        createdAt: undefined,
        updatedAt: undefined,
      };

      const clonedRifle = new RifleProfile(clonedData);
      await useRifleStore.getState().createRifle(clonedRifle);

      Alert.alert('Success', 'Rifle profile cloned successfully');
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to clone rifle profile'
      );
    }
  };

  const handleDeletePress = (rifle: RifleProfile) => {
    setRifleToDelete(rifle);
    setDeleteConfirmVisible(true);
  };

  const handleDeleteConfirm = async () => {
    if (rifleToDelete?.id) {
      try {
        await deleteRifle(rifleToDelete.id);
        Alert.alert('Success', 'Rifle profile deleted successfully');
      } catch (error) {
        Alert.alert(
          'Error',
          error instanceof Error ? error.message : 'Failed to delete rifle profile'
        );
      }
    }
    setRifleToDelete(null);
  };

  const renderRifleItem = ({ item }: { item: RifleProfile }) => {
    const rifleAmmoCount = ammoProfiles.filter((a) => a.caliber === item.caliber).length;

    return (
      <Card
        style={styles.card}
        onPress={() => handleView(item)}
        title={item.name}
        subtitle={`${item.caliber} • ${item.barrelLength}" barrel • ${item.zeroDistance}yd zero`}
      >
        <View style={styles.ammoSection}>
          <Text style={[styles.ammoCount, { color: colors.text.secondary }]}>
            {rifleAmmoCount} {rifleAmmoCount === 1 ? 'ammo profile' : 'ammo profiles'}
          </Text>
          <Button
            title={rifleAmmoCount === 0 ? 'Add Ammunition' : 'View Ammunition'}
            onPress={() => {
              if (rifleAmmoCount === 0) {
                (navigation as any).navigate('AmmoProfileForm', {});
              } else {
                (navigation as any).navigate('AmmoProfileList', { rifleId: item.id! });
              }
            }}
            variant="secondary"
            size="small"
          />
        </View>
        <View style={styles.cardActions}>
          <IconButton
            icon="📋"
            onPress={() => handleClone(item)}
            variant="ghost"
            size="medium"
            accessibilityLabel="Clone rifle profile"
          />
          <IconButton
            icon="✏️"
            onPress={() => handleEdit(item)}
            variant="ghost"
            size="medium"
            accessibilityLabel="Edit rifle profile"
          />
          <IconButton
            icon="🗑️"
            onPress={() => handleDeletePress(item)}
            variant="ghost"
            size="medium"
            accessibilityLabel="Delete rifle profile"
          />
        </View>
      </Card>
    );
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {rifles.length === 0 ? (
        <EmptyState
          title="No Rifle Profiles"
          message="Create your first rifle profile to get started with ballistic calculations and DOPE logging."
          actionLabel="Create Rifle Profile"
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
              placeholder="Search rifles..."
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
                  { label: 'Caliber', value: 'caliber' },
                  { label: 'Recent', value: 'recent' },
                ]}
                selectedValue={sortBy}
                onValueChange={(value) => setSortBy(value as 'name' | 'caliber' | 'recent')}
              />
            </View>
          </View>

          <FlatList
            data={filteredAndSortedRifles}
            renderItem={renderRifleItem}
            keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptySearch}>
                <Text style={[styles.emptySearchText, { color: colors.text.secondary }]}>
                  No rifles match your search
                </Text>
              </View>
            }
          />
          <View style={styles.fabContainer}>
            <Button
              title="+ New Rifle"
              onPress={handleCreate}
              variant="primary"
              size="large"
              style={styles.fab}
            />
          </View>
        </>
      )}

      <ConfirmationDialog
        visible={deleteConfirmVisible}
        onClose={() => setDeleteConfirmVisible(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Rifle Profile"
        message={`Are you sure you want to delete "${rifleToDelete?.name}"? This action cannot be undone and will also delete all associated ammunition profiles and DOPE logs.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
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
  list: {
    padding: 16,
    paddingBottom: 100, // Make room for FAB
  },
  emptySearch: {
    padding: 32,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    marginBottom: 12,
  },
  ammoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  ammoCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    left: 16,
  },
  fab: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
