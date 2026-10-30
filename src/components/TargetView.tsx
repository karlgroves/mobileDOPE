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
 *
 * ## Zoom
 *
 * At full view a half-inch group on an 8.5-inch target drawn 340 points wide is
 * twenty points across, so five marks land inside one marker dot and the
 * measured spread is whatever a thumb decided. So the surface zooms, and the
 * tap is mapped back through the visible window -- `targetZoom` holds that
 * arithmetic, and it is pure because getting it wrong by a few per cent
 * produces a group that looks plausible and measures wrong.
 *
 * Pinch and drag are offered, and so are buttons. The buttons are not a
 * convenience: WCAG 2.5.1 requires a single-pointer alternative to any
 * multipoint or path-based gesture, and a shooter wearing gloves in the cold
 * has a practical claim on one too. The DOPE Curve took the same decision for
 * the same reason (`chartZoom`).
 */

import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useTheme } from '../contexts/ThemeContext';
import { aspectRatioOf } from '../utils/targetMarking';
import {
  FULL_VIEW,
  MAX_ZOOM,
  ZOOM_STEP,
  describeZoom,
  panBy,
  panByDrag,
  toFramePoint,
  toImagePoint,
  zoomAbout,
  zoomOf,
} from '../utils/targetZoom';

import type { POIMarker } from '../models/TargetImage';
import type { TargetBackground } from '../utils/targetMarking';
import type { TargetWindow } from '../utils/targetZoom';
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

/** Minimum touch target, per the repository's own 44pt floor (#68). */
const CONTROL_SIZE = 44;

const shotsLabel = (count: number): string =>
  count === 1 ? '1 shot marked' : `${count} shots marked`;

