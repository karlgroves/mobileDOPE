/**
 * Target Marking Screen (#63)
 *
 * Marks where each shot of a group landed, on the plain target the app draws or
 * on a photo of the shooter's own, and measures the group as the shots go on.
 * Reached from DOPE Log Details; the marked target is saved to that log.
 *
 * ## What is stored
 *
 * One target per log: opening the screen again edits the saved one. Marks are
 * fractions of the image (`src/utils/targetMarking.ts`), saved with the target's
 * real width and the image's shape so DOPE Log Details can measure the group
 * again rather than show a number frozen at save time.
 *
 * Nothing is written until Save. Undo and Clear only change what is on screen,
 * and backing out leaves the saved target as it was -- which is why Clear asks
 * for no confirmation. Saving with every shot cleared removes the target.
 *
 * ## The log's group size
 *
 * Saving a measurable group -- two or more shots and a width -- also sets the
 * log's `groupSize` to the measured extreme spread, replacing any figure typed
 * on the log form. The marks are a measurement of the same group the typed
 * figure estimated, and a log showing two different sizes for one group would
 * leave the shooter to guess which one the confidence score and the DOPE card
 * used. A group that cannot be measured leaves the typed figure alone.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { GroupStatistics } from '../components/GroupStatistics';
import { NumberInput } from '../components/NumberInput';
import { TargetView } from '../components/TargetView';
import { useTheme } from '../contexts/ThemeContext';
import { useDopeLog } from '../hooks/useDopeLog';
import { targetImageRepository } from '../services/database';
import { deleteTargetPhoto, pickTargetPhoto } from '../services/TargetPhotoService';
import { useDOPEStore } from '../store/useDOPEStore';
import { logDistanceInYards } from '../utils/distanceUnits';
import { UnsupportedImageError } from '../utils/imageMetadata';
import {
  addShot,
  aspectRatioOf,
  backgroundOf,
  BUILT_IN_TARGET_URI,
  measureGroup,
  measuredGroupSize,
  shotFromOffset,
  TARGET_TYPE,
} from '../utils/targetMarking';

import type { POIMarker, TargetImage, TargetImageData } from '../models/TargetImage';
import type { HistoryStackScreenProps } from '../navigation/types';
import type { TargetBackground } from '../utils/targetMarking';

type Props = HistoryStackScreenProps<'TargetMarking'>;

export function TargetMarking({ route, navigation }: Props) {
  const { logId } = route.params;
  const { colors } = useTheme().theme;
  const { log, status } = useDopeLog(logId);
  const updateDopeLog = useDOPEStore((s) => s.updateDopeLog);

  const [existing, setExisting] = useState<TargetImage | undefined>();
  const [background, setBackground] = useState<TargetBackground>({ kind: 'bullseye' });
  const [markers, setMarkers] = useState<POIMarker[]>([]);
  const [widthInches, setWidthInches] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);
  // A shot entered as a measurement from the centre, for anyone not tapping.
  const [rightInches, setRightInches] = useState<number | undefined>();
  const [upInches, setUpInches] = useState<number | undefined>();

  // A photo chosen here and not yet saved. It is already a file in the app's
  // storage, so it is deleted if it is replaced or the screen is left unsaved.
  const unsavedPhoto = useRef<string | undefined>(undefined);
  useEffect(
    () => () => {
      if (unsavedPhoto.current) deleteTargetPhoto(unsavedPhoto.current);
    },
    []
  );

  useEffect(() => {
    let current = true;
    targetImageRepository
      .getByDopeLogId(logId)
      .then(([saved]) => {
        if (!current || !saved) return;
        setExisting(saved);
        setBackground(backgroundOf(saved));
        setMarkers(saved.poiMarkers);
        setWidthInches(saved.targetWidthInches);
      })
      .catch((error) => console.error('Failed to load the target for log', logId, error));
    return () => {
      current = false;
    };
  }, [logId]);

  const scale = { widthInches, aspectRatio: aspectRatioOf(background) };
  const group = measureGroup(markers, scale, log ? logDistanceInYards(log) : undefined);

  const canAddByMeasurement = shotFromOffset(0, 0, scale) !== undefined;

  /** Adds the shot described by the two offsets; an empty one counts as zero. */
  const handleAddByMeasurement = () => {
    const point = shotFromOffset(rightInches ?? 0, upInches ?? 0, scale);
    if (!point) return;
    setMarkers((current) => addShot(current, point));
    setRightInches(undefined);
    setUpInches(undefined);
  };

  const discardUnsavedPhoto = () => {
    if (unsavedPhoto.current) deleteTargetPhoto(unsavedPhoto.current);
    unsavedPhoto.current = undefined;
  };

  /** Marks belong to the image they were made on, so a new background starts afresh. */
  const changeBackground = (next: TargetBackground) => {
    setBackground(next);
    setMarkers([]);
  };

  const handleChoosePhoto = async () => {
    try {
      const photo = await pickTargetPhoto();
      if (!photo) return;
      discardUnsavedPhoto();
      unsavedPhoto.current = photo.uri;
      changeBackground({ kind: 'photo', uri: photo.uri, aspectRatio: photo.aspectRatio });
    } catch (error) {
      Alert.alert(
        'Photo not used',
        error instanceof UnsupportedImageError
          ? 'Choose a JPEG or PNG photo of your target.'
          : 'That photo could not be opened.'
      );
    }
  };

  const handleUsePlainTarget = () => {
    discardUnsavedPhoto();
    changeBackground({ kind: 'bullseye' });
  };

  /** The saved target's own photo, once nothing refers to it any more. */
  const releaseSavedPhoto = (keptUri?: string) => {
    if (existing && existing.imageUri !== keptUri) deleteTargetPhoto(existing.imageUri);
  };

  const remove = async () => {
    if (!existing?.id) return;
    await targetImageRepository.delete(existing.id);
    releaseSavedPhoto();
    discardUnsavedPhoto();
  };

  const save = async () => {
    const isPhoto = background.kind === 'photo';
    const data: TargetImageData = {
      dopeLogId: logId,
      imageUri: isPhoto ? background.uri : BUILT_IN_TARGET_URI,
      targetType: isPhoto ? TARGET_TYPE.photo : TARGET_TYPE.bullseye,
      poiMarkers: markers,
      groupSize: measuredGroupSize(group),
      targetWidthInches: widthInches,
      aspectRatio: aspectRatioOf(background),
    };

    if (existing?.id) {
      await targetImageRepository.update(existing.id, data);
    } else {
      // Held at once: if the log update below fails, a second Save must
      // update this row rather than create another target for the log.
      setExisting(await targetImageRepository.create(data));
    }

    releaseSavedPhoto(data.imageUri);
    unsavedPhoto.current = undefined; // saved: it is the target's photo now

    if (data.groupSize !== undefined) await updateDopeLog(logId, { groupSize: data.groupSize });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (markers.length === 0) await remove();
      else await save();
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save the target', error);
      Alert.alert('Error', 'Failed to save the target');
    } finally {
      setSaving(false);
    }
  };

  const removing = markers.length === 0 && existing !== undefined;

  // Reachable by deep link (`logs/:logId/target`), so the id may name no log.
  // A target saved against it would fail its foreign key; say so instead.
  if (status === 'missing') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.missing, { color: colors.errorText }]}>DOPE log not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.instructions, { color: colors.text.secondary }]}>
          {background.kind === 'photo'
            ? 'Tap where each shot landed. For a size, enter the real width the photo shows, edge to edge.'
            : 'Tap where each shot landed. For a size, enter the width of your paper target.'}
        </Text>

        <TargetView
          background={background}
          markers={markers}
          onMark={(point) => setMarkers((current) => addShot(current, point))}
          testID="target-surface"
        />

        <View style={styles.row}>
          <Button
            title="Undo Last Shot"
            onPress={() => setMarkers((current) => current.slice(0, -1))}
            variant="secondary"
            disabled={markers.length === 0}
            style={styles.rowButton}
          />
          <Button
            title="Clear Shots"
            onPress={() => setMarkers([])}
            variant="secondary"
            disabled={markers.length === 0}
            style={styles.rowButton}
          />
        </View>

        <Card style={styles.card}>
          <NumberInput
            label="Target width"
            value={widthInches}
            onChangeValue={setWidthInches}
            min={0.1}
            precision={2}
            unit="inches"
          />
          <GroupStatistics group={group} testID="group-statistics" />
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Add Shot by Measurement
          </Text>
          <Text style={[styles.instructions, { color: colors.text.secondary }]}>
            {canAddByMeasurement
              ? 'Measure from the centre of the target. Use negative numbers for left and below.'
              : 'Fill in the target width above first: it is what places a measured shot.'}
          </Text>
          <NumberInput
            label="Right of centre"
            value={rightInches}
            onChangeValue={setRightInches}
            precision={2}
            unit="inches"
          />
          <NumberInput
            label="Above centre"
            value={upInches}
            onChangeValue={setUpInches}
            precision={2}
            unit="inches"
          />
          <Button
            title="Add Shot"
            onPress={handleAddByMeasurement}
            variant="secondary"
            disabled={!canAddByMeasurement}
            accessibilityHint="Marks a shot at the measured distance from the centre"
          />
        </Card>

        <View style={styles.actions}>
          {background.kind === 'photo' ? (
            <Button
              title="Use Plain Target"
              onPress={handleUsePlainTarget}
              variant="secondary"
              size="large"
            />
          ) : (
            <Button
              title="Use a Photo"
              onPress={handleChoosePhoto}
              variant="secondary"
              size="large"
              accessibilityHint="Opens your photo library to choose a picture of your target"
            />
          )}
          <Button
            title={removing ? 'Remove Target' : 'Save Target'}
            onPress={handleSave}
            variant={removing ? 'danger' : 'primary'}
            size="large"
            disabled={saving || (markers.length === 0 && !removing)}
            loading={saving}
            testID="save-target"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  instructions: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  rowButton: {
    flex: 1,
  },
  card: {
    marginTop: 16,
  },
  actions: {
    gap: 12,
    marginTop: 16,
  },
  missing: {
    fontSize: 16,
    textAlign: 'center',
    margin: 24,
  },
});
