import {
  addShot,
  aspectRatioOf,
  backgroundOf,
  BUILT_IN_TARGET_URI,
  measureGroup,
  measuredGroupSize,
  toTargetCoordinates,
} from '../../src/utils/targetMarking';

import type { POIMarker } from '../../src/models/TargetImage';

/**
 * Marking points of impact on a target, and measuring the group they make (#63).
 *
 * The statistics themselves are `groupAnalysis`'s and are tested there. What is
 * tested here is the part that is new: turning a tap into a position that
 * survives any display size, and turning image-relative positions into inches
 * with the scale the shooter gave -- including the vertical axis of a target
 * that is not square, which is the easiest thing here to get silently wrong.
 */

const poi = (x: number, y: number, shotNumber?: number): POIMarker => ({ x, y, shotNumber });

describe('toTargetCoordinates', () => {
  it('stores a tap as a fraction of the surface, not in points', () => {
    expect(toTargetCoordinates(150, 75, 300, 300)).toEqual({ x: 0.5, y: 0.25 });
  });

  it('gives the same position for the same spot at any display size', () => {
    // A tablet and a phone showing the same target: the mark must land on the
    // same place on the paper, whatever the screen.
    expect(toTargetCoordinates(100, 200, 400, 800)).toEqual(toTargetCoordinates(25, 50, 100, 200));
  });

  it('clamps a tap on the edge of the surface onto the target', () => {
    expect(toTargetCoordinates(-3, 305, 300, 300)).toEqual({ x: 0, y: 1 });
  });

  it('refuses a tap before the surface has been measured', () => {
    // A zero-size layout would divide by zero and store NaN or Infinity, which
    // then poisons every statistic computed from the group.
    expect(toTargetCoordinates(10, 10, 0, 300)).toBeUndefined();
    expect(toTargetCoordinates(10, 10, 300, NaN)).toBeUndefined();
    expect(toTargetCoordinates(NaN, 10, 300, 300)).toBeUndefined();
  });
});

describe('addShot', () => {
  it('numbers shots in the order they were marked', () => {
    let markers: POIMarker[] = [];
    markers = addShot(markers, { x: 0.5, y: 0.5 });
    markers = addShot(markers, { x: 0.4, y: 0.6 });
    markers = addShot(markers, { x: 0.6, y: 0.4 });

    expect(markers.map((m) => m.shotNumber)).toEqual([1, 2, 3]);
  });

  it('reuses the number of a shot that was undone', () => {
    // Undo removes the last shot; the next mark is that shot again, not a gap.
    const three = addShot(addShot(addShot([], poi(0.1, 0.1)), poi(0.2, 0.2)), poi(0.3, 0.3));
    const undone = three.slice(0, -1);

    expect(addShot(undone, poi(0.9, 0.9)).map((m) => m.shotNumber)).toEqual([1, 2, 3]);
  });

  it('does not change the group it was given', () => {
    const before = [poi(0.1, 0.1, 1)];
    addShot(before, poi(0.2, 0.2));
    expect(before).toHaveLength(1);
  });
});

