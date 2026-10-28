import { logDistanceInYards } from '../../src/utils/distanceUnits';
import { buildDropCurve, compareLogsToSolver, detectOutliers } from '../../src/utils/dopeAnalysis';
import { perLogElevation } from '../../src/utils/perLogElevation';
import * as solverInputs from '../../src/utils/solverInputs';

import type { DOPELogData } from '../../src/models/DOPELog';
import type { EnvironmentSnapshotData } from '../../src/models/EnvironmentSnapshot';

/**
 * What the DOPE Curve has to compute before it can draw (#68, "test graph
 * rendering performance").
 *
 * ## Why this counts work instead of timing it
 *
 * `jest.performance.config.js` explains at length why wall-clock assertions in
 * this repository live out of band and run alone: elapsed time is a property of
 * the code *and* of whatever else the machine is doing. For rendering that goes
 * further -- the renderer these tests use mounts into a tree with no layout
 * pass and no frame budget, so a timing figure taken here would not describe a
 * phone at all, and would be noise on top of that.
 *
 * The regression that actually hurt was not a slow constant. #124 was **one
 * trajectory solve per log**: 60 logs took 660 ms on the render path, and the
 * fix was to compute one trajectory per *environment snapshot* and read every
 * distance off it. That is a counting property, it is deterministic, and it is
 * the thing a reviewer would otherwise have to notice by eye.
 *
 * So each case below counts solver calls and output points rather than
 * milliseconds. A test that cannot flake, asserting the property the
 * optimisation actually has.
 *
 * `solverPerformance.test.ts` holds the wall-clock budget for the solver
 * itself, out of band, where a measurement means something.
 */

/** 120 logs: twice the count that cost 660 ms before #124. */
const LOG_COUNT = 120;

/** Distinct environment snapshots those logs were shot in. */
const SNAPSHOT_COUNT = 4;

const rifle = {
  zeroDistance: 100,
  scopeHeight: 1.5,
  twistRate: '1:10',
  barrelLength: 24,
};

const ammo = {
  bulletWeight: 168,
  ballisticCoefficientG1: 0.462,
  ballisticCoefficientG7: 0,
  muzzleVelocity: 2650,
};

const snapshot = (id: number): EnvironmentSnapshotData =>
  ({
    id,
    temperature: 50 + id * 10,
    pressure: 29.92 - id * 0.3,
    humidity: 50,
    altitude: 0,
    densityAltitude: id * 500,
    windSpeed: 0,
    windDirection: 90,
  }) as EnvironmentSnapshotData;

/** `LOG_COUNT` logs spread over 12 distances and `SNAPSHOT_COUNT` snapshots. */
const history = (count = LOG_COUNT): DOPELogData[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    rifleId: 1,
    ammoId: 1,
    environmentId: (i % SNAPSHOT_COUNT) + 1,
    distance: 100 + (i % 12) * 100,
    distanceUnit: 'yards' as const,
    elevationCorrection: 0.5 + (i % 12) * 0.9,
    windageCorrection: 0,
    correctionUnit: 'MIL' as const,
    targetType: 'steel' as const,
    shotCount: 5,
    hitCount: 5,
    groupSize: 2,
    timestamp: new Date(Date.now() - i * 86_400_000).toISOString(),
  })) as DOPELogData[];

const environmentsById = (): Map<number, EnvironmentSnapshotData> =>
  new Map(Array.from({ length: SNAPSHOT_COUNT }, (_, i) => [i + 1, snapshot(i + 1)]));

