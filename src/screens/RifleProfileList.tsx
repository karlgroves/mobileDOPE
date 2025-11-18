import React, { useState } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Card,
  Button,
  EmptyState,
  LoadingSpinner,
  IconButton,
  ConfirmationDialog,
} from '../components';
import { useRifleStore } from '../store/useRifleStore';
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

  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [rifleToDelete, setRifleToDelete] = useState<RifleProfile | null>(null);

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

  const renderRifleItem = ({ item }: { item: RifleProfile }) => (
    <Card
      style={styles.card}
      onPress={() => handleView(item)}
      title={item.name}
      subtitle={`${item.caliber} • ${item.barrelLength}" barrel • ${item.zeroDistance}yd zero`}
    >
      <View style={styles.cardActions}>
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
          <FlatList
            data={rifles}
            renderItem={renderRifleItem}
            keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
            contentContainerStyle={styles.list}
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
  list: {
    padding: 16,
    paddingBottom: 100, // Make room for FAB
  },
  card: {
    marginBottom: 12,
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