describe('measureGroup', () => {
  it('reports nothing in real units for a group without a scale', () => {
    // An unscaled group in screen fractions is not a group size. Reporting one
    // is how 0.05 of a phone screen ends up read as 0.05 inches.
    const group = measureGroup([poi(0.4, 0.5), poi(0.6, 0.5)], {});

    expect(group.shotCount).toBe(2);
    expect(group.inches).toBeUndefined();
    expect(group.moa).toBeUndefined();
  });

  it('reports nothing for an empty group, scale or not', () => {
    const group = measureGroup([], { widthInches: 10, aspectRatio: 1 });

    expect(group.shotCount).toBe(0);
    expect(group.inches).toBeUndefined();
  });

  it('scales by the width of the target', () => {
    // Two shots a fifth of the way apart on a 10-inch target are 2 inches apart.
    const group = measureGroup([poi(0.4, 0.5), poi(0.6, 0.5)], {
      widthInches: 10,
      aspectRatio: 1,
    });

    expect(group.inches?.extremeSpread).toBeCloseTo(2, 10);
    expect(group.inches?.horizontalSpread).toBeCloseTo(2, 10);
    expect(group.inches?.verticalSpread).toBeCloseTo(0, 10);
    expect(group.inches?.meanRadius).toBeCloseTo(1, 10);
  });

  it('measures the vertical axis of a tall target in the same inches as the horizontal', () => {
    // An 8.5 x 11 sheet photographed in portrait. A tenth of the HEIGHT is
    // 1.1 inches, not 0.85: positions are fractions of each axis, and treating
    // them as fractions of the width would shrink every vertical string.
    const group = measureGroup([poi(0.5, 0.4), poi(0.5, 0.5)], {
      widthInches: 8.5,
      aspectRatio: 11 / 8.5,
    });

    expect(group.inches?.verticalSpread).toBeCloseTo(1.1, 10);
    expect(group.inches?.extremeSpread).toBeCloseTo(1.1, 10);
  });

  it('gives every statistic groupAnalysis gives, CEP included', () => {
    const group = measureGroup([poi(0.5, 0.5), poi(0.6, 0.5), poi(0.5, 0.6), poi(0.6, 0.6)], {
      widthInches: 10,
      aspectRatio: 1,
    });

    expect(Object.keys(group.inches ?? {}).sort()).toEqual([
      'circularErrorProbable',
      'extremeSpread',
      'horizontalSpread',
      'meanRadius',
      'verticalSpread',
    ]);
    // Four shots on the corners of a 1-inch square: every shot is the same
    // distance from the centre, so CEP and mean radius are both half the diagonal.
    expect(group.inches?.circularErrorProbable).toBeCloseTo(Math.SQRT2 / 2, 10);
  });

  it('converts to MOA at the distance shot', () => {
    // 1.0472 inches at 100 yards is one true MOA.
    const group = measureGroup(
      [poi(0.4, 0.5), poi(0.5, 0.5)],
      { widthInches: 10.472, aspectRatio: 1 },
      100
    );

    expect(group.moa?.extremeSpread).toBeCloseTo(1, 10);
  });

  it('gives no MOA when the distance is unusable', () => {
    const group = measureGroup(
      [poi(0.4, 0.5), poi(0.5, 0.5)],
      { widthInches: 10, aspectRatio: 1 },
      0
    );

    expect(group.inches?.extremeSpread).toBeCloseTo(1, 10);
    expect(group.moa).toBeUndefined();
  });

  it('treats an unusable width as no scale rather than guessing one', () => {
    for (const widthInches of [0, -4, NaN, Infinity]) {
      expect(measureGroup([poi(0.4, 0.5), poi(0.6, 0.5)], { widthInches }).inches).toBeUndefined();
    }
  });
});

describe('measuredGroupSize', () => {
  it('is the extreme spread in inches, which is what a log calls group size', () => {
    const group = measureGroup([poi(0.4, 0.5), poi(0.6, 0.5)], { widthInches: 10 });
    expect(measuredGroupSize(group)).toBeCloseTo(2, 10);
  });

  it('is undefined for a single shot: one hole is not a group', () => {
    // Zero is the flattering answer -- a one-hole group -- and writing it to the
    // log would score a single shot as the tightest group the rifle ever shot.
    const group = measureGroup([poi(0.4, 0.5)], { widthInches: 10 });
    expect(measuredGroupSize(group)).toBeUndefined();
  });

  it('is undefined without a scale', () => {
    expect(measuredGroupSize(measureGroup([poi(0.4, 0.5), poi(0.6, 0.5)], {}))).toBeUndefined();
  });
});

describe('backgroundOf', () => {
  it('reads a saved photo target back as that photo, at its shape', () => {
    expect(
      backgroundOf({
        targetType: 'photo',
        imageUri: 'file:///documents/targets/a.jpg',
        aspectRatio: 1.5,
      })
    ).toEqual({ kind: 'photo', uri: 'file:///documents/targets/a.jpg', aspectRatio: 1.5 });
  });

  it('reads anything else as the built-in target, which is square', () => {
    const background = backgroundOf({ targetType: 'bullseye', imageUri: BUILT_IN_TARGET_URI });
    expect(background).toEqual({ kind: 'bullseye' });
    expect(aspectRatioOf(background)).toBe(1);
  });
});
