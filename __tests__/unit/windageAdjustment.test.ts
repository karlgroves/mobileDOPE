import { DOPELog } from '../../src/models/DOPELog';
import {
  MIN_CROSSWIND_MPH,
  NO_CROSSWIND_REASON,
  NO_WINDY_LOGS_REASON,
  adjustWindage,
  windageCaption,
} from '../../src/utils/windageAdjustment';
import { calculateCrosswindComponent } from '../../src/utils/windTable';

import type { DOPELogData } from '../../src/models/DOPELog';
import type { Match } from '../../src/utils/dopeMatching';

/**
 * Windage offsets normalised by the crosswind each log was shot in (#163).
 *
 * The elevation half (#168) averages offsets directly. Windage cannot: a log
 * shot in 4 mph of crosswind and one shot in 15 say the same thing about the
 * rifle and quite different things about the turret. So every offset is divided
 * by the crosswind it was measured in before anything is averaged, and the mean
 * multiplied by today's.
 *
 * The solver is not involved. Predictions are supplied, which is what lets a
 * test state a per-mph error exactly and then assert the arithmetic recovers it.
 */

let nextId = 1;

const log = (over: Partial<DOPELogData> = {}): DOPELog =>
  new DOPELog({
    id: nextId++,
    rifleId: 1,
    ammoId: 1,
    environmentId: 1,
    distance: 500,
    distanceUnit: 'yards',
    elevationCorrection: 3.1,
    windageCorrection: 0.5,
    correctionUnit: 'MIL',
    targetType: 'steel',
    ...over,
  } as DOPELogData);

const match = (entry: DOPELog, score = 1): Match<DOPELog> =>
  ({ log: entry, score }) as Match<DOPELog>;

/** The solver says 0.05 MIL of windage per mph of crosswind, at any distance. */
const PER_MPH = 0.05;
const predict = () => PER_MPH;

/** Each log was shot in the same crosswind, which the test names. */
const inWind = (mph: number) => () => mph;

beforeEach(() => {
  nextId = 1;
});

describe('adjustWindage normalisation (#163)', () => {
  it('recovers a per-mph error stated in one log', () => {
    // 10 mph of crosswind, solver says 0.50 MIL, shooter dialled 0.60. The
    // error is 0.10 MIL over 10 mph, so 0.01 MIL per mph.
    const result = adjustWindage(
      [match(log({ windageCorrection: 0.6 }))],
      predict,
      inWind(10),
      10,
      0.5,
      'MIL'
    );

    expect(result.rawOffsetPerMph).toBeCloseTo(0.01, 10);
    expect(result.contributions).toHaveLength(1);
  });

  it('gives two logs shot in different winds the same per-mph offset', () => {
    // The whole point. A log in 5 mph that needed 0.05 MIL more, and one in
    // 20 mph that needed 0.20 MIL more, are the *same* measurement: 0.01 MIL
    // per mph. Averaging the raw offsets would give 0.125, which is a figure
    // about neither log.
    const result = adjustWindage(
      [
        match(log({ windageCorrection: PER_MPH * 5 + 0.05 })),
        match(log({ windageCorrection: PER_MPH * 20 + 0.2 })),
      ],
      predict,
      (entry) => (entry.id === 1 ? 5 : 20),
      10,
      0.5,
      'MIL'
    );

    expect(result.contributions.map((c) => c.offsetPerMph)).toEqual([
      expect.closeTo(0.01, 10),
      expect.closeTo(0.01, 10),
    ]);
    expect(result.rawOffsetPerMph).toBeCloseTo(0.01, 10);
  });

  it('weights the mean by relevance', () => {
    const result = adjustWindage(
      [
        match(log({ windageCorrection: PER_MPH * 10 + 0.3 }), 1),
        match(log({ windageCorrection: PER_MPH * 10 + 0.1 }), 0.25),
      ],
      predict,
      inWind(10),
      10,
      0.5,
      'MIL'
    );

    // Offsets per mph are 0.03 and 0.01, weighted 1 and 0.25.
    expect(result.rawOffsetPerMph).toBeCloseTo((0.03 * 1 + 0.01 * 0.25) / 1.25, 10);
  });

  it('converts a log recorded in MOA before comparing it', () => {
    // 3.4377 MOA is 1 MIL. Dialled 1 MIL where the solver asked for 0.5, in
    // 10 mph, so the per-mph error is 0.05 MIL.
    const result = adjustWindage(
      [match(log({ windageCorrection: 3.43774677, correctionUnit: 'MOA' }))],
      predict,
      inWind(10),
      10,
      0.5,
      'MIL'
    );

    expect(result.rawOffsetPerMph).toBeCloseTo(0.05, 5);
  });
});

