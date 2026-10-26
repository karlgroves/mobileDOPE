/**
 * A target with its points of impact marked on it (#63).
 *
 * Draws the background -- the app's plain built-in target or the shooter's photo
 * -- at the image's own shape, and each marked shot as a numbered dot. With
 * `onMark` it is the marking surface: a tap reports where on the target it
 * landed, as fractions of the width and height (`toTargetCoordinates`). Without
 * it, it is a read-only picture of a saved group, as in DOPE Log Details.
 *
 * Everything drawn on top of the surface ignores touches, so a tap is always
 * reported relative to the surface itself; a tap on top of a ring or an earlier
 * shot would otherwise be measured from that child's corner instead.
 */

import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import { aspectRatioOf, toTargetCoordinates } from '../utils/targetMarking';

import type { POIMarker } from '../models/TargetImage';
import type { TargetBackground } from '../utils/targetMarking';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';

interface TargetViewProps {
  background: TargetBackground;
  markers: POIMarker[];
  /** Makes the target a marking surface; called with the tapped position. */
  onMark?: (point: { x: number; y: number }) => void;
  testID?: string;
}

/** Ring diameters of the built-in target, as fractions of its width. */
const RINGS = [1, 0.8, 0.6, 0.4, 0.2];
const MARKER_SIZE = 24;

const shotsLabel = (count: number): string =>
  count === 1 ? '1 shot marked' : `${count} shots marked`;

export const TargetView: React.FC<TargetViewProps> = ({ background, markers, onMark, testID }) => {
  const { colors } = useTheme().theme;
  const [size, setSize] = useState({ width: 0, height: 0 });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const handlePress = (event: GestureResponderEvent) => {
    const point = toTargetCoordinates(
      event.nativeEvent.locationX,
      event.nativeEvent.locationY,
      size.width,
      size.height
    );
    if (point && onMark) onMark(point);
  };

  const frameStyle = [
    styles.frame,
    // `aspectRatio` in React Native is width over height; ours is height over width.
    { aspectRatio: 1 / aspectRatioOf(background), borderColor: colors.border },
    { backgroundColor: colors.surface },
  ];

  const content = (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {background.kind === 'photo' ? (
        <Image
          source={{ uri: background.uri }}
          // The frame already has the photo's shape, so stretch is an exact fit.
          resizeMode="stretch"
          style={StyleSheet.absoluteFill}
          testID="target-photo"
          accessibilityIgnoresInvertColors
        />
      ) : (
        RINGS.map((fraction, index) => (
          <View
            key={fraction}
            style={[
              styles.ring,
              {
                width: `${fraction * 100}%`,
                left: `${(1 - fraction) * 50}%`,
                top: `${(1 - fraction) * 50}%`,
                borderColor: colors.text.secondary,
              },
              index === RINGS.length - 1 && { backgroundColor: colors.text.secondary },
            ]}
          />
        ))
      )}
      {size.width > 0 &&
        markers.map((marker, index) => (
          <View
            key={`${marker.shotNumber ?? index}-${index}`}
            style={[
              styles.marker,
              {
                left: marker.x * size.width - MARKER_SIZE / 2,
                top: marker.y * size.height - MARKER_SIZE / 2,
                backgroundColor: colors.secondary,
                borderColor: colors.background,
              },
            ]}
          >
            <Text style={[styles.markerText, { color: colors.onSecondary }]}>
              {marker.shotNumber ?? index + 1}
            </Text>
          </View>
        ))}
    </View>
  );

  if (onMark) {
    return (
      <Pressable
        style={frameStyle}
        onLayout={handleLayout}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Target, ${shotsLabel(markers.length)}`}
        accessibilityHint="Marks a shot where you tap"
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={frameStyle}
      onLayout={handleLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Marked target, ${shotsLabel(markers.length)}`}
      accessibilityHint="The group's measurements follow the target"
      testID={testID}
    >
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    aspectRatio: 1,
    borderWidth: 2,
    borderRadius: 9999,
  },
  marker: {
    position: 'absolute',
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
