/**
 * Marking points of impact on a target, and measuring the group they make (#63).
 *
 * `groupAnalysis.ts` holds the statistics and deliberately knows nothing about
 * scale. This is the layer between it and the target-marking screen: it turns a
 * tap into a stored position, and stored positions into inches and MOA.
 *
 * ## Positions are fractions of the image
 *
 * A mark is stored as `x` and `y` between 0 and 1 -- a fraction of the image's
 * width and of its height -- never in screen points. The same target is shown
 * at one size while marking on a phone, at another in DOPE Log Details, and at a
 * third after the device rotates; a position in points would land somewhere
 * different on each.
 *
 * The cost is that `x` and `y` are fractions of DIFFERENT lengths once the image
 * is not square. A tenth of the height of a portrait 8.5 x 11 sheet is 1.1
 * inches, and a tenth of its width is 0.85. Measuring the group therefore needs
 * the image's shape (`aspectRatio`, height over width) as well as its real width,
 * and both are stored with the target (migration 008).
 */

import { analyseGroup, scaleToInches, toMOA } from './groupAnalysis';

import type { POIMarker } from '../models/TargetImage';

/** A target's real size: the width in inches and the image's height over its width. */
export interface TargetScale {
  widthInches?: number;
  /** Height divided by width. 1 for a square image; treated as 1 when absent. */
  aspectRatio?: number;
}

/** The dispersion figures shown for a group, all in the same unit. */
export interface GroupFigures {
  extremeSpread: number;
  meanRadius: number;
  horizontalSpread: number;
  verticalSpread: number;
  circularErrorProbable: number;
}

/**
 * A measured group. `inches` is absent when there is no usable scale or no
 * shots; `moa` is absent when there are no inches or no usable distance.
 */
export interface MeasuredGroup {
  shotCount: number;
  inches?: GroupFigures;
  moa?: GroupFigures;
}

/**
 * What the shots are marked on: the plain target the app draws, or a photo.
 *
 * The built-in target is square and needs no image file. `target_images.image_uri`
 * is NOT NULL, so it is stored under `BUILT_IN_TARGET_URI`, which names no file
 * and which `deleteTargetPhoto` will never touch.
 */
export type TargetBackground =
  | { kind: 'bullseye' }
  | { kind: 'photo'; uri: string; aspectRatio: number };

export const BUILT_IN_TARGET_URI = 'builtin:bullseye';

/** `target_type` values written by the marking screen. */
export const TARGET_TYPE = { bullseye: 'bullseye', photo: 'photo' } as const;

/** The background a saved target was marked on. */
export const backgroundOf = (target: {
  targetType: string;
  imageUri: string;
  aspectRatio?: number;
}): TargetBackground =>
  target.targetType === TARGET_TYPE.photo
    ? { kind: 'photo', uri: target.imageUri, aspectRatio: target.aspectRatio ?? 1 }
    : { kind: 'bullseye' };

/** Height over width of a background: the built-in target is square. */
export const aspectRatioOf = (background: TargetBackground): number =>
  background.kind === 'photo' ? background.aspectRatio : 1;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * A tap on the marking surface, as a position on the target.
 *
 * Undefined until the surface has a real size: a tap that arrives before layout
 * would divide by zero, and a single NaN position makes every statistic of the
 * group NaN. A tap on the very edge -- a fingertip is wider than the border -- is
 * clamped onto the target rather than stored outside it.
 */
export const toTargetCoordinates = (
  locationX: number,
  locationY: number,
  width: number,
  height: number
): { x: number; y: number } | undefined => {
  if (![locationX, locationY, width, height].every(Number.isFinite)) return undefined;
  if (width <= 0 || height <= 0) return undefined;
  return { x: clamp01(locationX / width), y: clamp01(locationY / height) };
};

/**
 * The group with one more shot on it, numbered in the order it was marked.
 *
 * Numbering is by position in the list, so undoing the last shot and marking
 * again reuses its number instead of leaving a gap. Shot order matters to the
 * shooter -- a cold-bore first shot, a string walking with heat -- which is why
 * the marks carry it at all.
 */