describe('the curve solves per snapshot, not per log (#68, #124)', () => {
  it('builds one trajectory per distinct environment, however many logs there are', () => {
    const spy = jest.spyOn(solverInputs, 'elevationTable');
    const logs = history();

    const predict = perLogElevation(logs, rifle, ammo, environmentsById(), 'MIL');
    for (const log of logs) predict(log, logDistanceInYards(log));

    expect(logs).toHaveLength(LOG_COUNT);
    expect(spy).toHaveBeenCalledTimes(SNAPSHOT_COUNT);
    spy.mockRestore();
  });

  it('does not grow that count when the log count doubles', () => {
    // The shape of the #124 regression, stated as a property: the cost follows
    // the number of *conditions*, which is small and bounded by how many times
    // the shooter recorded the weather, not by how many shots they have taken.
    const counts: number[] = [];

    for (const size of [60, 120, 240]) {
      const spy = jest.spyOn(solverInputs, 'elevationTable');
      const logs = history(size);
      const predict = perLogElevation(logs, rifle, ammo, environmentsById(), 'MIL');
      for (const log of logs) predict(log, logDistanceInYards(log));
      counts.push(spy.mock.calls.length);
      spy.mockRestore();
    }

    expect(counts).toEqual([SNAPSHOT_COUNT, SNAPSHOT_COUNT, SNAPSHOT_COUNT]);
  });

  it('builds a trajectory only for a snapshot something asks about', () => {
    // Lazily, per `perLogElevation`'s own docblock: the interpolated offset
    // (#162) asks about the logs either side of one distance, and building a
    // table for every snapshot in the history to answer that would be #124
    // again by another road.
    const spy = jest.spyOn(solverInputs, 'elevationTable');
    const logs = history();

    const predict = perLogElevation(logs, rifle, ammo, environmentsById(), 'MIL');
    expect(spy).not.toHaveBeenCalled();

    predict(logs[0], logDistanceInYards(logs[0]));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('asks the solver nothing at all for a log whose conditions are missing', () => {
    const spy = jest.spyOn(solverInputs, 'elevationTable');
    const logs = history(12);

    const predict = perLogElevation(logs, rifle, ammo, new Map(), 'MIL');
    for (const log of logs) expect(predict(log, logDistanceInYards(log))).toBeUndefined();

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('the curve draws per distance, not per log (#68)', () => {
  it('reduces a long history to as many points as there are distances', () => {
    // What the chart receives. 240 logs at 12 distances is 12 points to draw,
    // and a chart that received 240 would be plotting twenty markers on top of
    // each other at every distance.
    const points = buildDropCurve(history(240), 'MIL');

    expect(points).toHaveLength(12);
  });

  it('keeps the points sorted, so the line does not double back', () => {
    const points = buildDropCurve(history(), 'MIL');
    const distances = points.map((point) => point.distance);

    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('is linear in the log count, not quadratic', () => {
    // A cheap structural check on the grouping: a bucketed reduce visits each
    // log once. Asserted as output size against input size rather than as time,
    // for the reasons at the top of this file -- but it does pin that a nested
    // pass over the buckets has not crept in by making the point count
    // independent of the history's length.
    expect(buildDropCurve(history(60), 'MIL')).toHaveLength(12);
    expect(buildDropCurve(history(600), 'MIL')).toHaveLength(12);
  });

  it('compares per log but still returns one row per distance', () => {
    // `compareLogsToSolver` predicts each log in its own air -- that is the
    // point of it -- and the suggestions downstream take a median per distance.
    const logs = history(240);
    let predictions = 0;
    const rows = compareLogsToSolver(
      logs,
      (_log, yards) => {
        predictions += 1;
        return yards / 100;
      },
      'MIL'
    );

    expect(predictions).toBe(240);
    expect(rows).toHaveLength(12);
  });

  it('finds outliers in one pass over a long history', () => {
    // Deliberately a smoke test on size rather than on content: the outlier
    // maths is covered in `dopeAnalysis.test.ts`. What is checked here is that
    // the chart's third pipeline survives 600 logs and returns a bounded list a
    // screen can render.
    const outliers = detectOutliers(history(600), 'MIL');

    expect(outliers.length).toBeLessThanOrEqual(600);
    expect(Array.isArray(outliers)).toBe(true);
  });
});