describe('adjustWindage scaling to today (#163)', () => {
  const tenLogs = () =>
    Array.from({ length: 6 }, () => match(log({ windageCorrection: PER_MPH * 10 + 0.1 })));

  it('scales a measured per-mph offset up to a stronger wind', () => {
    // Per-mph offset is 0.01. With six logs at score 1, trust is 6/7.
    const result = adjustWindage(tenLogs(), predict, inWind(10), 20, 1.0, 'MIL');

    expect(result.offset).toBeCloseTo(0.01 * (6 / 7) * 20, 10);
    expect(result.adjustedWindage).toBeCloseTo(1.0 + result.offset, 10);
  });

  it('scales the same offset down in a lighter wind', () => {
    const strong = adjustWindage(tenLogs(), predict, inWind(10), 20, 1.0, 'MIL');
    const light = adjustWindage(tenLogs(), predict, inWind(10), 5, 0.25, 'MIL');

    expect(light.offset).toBeCloseTo(strong.offset / 4, 10);
  });

  it('reverses the correction when today’s wind is from the other side', () => {
    // The crosswind convention is signed, so a wind from the opposite side
    // flips the scaled offset -- which is what the bullet does.
    const right = adjustWindage(tenLogs(), predict, inWind(10), 10, 0.5, 'MIL');
    const left = adjustWindage(tenLogs(), predict, inWind(10), -10, -0.5, 'MIL');

    expect(left.offset).toBeCloseTo(-right.offset, 10);
  });

  it('damps a single log more than six agreeing ones', () => {
    const one = adjustWindage(
      [match(log({ windageCorrection: PER_MPH * 10 + 0.1 }))],
      predict,
      inWind(10),
      10,
      0.5,
      'MIL'
    );
    const six = adjustWindage(tenLogs(), predict, inWind(10), 10, 0.5, 'MIL');

    expect(one.trust).toBeCloseTo(0.5, 10);
    expect(six.trust).toBeCloseTo(6 / 7, 10);
    expect(Math.abs(one.offset)).toBeLessThan(Math.abs(six.offset));
    // The curve never reaches 1, so the solver always keeps a share.
    expect(six.trust).toBeLessThan(1);
  });
});

describe('adjustWindage angle conversion (#163)', () => {
  it('uses the app’s own crosswind convention, not a second copy of it', () => {
    // The crosswind fed in here comes from `calculateCrosswindComponent`,
    // which is what `windTable.ts` and the solver use. A 15 mph wind at 90
    // degrees is full value; at 30 degrees it is half.
    const full = calculateCrosswindComponent(15, 90);
    const half = calculateCrosswindComponent(15, 30);

    expect(full).toBeCloseTo(15, 10);
    expect(half).toBeCloseTo(7.5, 10);

    // A log shot in the half-value wind and one in the full-value wind, each
    // needing 0.01 MIL per mph more than the solver, agree.
    const result = adjustWindage(
      [
        match(log({ windageCorrection: PER_MPH * full + 0.01 * full })),
        match(log({ windageCorrection: PER_MPH * half + 0.01 * half })),
      ],
      predict,
      (entry) => (entry.id === 1 ? full : half),
      10,
      0.5,
      'MIL'
    );

    expect(result.rawOffsetPerMph).toBeCloseTo(0.01, 10);
  });
});

