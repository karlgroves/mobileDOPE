import { DEFAULT_DISTANCE_PRESETS, upgradeDistancePresets } from '../../src/utils/distancePresets';

describe('distance presets (#227)', () => {
  it('ships 100 to 1000 in 25-yard steps', () => {
    expect(DEFAULT_DISTANCE_PRESETS[0]).toBe(100);
    expect(DEFAULT_DISTANCE_PRESETS[DEFAULT_DISTANCE_PRESETS.length - 1]).toBe(1000);
    DEFAULT_DISTANCE_PRESETS.slice(1).forEach((v, i) => {
      expect(v - DEFAULT_DISTANCE_PRESETS[i]).toBe(25);
    });
  });

  it('replaces the old 100-yard default with the new one', () => {
    expect(upgradeDistancePresets([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000])).toEqual(
      DEFAULT_DISTANCE_PRESETS
    );
  });

  it('keeps a customised list, including the old default with one change', () => {
    expect(
      upgradeDistancePresets([100, 200, 300, 400, 500, 600, 650, 700, 800, 900, 1000])
    ).toEqual([100, 200, 300, 400, 500, 600, 650, 700, 800, 900, 1000]);
    expect(upgradeDistancePresets([50, 75])).toEqual([50, 75]);
  });

  it.each([undefined, null, 'x', [], [100, 'x'], [Number.NaN]])(
    'falls back to the default for %p',
    (stored) => {
      expect(upgradeDistancePresets(stored)).toEqual(DEFAULT_DISTANCE_PRESETS);
    }
  );

  it('returns a copy, so a caller cannot change the shipped default', () => {
    const presets = upgradeDistancePresets(undefined);
    presets.push(1100);
    expect(DEFAULT_DISTANCE_PRESETS).not.toContain(1100);
  });
});
