/**
 * DOPE Log List Screen
 * Displays all DOPE logs with filtering and sorting
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import type { LogsStackScreenProps } from '../navigation/types';
import { useDOPEStore } from '../store/useDOPEStore';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import type { DOPELog } from '../models/DOPELog';

type Props = LogsStackScreenProps<'DOPELogList'>;

export function DOPELogList({ navigation }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;

  const { dopeLogs, loadDopeLogs, deleteDopeLog, loading } = useDOPEStore();
  const { getRifleById } = useRifleStore();
  const { getAmmoById } = useAmmoStore();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await loadDopeLogs();
    } catch (error) {
      Alert.alert('Error', 'Failed to load DOPE logs');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleView = (log: DOPELog) => {
    if (log.id) {
      navigation.navigate('DOPELogDetail', { logId: log.id });
    }
  };

  const handleEdit = (log: DOPELog) => {
    if (log.id) {
      navigation.navigate('DOPELogEdit', { logId: log.id });
    }
  };

  const handleDelete = (log: DOPELog) => {
    Alert.alert('Delete DOPE Log', 'Are you sure you want to delete this log entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (log.id) {
              await deleteDopeLog(log.id);
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to delete DOPE log');
          }
        },
      },
    ]);
  };

  const renderLogItem = ({ item }: { item: DOPELog }) => {
    const rifle = getRifleById(item.rifleId);
    const ammo = getAmmoById(item.ammoId);

    return (
      <TouchableOpacity onPress={() => handleView(item)} activeOpacity={0.7}>
        <Card style={[styles.logCard, { backgroundColor: colors.surface }]}>
          <View style={styles.logHeader}>
            <View style={styles.logTitleContainer}>
              <Text style={[styles.logTitle, { color: colors.text.primary }]}>
                {rifle?.name || 'Unknown Rifle'}
              </Text>
              <Text style={[styles.logSubtitle, { color: colors.text.secondary }]}>
                {ammo?.name || 'Unknown Ammo'} • {item.distance} {item.distanceUnit}
              </Text>
            </View>
            <View style={styles.correctionBadge}>
              <Text style={[styles.correctionText, { color: colors.primary }]}>
                ↑ {item.elevationCorrection.toFixed(2)}
              </Text>
              <Text style={[styles.correctionText, { color: colors.primary }]}>
                → {item.windageCorrection.toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={styles.logDetails}>
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>Target:</Text>
              <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                {item.targetType.replace('_', ' ')}
              </Text>
            </View>

            {item.hitCount !== undefined && item.shotCount !== undefined && (
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>Hits:</Text>
                <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                  {item.hitCount}/{item.shotCount}
                </Text>
              </View>
            )}

            {item.groupSize && (
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>Group:</Text>
                <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                  {item.groupSize.toFixed(2)}"
                </Text>
              </View>
            )}
          </View>

          {item.timestamp && (
            <Text style={[styles.timestamp, { color: colors.text.secondary }]}>
              {new Date(item.timestamp).toLocaleString()}
            </Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
              onPress={() => handleEdit(item)}
            >
              <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
              onPress={() => handleDelete(item)}
            >
              <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading && dopeLogs.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
            Loading DOPE logs...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {dopeLogs.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No DOPE Logs"
          message="Start logging your shooting data to build your DOPE book"
          actionLabel="Add DOPE Log"
          onAction={() => navigation.navigate('DOPELogEdit', {})}
        />
      ) : (
        <>
          <FlatList
            data={dopeLogs}
            renderItem={renderLogItem}
            keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />

          <View style={styles.fabContainer}>
            <TouchableOpacity
              style={[styles.fab, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('DOPELogEdit', {})}
            >
              <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  logCard: {
    marginBottom: 12,
    padding: 16,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  logTitleContainer: {
    flex: 1,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  logSubtitle: {
    fontSize: 14,
  },
  correctionBadge: {
    alignItems: 'flex-end',
  },
  correctionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  logDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    gap: 4,
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 12,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '300',
  },
});