export const addShot = (markers: POIMarker[], point: { x: number; y: number }): POIMarker[] => [
  ...markers,
  { x: point.x, y: point.y, shotNumber: markers.length + 1 },
];

const usable = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value > 0;

/**
 * A shot given as a measurement instead of a tap: inches right of and above the
 * target's centre, negative for left and below.
 *
 * The way to mark without pointing. A tap's position is the whole input, and a
 * screen reader activates the surface at its centre, so without this a
 * VoiceOver or TalkBack user could only ever mark dead centre -- a group the
 * statistics would then call 0.00 inches -- and a keyboard or switch user
 * could not place a shot at all. Undefined without a usable width, which is
 * what turns inches into a position; clamped onto the target like a tap on its
 * edge.
 */
export const shotFromOffset = (
  rightInches: number,
  upInches: number,
  scale: TargetScale
): { x: number; y: number } | undefined => {
  if (!usable(scale.widthInches) || ![rightInches, upInches].every(Number.isFinite)) {
    return undefined;
  }
  const aspect = usable(scale.aspectRatio) ? scale.aspectRatio : 1;
  return {
    x: clamp01(0.5 + rightInches / scale.widthInches),
    y: clamp01(0.5 - upInches / (scale.widthInches * aspect)),
  };
};

const mapFigures = (
  figures: GroupFigures,
  convert: (value: number) => number | undefined
): GroupFigures | undefined => {
  const entries = Object.entries(figures).map(([key, value]) => [key, convert(value)] as const);
  if (entries.some(([, value]) => value === undefined)) return undefined;
  return Object.fromEntries(entries) as unknown as GroupFigures;
};

/**
 * The group's statistics in inches, and in MOA at `distanceYards`.
 *
 * Positions are first put into one frame where the image is 1 unit wide and
 * `aspectRatio` units tall, so both axes are in the same unit; `groupAnalysis`
 * does the statistics there, and `scaleToInches` converts with the image width
 * as the reference length. No arithmetic on the group happens in this file.
 *
 * Without a usable width there are no inches at all, rather than inches at a
 * guessed scale -- see the note on `scaleToInches` about a confident, plausible,
 * wrong number.
 */
export const measureGroup = (
  markers: POIMarker[],
  scale: TargetScale,
  distanceYards?: number
): MeasuredGroup => {
  const shotCount = markers.length;
  if (shotCount === 0 || !usable(scale.widthInches)) return { shotCount };

  const widthInches = scale.widthInches;
  const aspect = usable(scale.aspectRatio) ? scale.aspectRatio : 1;
  const frame = markers.map((m) => ({ x: m.x, y: m.y * aspect, shotNumber: m.shotNumber }));
  const stats = analyseGroup(frame);

  const inches = mapFigures(
    {
      extremeSpread: stats.extremeSpread,
      meanRadius: stats.meanRadius,
      horizontalSpread: stats.horizontalSpread,
      verticalSpread: stats.verticalSpread,
      circularErrorProbable: stats.circularErrorProbable,
    },
    // One frame unit is the image width.
    (value) => scaleToInches(value, widthInches, 1)
  );
  if (!inches) return { shotCount };

  const moa =
    distanceYards === undefined
      ? undefined
      : mapFigures(inches, (value) => toMOA(value, distanceYards));

  return { shotCount, inches, moa };
};

/**
 * The group size a DOPE log should record for this group, if it has one.
 *
 * A log's `groupSize` is the conventional figure -- extreme spread, centre to
 * centre, in inches -- so that is what this returns. It needs two shots: one
 * hole has an extreme spread of zero, and writing that to the log would score a
 * single shot as the tightest group the rifle ever fired (see `dopeAnalysis`,
 * which reads `groupSize` as evidence).
 */
export const measuredGroupSize = (group: MeasuredGroup): number | undefined =>
  group.shotCount >= 2 ? group.inches?.extremeSpread : undefined;
