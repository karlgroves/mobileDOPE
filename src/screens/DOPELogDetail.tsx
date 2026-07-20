/**
 * DOPE Log Detail Screen
 * Displays detailed information about a single DOPE log entry
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import type { LogsStackScreenProps } from '../navigation/types';
import { useDOPEStore } from '../store/useDOPEStore';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';

type Props = LogsStackScreenProps<'DOPELogDetail'>;

export function DOPELogDetail({ route, navigation }: Props) {
  const { logId } = route.params;
  const { theme } = useTheme();
  const { colors } = theme;

  const { getDopeById, deleteDopeLog } = useDOPEStore();
  const { getRifleById } = useRifleStore();
  const { getAmmoById } = useAmmoStore();

  const log = getDopeById(logId);
  const rifle = log ? getRifleById(log.rifleId) : undefined;
  const ammo = log ? getAmmoById(log.ammoId) : undefined;

  useEffect(() => {
    if (!log) {
      Alert.alert('Error', 'DOPE log not found', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log]);

  const handleEdit = () => {
    navigation.navigate('DOPELogEdit', { logId });
  };

  const handleDelete = () => {
    Alert.alert('Delete DOPE Log', 'Are you sure you want to delete this log entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDopeLog(logId);
            navigation.goBack();
          } catch (_error) {
            Alert.alert('Error', 'Failed to delete DOPE log');
          }
        },
      },
    ]);
  };

  if (!log) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>DOPE log not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Rifle & Ammo */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Rifle & Ammunition
          </Text>
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.text.secondary }]}>Rifle:</Text>
            <Text style={[styles.value, { color: colors.text.primary }]}>
              {rifle?.name || 'Unknown'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.text.secondary }]}>Ammunition:</Text>
            <Text style={[styles.value, { color: colors.text.primary }]}>
              {ammo?.name || 'Unknown'}
            </Text>
          </View>
        </Card>

        {/* Distance & Corrections */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Target & Corrections
          </Text>
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.text.secondary }]}>Distance:</Text>
            <Text style={[styles.value, { color: colors.primary }]}>
              {log.distance} {log.distanceUnit}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.text.secondary }]}>Elevation:</Text>
            <Text style={[styles.value, { color: colors.primary }]}>
              {log.elevationCorrection.toFixed(2)} {log.correctionUnit}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.text.secondary }]}>Windage:</Text>
            <Text style={[styles.value, { color: colors.primary }]}>
              {log.windageCorrection.toFixed(2)} {log.correctionUnit}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.text.secondary }]}>Target Type:</Text>
            <Text style={[styles.value, { color: colors.text.primary }]}>
              {log.targetType.replace('_', ' ')}
            </Text>
          </View>
        </Card>

        {/* Performance */}
        {(log.hitCount !== undefined ||
          log.shotCount !== undefined ||
          log.groupSize !== undefined) && (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Performance</Text>
            {log.hitCount !== undefined && log.shotCount !== undefined && (
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: colors.text.secondary }]}>Hit Rate:</Text>
                <Text style={[styles.value, { color: colors.text.primary }]}>
                  {log.hitCount}/{log.shotCount} (
                  {((log.hitCount / log.shotCount) * 100).toFixed(0)}%)
                </Text>
              </View>
            )}
            {log.groupSize !== undefined && (
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: colors.text.secondary }]}>Group Size:</Text>
                <Text style={[styles.value, { color: colors.text.primary }]}>
                  {log.groupSize.toFixed(2)} inches
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* Notes */}
        {log.notes && (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Notes</Text>
            <Text style={[styles.notes, { color: colors.text.primary }]}>{log.notes}</Text>
          </Card>
        )}

        {/* Timestamp */}
        {log.timestamp && (
          <Text style={[styles.timestamp, { color: colors.text.secondary }]}>
            Logged: {new Date(log.timestamp).toLocaleString()}
          </Text>
        )}

        {/* Actions */}
        <View style={styles.buttonContainer}>
          <Button title="Edit" onPress={handleEdit} variant="secondary" size="large" />
          <Button title="Delete" onPress={handleDelete} variant="danger" size="large" />
        </View>
      </ScrollView>
    </View>
  );
}

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
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 15,
  },
  value: {
    fontSize: 15,
    fontWeight: '500',
  },
  notes: {
    fontSize: 14,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  buttonContainer: {
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    margin: 24,
  },
});