describe('adjustWindage refuses to divide by no wind (#163)', () => {
  it('leaves out a log shot in dead air', () => {
    const result = adjustWindage(
      [
        match(log({ windageCorrection: 9.9 })),
        match(log({ windageCorrection: PER_MPH * 10 + 0.1 })),
      ],
      predict,
      (entry) => (entry.id === 1 ? 0 : 10),
      10,
      0.5,
      'MIL'
    );

    expect(result.contributions).toHaveLength(1);
    expect(result.rawOffsetPerMph).toBeCloseTo(0.01, 10);
  });

  it('leaves out a log shot with the wind at 6 o’clock, which is not zero', () => {
    // `calculateCrosswindComponent(15, 180)` is 1.8e-15, not 0. An equality
    // test against zero would let it through and the offset would come out
    // around 1e15 per mph, obliterating every other log.
    const tailwind = calculateCrosswindComponent(15, 180);
    expect(tailwind).not.toBe(0);
    expect(Math.abs(tailwind)).toBeLessThan(MIN_CROSSWIND_MPH);

    const result = adjustWindage(
      [
        match(log({ windageCorrection: 9.9 })),
        match(log({ windageCorrection: PER_MPH * 10 + 0.1 })),
      ],
      predict,
      (entry) => (entry.id === 1 ? tailwind : 10),
      10,
      0.5,
      'MIL'
    );

    expect(result.contributions).toHaveLength(1);
    expect(Math.abs(result.rawOffsetPerMph)).toBeLessThan(1);
  });

  it('leaves out a log whose crosswind is below the threshold', () => {
    const result = adjustWindage(
      [match(log())],
      predict,
      inWind(MIN_CROSSWIND_MPH - 0.01),
      10,
      0.5,
      'MIL'
    );

    expect(result.reason).toBe(NO_WINDY_LOGS_REASON);
    expect(result.offset).toBe(0);
  });

  it('leaves out a log whose wind was never recorded', () => {
    const result = adjustWindage([match(log())], predict, () => undefined, 10, 0.5, 'MIL');

    expect(result.reason).toBe(NO_WINDY_LOGS_REASON);
  });

  it('returns the solver’s figure, with its own reason, in no wind today', () => {
    const result = adjustWindage([match(log())], predict, inWind(10), 0, 0.5, 'MIL');

    expect(result.reason).toBe(NO_CROSSWIND_REASON);
    expect(result.adjustedWindage).toBe(0.5);
    expect(result.contributions).toHaveLength(0);
  });

  it('distinguishes no wind today from no windy logs', () => {
    // Both end in the solver's figure, and the shooter is entitled to know
    // which applied: one is answered by waiting for wind, the other by
    // logging in it.
    const noWindToday = adjustWindage([match(log())], predict, inWind(10), 0, 0.5, 'MIL');
    const noWindyLogs = adjustWindage([match(log())], predict, inWind(0), 10, 0.5, 'MIL');

    expect(noWindToday.reason).not.toBe(noWindyLogs.reason);
  });

  it('drops a log the solver cannot predict rather than calling its offset zero', () => {
    const result = adjustWindage([match(log())], () => undefined, inWind(10), 10, 0.5, 'MIL');

    expect(result.reason).toBe(NO_WINDY_LOGS_REASON);
    expect(result.contributions).toHaveLength(0);
  });

  it('ignores a match scored zero', () => {
    const result = adjustWindage([match(log(), 0)], predict, inWind(10), 10, 0.5, 'MIL');

    expect(result.contributions).toHaveLength(0);
  });

  it('survives a non-finite wind without returning NaN', () => {
    const result = adjustWindage([match(log())], predict, inWind(10), Number.NaN, 0.5, 'MIL');

    expect(result.adjustedWindage).toBe(0.5);
    expect(result.crosswind).toBe(0);
  });
});

describe('windageCaption (#163)', () => {
  it('names the wind it scaled to, and how many logs it used', () => {
    expect(windageCaption(4, 12.3)).toBe(
      "Based on 4 logs, scaled from the wind each was shot in to today's 12.3 mph crosswind."
    );
  });

  it('reads a wind from the other side as a crosswind, not a negative one', () => {
    expect(windageCaption(1, -8)).toBe(
      "Based on 1 log, scaled from the wind each was shot in to today's 8.0 mph crosswind."
    );
  });
});
