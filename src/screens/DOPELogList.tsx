/**
 * DOPE Log List Screen
 * Displays all DOPE logs with filtering and sorting
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { SegmentedControl } from '../components/SegmentedControl';
import type { LogsStackScreenProps } from '../navigation/types';
import { useDOPEStore } from '../store/useDOPEStore';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import type { DOPELog } from '../models/DOPELog';
import { exportDOPELogsCSV, exportDOPELogsJSON } from '../services/ExportService';

type Props = LogsStackScreenProps<'DOPELogList'>;

export function DOPELogList({ navigation }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;

  const { dopeLogs, loadDopeLogs, deleteDopeLog, loading } = useDOPEStore();
  const { getRifleById } = useRifleStore();
  const { getAmmoById } = useAmmoStore();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'distance' | 'rifle'>('date');

  // Filter and sort DOPE logs
  const filteredAndSortedLogs = useMemo(() => {
    let filtered = dopeLogs;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = dopeLogs.filter((log) => {
        const rifle = getRifleById(log.rifleId);
        const ammo = getAmmoById(log.ammoId);
        return (
          rifle?.name.toLowerCase().includes(query) ||
          rifle?.caliber.toLowerCase().includes(query) ||
          ammo?.name.toLowerCase().includes(query) ||
          log.distance.toString().includes(query) ||
          log.notes?.toLowerCase().includes(query)
        );
      });
    }

    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date':
          // Most recent first
          const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return dateB - dateA;
        case 'distance':
          return a.distance - b.distance;
        case 'rifle':
          const rifleA = getRifleById(a.rifleId)?.name || '';
          const rifleB = getRifleById(b.rifleId)?.name || '';
          return rifleA.localeCompare(rifleB);
        default:
          return 0;
      }
    });

    return sorted;
  }, [dopeLogs, searchQuery, sortBy, getRifleById, getAmmoById]);

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

  const handleExport = () => {
    if (dopeLogs.length === 0) {
      Alert.alert('No Data', 'You have no DOPE logs to export.');
      return;
    }

    Alert.alert('Export DOPE Logs', 'Choose export format:', [
      {
        text: 'CSV (Spreadsheet)',
        onPress: async () => {
          const result = await exportDOPELogsCSV(
            dopeLogs,
            useRifleStore.getState().rifles,
            useAmmoStore.getState().ammoProfiles
          );
          if (result.success) {
            Alert.alert('Success', `Exported ${dopeLogs.length} DOPE logs to CSV.`);
          } else {
            Alert.alert('Error', result.error || 'Export failed');
          }
        },
      },
      {
        text: 'JSON (Data)',
        onPress: async () => {
          const result = await exportDOPELogsJSON(dopeLogs);
          if (result.success) {
            Alert.alert('Success', `Exported ${dopeLogs.length} DOPE logs to JSON.`);
          } else {
            Alert.alert('Error', result.error || 'Export failed');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
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
              placeholder="Search logs..."
              placeholderTextColor={colors.text.secondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            <View style={styles.sortContainer}>
              <Text style={[styles.sortLabel, { color: colors.text.secondary }]}>Sort by:</Text>
              <SegmentedControl
                options={[
                  { label: 'Date', value: 'date' },
                  { label: 'Distance', value: 'distance' },
                  { label: 'Rifle', value: 'rifle' },
                ]}
                selectedValue={sortBy}
                onValueChange={(value) => setSortBy(value as 'date' | 'distance' | 'rifle')}
              />
            </View>
          </View>

          <FlatList
            data={filteredAndSortedLogs}
            renderItem={renderLogItem}
            keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              <View style={styles.emptySearch}>
                <Text style={[styles.emptySearchText, { color: colors.text.secondary }]}>
                  No logs match your search
                </Text>
              </View>
            }
          />

          <View style={styles.fabContainer}>
            <TouchableOpacity
              style={[styles.exportFab, { backgroundColor: colors.surface, borderColor: colors.primary }]}
              onPress={handleExport}
            >
              <Text style={[styles.exportFabText, { color: colors.primary }]}>↗</Text>
            </TouchableOpacity>
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
    flexDirection: 'row',
    gap: 12,
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
  exportFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  exportFabText: {
    fontSize: 24,
    fontWeight: '600',
  },
});