export const TargetView: React.FC<TargetViewProps> = ({ background, markers, onMark, testID }) => {
  const { colors } = useTheme().theme;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [window, setWindow] = useState<TargetWindow>(FULL_VIEW);

  const zoomed = zoomOf(window) > 1.001;

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const handlePress = (event: GestureResponderEvent) => {
    if (!onMark || size.width <= 0 || size.height <= 0) return;

    const { locationX, locationY } = event.nativeEvent;
    // Where on the frame, then where on the target: the tap is reported in the
    // frame's own points, and the frame may be showing a quarter of the image.
    const frameX = locationX / size.width;
    const frameY = locationY / size.height;
    if (frameX < 0 || frameX > 1 || frameY < 0 || frameY > 1) return;

    onMark(toImagePoint(window, frameX, frameY));
  };

  /**
   * Pinch and drag, both running on the JS thread (`runOnJS`).
   *
   * The window is React state rather than a reanimated shared value because a
   * tap has to read it to place a mark, and the marks are persisted from the
   * JS side. A shared value would need the figure in two places, which is how
   * the drawn position and the stored position come to disagree.
   *
   * Drag only takes the gesture while zoomed in; at full view there is nothing
   * off screen to pan to, and claiming the gesture there would stop the page
   * scrolling under the target -- the dead zone `useHorizontalChartPan` was
   * written to remove on the DOPE Curve.
   */
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .withTestId('target-pinch')
    // `scaleChange`, not `scale`: `scale` is cumulative from the start of the
    // pinch, and applying it to the window on every update compounds it -- a
    // gentle 1.2x pinch would run straight to the maximum.
    .onChange((event) => {
      if (size.width <= 0) return;
      setWindow((current) =>
        zoomAbout(
          current,
          event.scaleChange,
          event.focalX / size.width,
          size.height > 0 ? event.focalY / size.height : 0.5
        )
      );
    });

  const drag = Gesture.Pan()
    .runOnJS(true)
    .enabled(zoomed)
    .minPointers(1)
    .onChange((event) => {
      if (size.width <= 0 || size.height <= 0) return;
      setWindow((current) =>
        panByDrag(current, event.changeX / size.width, event.changeY / size.height)
      );
    });

  const content = (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* The image is drawn at 1/size of the frame and offset so the window's
          corner sits at the frame's. Percentages rather than a transform, so
          the drawn position is the same arithmetic the tap mapping inverts. */}
      <View
        style={{
          position: 'absolute',
          left: `${(-window.left / window.size) * 100}%`,
          top: `${(-window.top / window.size) * 100}%`,
          width: `${(1 / window.size) * 100}%`,
          height: `${(1 / window.size) * 100}%`,
        }}
        testID="target-content"
      >
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
      </View>
      {/* Markers are positioned on the frame rather than inside the scaled
          content, so a shot hole stays the same size on screen however far in
          the shooter has zoomed -- a dot that grew with the zoom would cover
          the very separation the zoom was for. */}
      {size.width > 0 &&
        markers.map((marker, index) => {
          const point = toFramePoint(window, marker.x, marker.y);
          return (
            <View
              key={`${marker.shotNumber ?? index}-${index}`}
              style={[
                styles.marker,
                {
                  left: point.x * size.width - MARKER_SIZE / 2,
                  top: point.y * size.height - MARKER_SIZE / 2,
                  backgroundColor: colors.secondary,
                  borderColor: colors.background,
                },
              ]}
            >
              <Text style={[styles.markerText, { color: colors.onSecondary }]}>
                {marker.shotNumber ?? index + 1}
              </Text>
            </View>
          );
        })}
    </View>
  );

  const frameStyle = [
    styles.frame,
    // `aspectRatio` in React Native is width over height; ours is height over width.
    { aspectRatio: 1 / aspectRatioOf(background), borderColor: colors.border },
    { backgroundColor: colors.surface },
  ];

  const surface = onMark ? (
    <Pressable
      style={frameStyle}
      onLayout={handleLayout}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Target, ${shotsLabel(markers.length)}, ${describeZoom(window)}`}
      accessibilityHint="Marks a shot where you tap. Add Shot by Measurement, below, places one without tapping."
      testID={testID}
    >
      {content}
    </Pressable>
  ) : (
    <View
      style={frameStyle}
      onLayout={handleLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Marked target, ${shotsLabel(markers.length)}, ${describeZoom(window)}`}
      accessibilityHint="The group's measurements follow the target"
      testID={testID}
    >
      {content}
    </View>
  );

  /** One zoom or pan control. */
  const control = (
    label: string,
    hint: string,
    glyph: string,
    onPress: () => void,
    disabled: boolean,
    id: string
  ) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      testID={id}
      style={[
        styles.control,
        { backgroundColor: colors.surface, borderColor: colors.border },
        disabled && styles.controlDisabled,
      ]}
    >
      <Text style={[styles.controlGlyph, { color: colors.text.primary }]}>{glyph}</Text>
    </Pressable>
  );

  return (
    <View>
      <GestureDetector gesture={Gesture.Simultaneous(pinch, drag)}>{surface}</GestureDetector>

      {/* The single-pointer alternative WCAG 2.5.1 requires, and what a shooter
          in gloves will actually use. The zoom is stated in words as well, so
          the level is not carried only by how big the target looks. */}
      <View style={styles.controls}>
        {control(
          'Zoom out',
          'Shows more of the target',
          '−',
          () => setWindow((current) => zoomAbout(current, 1 / ZOOM_STEP)),
          !zoomed,
          'target-zoom-out'
        )}
        {control(
          'Zoom in',
          'Shows less of the target, so shots close together can be told apart',
          '+',
          () => setWindow((current) => zoomAbout(current, ZOOM_STEP)),
          zoomOf(window) >= MAX_ZOOM,
          'target-zoom-in'
        )}
        <Text
          style={[styles.zoomLabel, { color: colors.text.secondary }]}
          testID="target-zoom-level"
        >
          {describeZoom(window)}
        </Text>
        {control(
          'Pan left',
          'Moves the view towards the left of the target',
          '‹',
          () => setWindow((current) => panBy(current, -1, 0)),
          !zoomed,
          'target-pan-left'
        )}
        {control(
          'Pan right',
          'Moves the view towards the right of the target',
          '›',
          () => setWindow((current) => panBy(current, 1, 0)),
          !zoomed,
          'target-pan-right'
        )}
        {control(
          'Pan up',
          'Moves the view towards the top of the target',
          '˄',
          () => setWindow((current) => panBy(current, 0, -1)),
          !zoomed,
          'target-pan-up'
        )}
        {control(
          'Pan down',
          'Moves the view towards the bottom of the target',
          '˅',
          () => setWindow((current) => panBy(current, 0, 1)),
          !zoomed,
          'target-pan-down'
        )}
        {control(
          'Show whole target',
          'Returns to the whole target at its original size',
          '⌂',
          () => setWindow(FULL_VIEW),
          !zoomed,
          'target-zoom-reset'
        )}
      </View>
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
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  control: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlDisabled: {
    opacity: 0.4,
  },
  controlGlyph: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 24,
  },
  zoomLabel: {
    fontSize: 13,
    minWidth: 88,
    textAlign: 'center',
  },
});
