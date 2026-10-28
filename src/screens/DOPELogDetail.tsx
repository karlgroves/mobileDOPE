/**
 * DOPE Log Detail Screen
 * Displays detailed information about a single DOPE log entry
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { GroupStatistics } from '../components/GroupStatistics';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { TargetView } from '../components/TargetView';
import { useTheme } from '../contexts/ThemeContext';
import { useDopeLog } from '../hooks/useDopeLog';
import { useTargetImages } from '../hooks/useTargetImages';
import { deleteTargetPhoto } from '../services/TargetPhotoService';
import { useAmmoStore } from '../store/useAmmoStore';
import { useDOPEStore } from '../store/useDOPEStore';
import { useRifleStore } from '../store/useRifleStore';
import { logDistanceInYards } from '../utils/distanceUnits';
import { calculateConfidence } from '../utils/dopeAnalysis';
import { backgroundOf, measureGroup } from '../utils/targetMarking';

import type { LogsStackScreenProps } from '../navigation/types';

type Props = LogsStackScreenProps<'DOPELogDetail'>;

export function DOPELogDetail({ route, navigation }: Props) {
  const { logId } = route.params;
  const { theme } = useTheme();
  const { colors } = theme;

  const { deleteDopeLog } = useDOPEStore();
  const { getRifleById } = useRifleStore();
  const { getAmmoById } = useAmmoStore();

  // Loaded by id when the store does not have it yet: a restored launch shows
  // this screen before DOPE Logs has filled the store (#141).
  const { log, status } = useDopeLog(logId);
  const rifle = log ? getRifleById(log.rifleId) : undefined;
  const ammo = log ? getAmmoById(log.ammoId) : undefined;

  // Scored from the evidence this log carries, not from whether it agrees with
  // the solver -- a log that disagrees may be the most useful one there is.
  // See src/utils/dopeAnalysis.ts. (#64)
  const confidence = log ? calculateConfidence(log) : undefined;

  // The target marked for this log (#63), read again whenever the screen comes
  // back into view -- which is how a target saved on Mark Target appears here.
  const [targetsVersion, setTargetsVersion] = useState(0);
  useEffect(
    () => navigation.addListener('focus', () => setTargetsVersion((v) => v + 1)),
    [navigation]
  );
  const [target] = useTargetImages(logId, targetsVersion);

  // Set when this screen deletes the log: it is then missing on purpose, and
  // the screen is already on its way back.
  const deleted = useRef(false);

  useEffect(() => {
    if (status === 'missing' && !deleted.current) {
      Alert.alert('Error', 'DOPE log not found', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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
            deleted.current = true;
            await deleteDopeLog(logId);
            // The target row goes with the log by foreign-key cascade; its photo
            // is a file, and would otherwise stay in the app's storage unseen.
            if (target) deleteTargetPhoto(target.imageUri);
            navigation.goBack();
          } catch (_error) {
            deleted.current = false;
            Alert.alert('Error', 'Failed to delete DOPE log');
          }
        },
      },
    ]);
  };

  if (status === 'loading') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingSpinner />
      </View>
    );
  }

  if (!log) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.errorText }]}>DOPE log not found</Text>
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
            <Text style={[styles.value, { color: colors.primaryText }]}>
              {log.distance} {log.distanceUnit}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.text.secondary }]}>Elevation:</Text>
            <Text style={[styles.value, { color: colors.primaryText }]}>
              {log.elevationCorrection.toFixed(2)} {log.correctionUnit}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.text.secondary }]}>Windage:</Text>
            <Text style={[styles.value, { color: colors.primaryText }]}>
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

        {/* How well-evidenced this point is (#64) */}
        {confidence && (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Confidence in this entry
            </Text>
            <ConfidenceBadge confidence={confidence} testID="dope-confidence" />
          </Card>
        )}

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

        {/* Marked target (#63). Measured again from the stored marks and scale,
            so it shows exactly what Mark Target showed. */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Target</Text>
          {target && (
            <View style={styles.target}>
              <TargetView
                background={backgroundOf(target)}
                markers={target.poiMarkers}
                testID="log-target"
              />
              <GroupStatistics
                group={measureGroup(
                  target.poiMarkers,
                  { widthInches: target.targetWidthInches, aspectRatio: target.aspectRatio },
                  logDistanceInYards(log)
                )}
                testID="log-target-statistics"
              />
            </View>
          )}
          <Button
            title={target ? 'Edit Target' : 'Mark Target'}
            onPress={() => navigation.navigate('TargetMarking', { logId })}
            variant="secondary"
            accessibilityHint="Marks where each shot of this group landed"
          />
        </Card>

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
          {/* The only route into DOPECurve (#87). It was registered on the history
              stack with no caller. This is the natural entry: the curve needs a
              rifle and a load, and a log entry is where the user already has both
              in hand. Hidden when either is missing rather than navigating to a
              screen that would render nothing. */}
          {rifle?.id !== undefined && ammo?.id !== undefined && (
            <Button
              title="View Curve"
              onPress={() =>
                navigation.navigate('DOPECurve', { rifleId: rifle.id!, ammoId: ammo.id! })
              }
              variant="secondary"
              size="large"
            />
          )}
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
  target: {
    gap: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    margin: 24,
  },
});
