import {
  MIN_BIAS_SAMPLES,
  MIN_HEAT_SHIFT_SHOTS,
  MIN_HEAT_SHIFT_SPREAD,
  WARM_SHOT_MAX,
  WARM_SHOT_MIN,
  analyseBarrelState,
  describeColdBoreShift,
} from '../../src/utils/barrelStateAnalysis';

import type { BarrelStateSample } from '../../src/utils/barrelStateAnalysis';

/**
 * Cold-bore bias and heat shift (#165).
 *
 * Both are computed from **offsets against the solver** (#168), never from raw
 * logged elevations. That is what lets a 300-yard shot and a 600-yard shot be
 * averaged together at all: the raw elevations differ by the whole trajectory,
 * while the offsets are both "how much the solver was wrong for me". A test
 * below asserts distance is not a factor, because getting that wrong would
 * produce a confident number built from incomparable inputs.
 *
 * The other thing worth guarding is the refusal to answer. A cold-bore bias
 * computed from one cold shot is a single group's luck presented as a property
 * of the rifle, and #165 asks for a minimum that is defined and tested.
 */

const sample = (over: Partial<BarrelStateSample> = {}): BarrelStateSample => ({
  offset: 0,
  ...over,
});

/** `n` cold-bore samples, each with the given offset. */
const cold = (n: number, offset: number): BarrelStateSample[] =>
  Array.from({ length: n }, () => sample({ coldBoreShot: true, offset }));

/** `n` warm samples, spread across the warm window. */
const warm = (n: number, offset: number): BarrelStateSample[] =>
  Array.from({ length: n }, (_, i) =>
    sample({
      coldBoreShot: false,
      shotNumberInSession: WARM_SHOT_MIN + (i % (WARM_SHOT_MAX - WARM_SHOT_MIN + 1)),
      offset,
    })
  );

