import { LATITUDE_PRECISION_DP, coarsenLatitude } from '../../src/utils/geoPrecision';

/**
 * Precise coordinates are what make a location identifying. The ballistic model
 * consumes latitude only as `sin(latitude)` / `cos(latitude)` (see
 * `src/utils/coriolis.ts`), which changes ~1.7% per whole degree -- so storing
 * anything finer than a tenth of a degree buys no accuracy and costs privacy.
 *
 * See issue #44.
 */
describe('coarsenLatitude', () => {
  it('rounds to one decimal place', () => {
    expect(coarsenLatitude(38.897957)).toBe(38.9);
    expect(coarsenLatitude(-77.03656)).toBe(-77.0);
    expect(coarsenLatitude(51.4779)).toBe(51.5);
  });

  it('never returns more precision than it was given', () => {
    expect(coarsenLatitude(38.9)).toBe(38.9);
    expect(coarsenLatitude(38)).toBe(38);
  });

  it('does not emit negative zero', () => {
    // `Math.round(-0.02 * 10) / 10` is -0, which serialises to "-0" in JSON and
    // reads as a distinct value from 0.
    expect(Object.is(coarsenLatitude(-0.02), 0)).toBe(true);
  });

  it('is idempotent', () => {
    const once = coarsenLatitude(45.678901);
    expect(coarsenLatitude(once)).toBe(once);
  });

  it('preserves the poles and the equator exactly', () => {
    expect(coarsenLatitude(90)).toBe(90);
    expect(coarsenLatitude(-90)).toBe(-90);
    expect(coarsenLatitude(0)).toBe(0);
  });

  it('destroys enough precision to stop identifying a location', () => {
    // A tenth of a degree is ~11km of latitude. Two shooting positions a few
    // hundred metres apart must collapse to the same stored value.
    expect(coarsenLatitude(38.897957)).toBe(coarsenLatitude(38.901234));
  });

  it('leaves the ballistic input materially unchanged', () => {
    const precise = 38.897957;
    const coarse = coarsenLatitude(precise);
    const relativeError =
      Math.abs(Math.sin((coarse * Math.PI) / 180) - Math.sin((precise * Math.PI) / 180)) /
      Math.abs(Math.sin((precise * Math.PI) / 180));

    // Well under a tenth of a percent -- far below the model's own uncertainty.
    expect(relativeError).toBeLessThan(0.001);
  });

  it('documents the precision it applies', () => {
    expect(LATITUDE_PRECISION_DP).toBe(1);
  });
});
