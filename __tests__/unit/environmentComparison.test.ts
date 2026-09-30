import {
  compareEnvironments,
  describeEnvironmentDelta,
  summariseConditions,
} from '../../src/utils/environmentComparison';

/**
 * Comparing the conditions between range sessions (#62).
 *
 * The question a shooter actually asks is "why did today not match my DOPE?",
 * and the answer is usually that the air was different. The data to answer it
 * has been captured on every log since environment snapshots landed; nothing
 * reads it back.
 *
 * The comparison is deliberately opinionated about DENSITY ALTITUDE rather than
 * reporting seven independent deltas. Seven numbers is not an answer. Density
 * altitude is the one that moves the trajectory, and the individual readings are
 * there to explain where it came from.
 */

const conditions = (over: Partial<Parameters<typeof summariseConditions>[0]> = {}) => ({
  temperature: 59,
  pressure: 29.92,
  humidity: 50,
  altitude: 0,
  windSpeed: 0,
  windDirection: 0,
  ...over,
});

describe('summariseConditions', () => {
  it('reports the density altitude the snapshot recorded', () => {
    const stored = conditions({ densityAltitude: 4200 });

    expect(summariseConditions(stored).densityAltitude).toBe(4200);
  });

  it('derives one when the snapshot has none', () => {
    // Snapshots written before density altitude was stored still have the
    // inputs. Refusing to compare them would exclude a shooter's older sessions,
    // which are exactly the ones they want to look back at.
    expect(summariseConditions(conditions()).densityAltitude).toBeDefined();
  });

  it('is undefined when there is nothing to derive one from', () => {
    expect(summariseConditions(undefined).densityAltitude).toBeUndefined();
  });
});

describe('compareEnvironments', () => {
  it('reports no meaningful change between identical conditions', () => {
    const result = compareEnvironments(conditions(), conditions());

    expect(result.densityAltitudeDelta).toBe(0);
    expect(result.significant).toBe(false);
  });

  it('reports the direction of the change, not just its size', () => {
    // "800 feet different" is not actionable. "800 feet thinner" is.
    const thinner = compareEnvironments(conditions(), conditions({ temperature: 95 }));

    expect(thinner.densityAltitudeDelta).toBeGreaterThan(0);
    expect(thinner.direction).toBe('thinner');
  });

  it('calls denser air denser', () => {
    const denser = compareEnvironments(conditions(), conditions({ temperature: 10 }));

    expect(denser.densityAltitudeDelta).toBeLessThan(0);
    expect(denser.direction).toBe('denser');
  });

  it('treats a small change as not worth mentioning', () => {
    // A few degrees between two mornings is not why the shot missed. Flagging
    // every difference trains the shooter to ignore the flag.
    const result = compareEnvironments(conditions(), conditions({ temperature: 61 }));

    expect(result.significant).toBe(false);
  });

  it('flags a change large enough to move the trajectory', () => {
    const result = compareEnvironments(conditions(), conditions({ temperature: 95 }));

    expect(result.significant).toBe(true);
  });

  it('is antisymmetric: comparing the other way flips the sign', () => {
    const forwards = compareEnvironments(conditions(), conditions({ temperature: 95 }));
    const backwards = compareEnvironments(conditions({ temperature: 95 }), conditions());

    expect(backwards.densityAltitudeDelta).toBe(-(forwards.densityAltitudeDelta as number));
    expect(backwards.direction).toBe('denser');
  });

  it('keeps the individual readings, to explain where the change came from', () => {
    const result = compareEnvironments(conditions(), conditions({ temperature: 95, pressure: 29 }));

    expect(result.temperatureDelta).toBe(36);
    expect(result.pressureDelta).toBeCloseTo(-0.92, 10);
  });

  it('counts a wind change as significant on its own', () => {
    // Air unchanged, wind up 20 mph. That absolutely explains a miss, so it has
    // to raise the flag -- otherwise a session that differed only in wind reads
    // as "nothing to see here".
    const windy = compareEnvironments(conditions(), conditions({ windSpeed: 20 }));

    expect(windy.densityAltitudeDelta).toBe(0);
    expect(windy.significant).toBe(true);
  });

  it('does not count a light breeze as significant', () => {
    expect(compareEnvironments(conditions(), conditions({ windSpeed: 2 })).significant).toBe(false);
  });

  it('separates wind from air density, because they are different problems', () => {
    // Wind does not change the drop; it changes the windage. Folding it into a
    // density-altitude figure would tell the shooter to adjust elevation for a
    // crosswind.
    const windy = compareEnvironments(conditions(), conditions({ windSpeed: 20 }));

    expect(windy.densityAltitudeDelta).toBe(0);
    expect(windy.windSpeedDelta).toBe(20);
  });

  it('reports what it can when one side has no snapshot', () => {
    // Older logs have no environment. The comparison must degrade rather than
    // throw, because it will be run over a whole history.
    const result = compareEnvironments(undefined, conditions());

    expect(result.densityAltitudeDelta).toBeUndefined();
    expect(result.significant).toBe(false);
    expect(result.direction).toBe('unknown');
  });
});

describe('describeEnvironmentDelta', () => {
  it('says nothing when nothing changed', () => {
    expect(describeEnvironmentDelta(compareEnvironments(conditions(), conditions()))).toBe(
      'Conditions are effectively the same.'
    );
  });

  it('leads with the density altitude, in feet', () => {
    const line = describeEnvironmentDelta(
      compareEnvironments(conditions(), conditions({ temperature: 95 }))
    );

    expect(line).toMatch(/thinner/);
    expect(line).toMatch(/ft/);
  });

  it('says so when it cannot compare', () => {
    expect(describeEnvironmentDelta(compareEnvironments(undefined, conditions()))).toMatch(
      /no recorded conditions/i
    );
  });

  it('mentions a wind change even when the air is unchanged', () => {
    const line = describeEnvironmentDelta(
      compareEnvironments(conditions(), conditions({ windSpeed: 20 }))
    );

    expect(line).toMatch(/wind/i);
  });
});