describe('cold-bore bias (#165)', () => {
  it('is the difference between the cold and warm means', () => {
    // Cold shots needed 0.2 MIL more than warm ones.
    const result = analyseBarrelState([...cold(3, 0.5), ...warm(3, 0.3)]);

    expect(result.coldBore).toEqual({
      bias: expect.closeTo(0.2, 10),
      coldSamples: 3,
      warmSamples: 3,
    });
  });

  it('is negative when cold shots needed less', () => {
    const result = analyseBarrelState([...cold(3, 0.1), ...warm(3, 0.4)]);

    expect(result.coldBore?.bias).toBeCloseTo(-0.3, 10);
  });

  it('combines shots from different distances, because offsets are comparable', () => {
    // The whole reason #165 works on offsets. These four would be nonsense to
    // average as raw elevations -- 300 yd and 900 yd differ by the trajectory.
    const result = analyseBarrelState([
      sample({ coldBoreShot: true, offset: 0.4 }),
      sample({ coldBoreShot: true, offset: 0.4 }),
      sample({ coldBoreShot: true, offset: 0.4 }),
      ...warm(3, 0.1),
    ]);

    expect(result.coldBore?.bias).toBeCloseTo(0.3, 10);
  });

  describe('refusing to answer', () => {
    it('says nothing with too few cold shots', () => {
      const result = analyseBarrelState([
        ...cold(MIN_BIAS_SAMPLES - 1, 0.5),
        ...warm(MIN_BIAS_SAMPLES, 0.3),
      ]);

      expect(result.coldBore).toBeUndefined();
    });

    it('says nothing with too few warm shots', () => {
      const result = analyseBarrelState([
        ...cold(MIN_BIAS_SAMPLES, 0.5),
        ...warm(MIN_BIAS_SAMPLES - 1, 0.3),
      ]);

      expect(result.coldBore).toBeUndefined();
    });

    it('says nothing when every shot is a cold bore', () => {
      // The case the issue names. There is no warm baseline to difference
      // against, and treating "no warm data" as "warm offset is zero" would
      // report the whole cold offset as bias.
      expect(analyseBarrelState(cold(10, 0.5)).coldBore).toBeUndefined();
    });

    it('needs a real minimum, not one', () => {
      expect(MIN_BIAS_SAMPLES).toBeGreaterThan(1);
    });
  });

  describe('what counts as warm', () => {
    it('only counts shots inside the warm window', () => {
      // Shot 20 of a string is hot, not warm, and must not set the baseline.
      const late = Array.from({ length: 3 }, () =>
        sample({ coldBoreShot: false, shotNumberInSession: 20, offset: 0.3 })
      );

      expect(analyseBarrelState([...cold(3, 0.5), ...late]).coldBore).toBeUndefined();
    });

    it('does not treat an unrecorded shot number as warm', () => {
      // `coldBoreShot: false` alone does not say where in the string it was,
      // so it cannot stand in for a warm-bore baseline.
      const unpositioned = Array.from({ length: 3 }, () =>
        sample({ coldBoreShot: false, offset: 0.3 })
      );

      expect(analyseBarrelState([...cold(3, 0.5), ...unpositioned]).coldBore).toBeUndefined();
    });

    it('counts an unrecorded flag at a warm position as warm, since position defines it', () => {
      // Found by mutation testing: `coldBoreShot !== true` and
      // `coldBoreShot === false` behaved identically until this existed, so
      // nothing pinned which one was intended.
      //
      // `!== true` is intended. #165 defines warm by *position* -- shots 2-5 of
      // a string -- so a shot at position 3 whose flag nobody filled in is
      // still shot 3, and its position already says what the flag would have.
      // `undefined` is never read as a cold bore; it simply does not
      // disqualify an otherwise-warm position.
      const unflaggedButPositioned = Array.from({ length: 3 }, (_, i) =>
        sample({ shotNumberInSession: WARM_SHOT_MIN + i, offset: 0.3 })
      );

      const result = analyseBarrelState([...cold(3, 0.5), ...unflaggedButPositioned]);

      expect(result.coldBore).toEqual({
        bias: expect.closeTo(0.2, 10),
        coldSamples: 3,
        warmSamples: 3,
      });
    });

    it('ignores shots with neither a barrel state nor a position', () => {
      // NULL means nobody looked (#164), and with no position either there is
      // nothing to place the shot in the string. Counting these would let 50
      // unexamined shots set the warm baseline.
      const result = analyseBarrelState([
        ...cold(3, 0.5),
        ...warm(3, 0.3),
        ...Array.from({ length: 50 }, () => sample({ offset: 99 })),
      ]);

      expect(result.coldBore).toEqual({
        bias: expect.closeTo(0.2, 10),
        coldSamples: 3,
        warmSamples: 3,
      });
    });

    it('excludes a shot flagged cold from the warm set even inside the window', () => {
      const result = analyseBarrelState([
        ...cold(3, 0.5),
        sample({ coldBoreShot: true, shotNumberInSession: 2, offset: 0.5 }),
        ...warm(3, 0.3),
      ]);

      expect(result.coldBore?.coldSamples).toBe(4);
      expect(result.coldBore?.warmSamples).toBe(3);
    });
  });
});

describe('heat shift (#165)', () => {
  /** A string of `n` shots whose offset climbs by `perShot` each time. */
  const drifting = (n: number, perShot: number, start = 0): BarrelStateSample[] =>
    Array.from({ length: n }, (_, i) =>
      sample({ shotNumberInSession: i + 1, offset: start + i * perShot })
    );

  it('recovers a known drift from a simulated 20-shot string', () => {
    const result = analyseBarrelState(drifting(20, 0.02));

    expect(result.heatShift?.perShot).toBeCloseTo(0.02, 8);
    expect(result.heatShift?.shots).toBe(20);
  });

  it('recovers a negative drift', () => {
    expect(analyseBarrelState(drifting(20, -0.015)).heatShift?.perShot).toBeCloseTo(-0.015, 8);
  });

  it('reports no drift as zero rather than as absent', () => {
    // A measured "the barrel does not walk" is a useful answer and must be
    // distinguishable from "not enough data to say".
    const result = analyseBarrelState(drifting(20, 0));

    expect(result.heatShift).toBeDefined();
    expect(result.heatShift?.perShot).toBeCloseTo(0, 10);
  });

  it('is undefined with too few shots', () => {
    expect(analyseBarrelState(drifting(MIN_HEAT_SHIFT_SHOTS - 1, 0.02)).heatShift).toBeUndefined();
  });

  it('is undefined when every shot shares a position, however many there are', () => {
    // Twenty shots all recorded as shot 3 pin no slope at all: the regression
    // would divide by a zero spread in x.
    const sameSlot = Array.from({ length: 20 }, (_, i) =>
      sample({ shotNumberInSession: 3, offset: i * 0.1 })
    );

    expect(analyseBarrelState(sameSlot).heatShift).toBeUndefined();
  });

  it('needs the shots to span several positions, not just two', () => {
    // Two distinct x values make a perfect line through two means, which looks
    // like a confident slope and is not one.
    const twoSlots = [
      ...Array.from({ length: 5 }, () => sample({ shotNumberInSession: 1, offset: 0 })),
      ...Array.from({ length: 5 }, () => sample({ shotNumberInSession: 2, offset: 0.4 })),
    ];

    expect(analyseBarrelState(twoSlots).heatShift).toBeUndefined();
    expect(MIN_HEAT_SHIFT_SPREAD).toBeGreaterThan(2);
  });

  it('ignores shots with no recorded position', () => {
    const result = analyseBarrelState([...drifting(20, 0.02), ...cold(5, 99)]);

    expect(result.heatShift?.shots).toBe(20);
    expect(result.heatShift?.perShot).toBeCloseTo(0.02, 8);
  });

  it('ignores a non-finite offset rather than producing a NaN slope', () => {
    const result = analyseBarrelState([
      ...drifting(20, 0.02),
      sample({ shotNumberInSession: 21, offset: Number.NaN }),
    ]);

    expect(Number.isFinite(result.heatShift?.perShot ?? Number.NaN)).toBe(true);
  });
});

describe('with nothing at all', () => {
  it('returns both halves undefined for an empty set', () => {
    expect(analyseBarrelState([])).toEqual({ coldBore: undefined, heatShift: undefined });
  });
});

describe('describeColdBoreShift (#165)', () => {
  it('says which way the first shot is expected to go', () => {
    // The issue's own wording. "Low" means the shot lands low, so more
    // elevation was dialled -- a positive bias.
    expect(describeColdBoreShift({ bias: 0.15, coldSamples: 4, warmSamples: 6 }, 'MIL')).toBe(
      'Expected cold-bore shift: 0.15 MIL low'
    );
  });

  it('says high for a negative bias', () => {
    expect(describeColdBoreShift({ bias: -0.2, coldSamples: 4, warmSamples: 6 }, 'MIL')).toBe(
      'Expected cold-bore shift: 0.20 MIL high'
    );
  });

  it('reads in the unit it was given', () => {
    expect(describeColdBoreShift({ bias: 0.5, coldSamples: 4, warmSamples: 6 }, 'MOA')).toContain(
      'MOA'
    );
  });

  it('says there is no measurable shift rather than printing a signed zero', () => {
    const flat = describeColdBoreShift({ bias: 0, coldSamples: 4, warmSamples: 6 }, 'MIL');

    expect(flat).toMatch(/no measurable/i);
    expect(flat).not.toContain('-0.00');
  });

  it('does not call a shift measurable when it rounds to nothing', () => {
    // 0.004 MIL prints as "0.00 MIL low", which claims a direction the data
    // does not support at the precision shown.
    expect(describeColdBoreShift({ bias: 0.004, coldSamples: 4, warmSamples: 6 }, 'MIL')).toMatch(
      /no measurable/i
    );
  });
});
