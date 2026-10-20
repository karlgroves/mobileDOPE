import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { DOPELog } from '../../../src/models/DOPELog';
import { BallisticSolutionResults } from '../../../src/screens/BallisticSolutionResults';
import { environmentRepository } from '../../../src/services/database';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useDOPEStore } from '../../../src/store/useDOPEStore';
import { useEnvironmentStore } from '../../../src/store/useEnvironmentStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { calculateBallisticSolution } from '../../../src/utils/ballistics';
import { NO_DATA_REASON } from '../../../src/utils/dopeAssistedElevation';
import { elevationTable } from '../../../src/utils/solverInputs';
import { renderWithProviders } from '../../helpers/renderWithProviders';

import type { DOPELogData } from '../../../src/models/DOPELog';

/**
 * The shooter's own logged DOPE appears beside the solution (#70).
 *
 * `rankMatches` was written, tested and imported by nothing. This is the test
 * that would have failed for the months it sat unwired, and the only thing worth
 * asserting at the screen level -- the scoring and the row layout are covered in
 * their own suites.
 *
 * The stores are seeded rather than mocked, so what is asserted is what a
 * shooter sees rather than which functions the screen happens to call.
 */

/**
 * A real solution rather than a hand-written object.
 *
 * The first version of this fixture invented fields and the screen threw on
 * `solution.windage.toFixed` -- a shape that never existed. Computing one keeps
 * the test honest about what the screen is actually handed.
 */
const solution = calculateBallisticSolution(
  {
    zeroDistance: 100,
    sightHeight: 1.5,
    twistRate: '1:10',
    barrelLength: 24,
    caliber: '.308 Winchester',
  },
  {
    bulletWeight: 168,
    ballisticCoefficient: 0.462,
    dragModel: 'G1',
    muzzleVelocity: 2650,
  },
  { distance: 500, angle: 0, windSpeed: 10, windDirection: 90 },
  { temperature: 59, pressure: 29.92, humidity: 50, altitude: 0, densityAltitude: 0 },
  false
);

const log = (over: Partial<DOPELogData> = {}): DOPELog =>
  new DOPELog({
    id: 1,
    rifleId: 1,
    ammoId: 1,
    environmentId: 1,
    distance: 500,
    distanceUnit: 'yards',
    elevationCorrection: 3.1,
    windageCorrection: 0.4,
    correctionUnit: 'MIL',
    targetType: 'steel',
    timestamp: new Date().toISOString(),
    ...over,
  } as DOPELogData);

const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
} as unknown as Parameters<typeof BallisticSolutionResults>[0]['navigation'];

const route = {
  params: {
    solution,
    rifleId: 1,
    ammoId: 1,
    distance: 500,
    distanceUnit: 'yards' as const,
    angularUnit: 'MIL' as const,
  },
  key: 'k',
  name: 'BallisticSolutionResults',
} as unknown as Parameters<typeof BallisticSolutionResults>[0]['route'];

/** A snapshot shaped as the matcher reads it. */
const snapshot = (id: number, densityAltitude: number) =>
  ({ id, temperature: 59, pressure: 29.92, altitude: 0, densityAltitude }) as never;

const seed = (logs: DOPELog[], snapshots: unknown[] = [], current: unknown = null): void => {
  useDOPEStore.setState({ dopeLogs: logs });
  useEnvironmentStore.setState({ snapshots: snapshots as never, current: current as never });
  useRifleStore.setState({ rifles: [{ id: 1, name: 'Tikka T3x' }] as never });
  useAmmoStore.setState({ ammoProfiles: [{ id: 1, name: 'Federal 175' }] as never });
};

describe('BallisticSolutionResults shows relevant logged DOPE', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists a log shot at the same distance with the same rifle and load', () => {
    seed([log()]);

    const { getByTestId, getByText } = renderWithProviders(
      <BallisticSolutionResults route={route} navigation={navigation} />
    );

    expect(getByText('Your logged DOPE')).toBeTruthy();
    expect(getByTestId('relevant-dope')).toBeTruthy();
    expect(getByText('500yd')).toBeTruthy();
  });

  it('says so when nothing logged is close enough', () => {
    // An empty section reads as a bug; this reads as an answer. The 2000-yard
    // log is outside the default 50-yard window around a 500-yard shot.
    seed([log({ distance: 2000 })]);

    const { getByTestId } = renderWithProviders(
      <BallisticSolutionResults route={route} navigation={navigation} />
    );

    expect(getByTestId('relevant-dope').props.children).toMatch(/No logged DOPE/);
  });

  it('excludes logs shot with a different rifle', () => {
    // The match window is distance-based, but a correction from another rifle is
    // not evidence about this one at any distance.
    seed([log({ rifleId: 99 })]);

    const { getByTestId } = renderWithProviders(
      <BallisticSolutionResults route={route} navigation={navigation} />
    );

    expect(getByTestId('relevant-dope').props.children).toMatch(/No logged DOPE/);
  });

  it('renders the section with no logs at all', () => {
    seed([]);

    const { getByTestId } = renderWithProviders(
      <BallisticSolutionResults route={route} navigation={navigation} />
    );

    expect(getByTestId('relevant-dope')).toBeTruthy();
  });

  it('matches a yard log against a metric shot', () => {
    // 800 m is 874.9 yd, so an 875-yard log is the same range. The numbers are
    // chosen so the conversion decides the outcome: unconverted, the matcher
    // looks for logs near 800 yards, and 875 is 75 away -- outside the default
    // 50-yard window. An earlier version of this test used 457 m against a
    // 500-yard log, where the raw and converted values are both inside the
    // window, so it passed with the conversion removed.
    seed([log({ distance: 875 })]);
    const metricShot = {
      ...route,
      params: { ...route.params, distance: 800, distanceUnit: 'meters' as const },
    } as typeof route;

    const { getByText } = renderWithProviders(
      <BallisticSolutionResults route={metricShot} navigation={navigation} />
    );

    expect(getByText('875yd')).toBeTruthy();
  });

  it('ranks a log shot in similar conditions above one shot in very different air', () => {
    // Logs carry an environmentId, not the conditions, so the screen joins the
    // snapshot on. Without that join both logs score neutral on the environment
    // factor and the order is decided by something else entirely.
    seed(
      [
        log({ id: 1, environmentId: 1, elevationCorrection: 9.9 }),
        log({ id: 2, environmentId: 2, elevationCorrection: 1.1 }),
      ],
      [snapshot(1, 12000), snapshot(2, 500)],
      snapshot(3, 500)
    );

    const { getByTestId } = renderWithProviders(
      <BallisticSolutionResults route={route} navigation={navigation} />
    );

    const labels = getByTestId('relevant-dope').props.children as {
      props: { accessibilityLabel: string };
    }[];

    // The log shot at 500 ft density altitude, matching today's air, comes first.
    expect(labels[0].props.accessibilityLabel).toMatch(/elevation 1\.1/);
  });

  it("ranks by conditions even when the store holds none of the logs' snapshots", async () => {
    // What the app actually has (#122): the Dashboard loads one snapshot into the
    // store, so an older log's conditions are only reachable by id. Reading
    // them from the store alone left both logs neutral on environment.
    const byId = new Map([
      [1, snapshot(1, 12000)],
      [2, snapshot(2, 500)],
    ]);
    jest
      .spyOn(environmentRepository, 'getById')
      .mockImplementation(async (id) => (byId.get(id) ?? null) as never);
    seed(
      [
        log({ id: 1, environmentId: 1, elevationCorrection: 9.9 }),
        log({ id: 2, environmentId: 2, elevationCorrection: 1.1 }),
      ],
      [],
      snapshot(3, 500)
    );

    const { getByTestId } = renderWithProviders(
      <BallisticSolutionResults route={route} navigation={navigation} />
    );

    await waitFor(() => {
      const labels = getByTestId('relevant-dope').props.children as {
        props: { accessibilityLabel: string };
      }[];
      expect(labels[0].props.accessibilityLabel).toMatch(/elevation 1\.1/);
    });
    expect(environmentRepository.getById).toHaveBeenCalledWith(1);
    expect(environmentRepository.getById).toHaveBeenCalledWith(2);
  });

  it('matches a metric log against a yard shot', () => {
    // 457 m is 500 yd. Without the unit conversion in the matcher this log would
    // read as 457 yards and fall outside the window -- which is the defect #106
    // fixed one layer down, asserted here where a shooter would notice it.
    seed([log({ distance: 457, distanceUnit: 'meters' })]);

    const { getByText } = renderWithProviders(
      <BallisticSolutionResults route={route} navigation={navigation} />
    );

    expect(getByText('457m')).toBeTruthy();
  });
});

/**
 * The solver's elevation adjusted by the shooter's own DOPE (#168).
 *
 * The screen-level half of the feature: the pure arithmetic is covered in
 * `dopeAssistedElevation.test.ts` and the layout in `DopeAdjustedElevation.test.tsx`,
 * so what is asserted here is the wiring -- that real profiles and real snapshots
 * reach the solver per log, and that the shooter can still see the unadjusted
 * figure.
 */
describe('BallisticSolutionResults adjusts the elevation by logged DOPE', () => {
  /** Profiles with the fields the solver actually reads. */
  const rifleProfile = {
    id: 1,
    name: 'Tikka T3x',
    caliber: '.308 Winchester',
    barrelLength: 24,
    twistRate: '1:10',
    zeroDistance: 100,
    scopeHeight: 1.5,
    clickValueType: 'MIL',
    clickValue: 0.1,
  };
  const ammoProfile = {
    id: 1,
    name: 'Federal 175',
    caliber: '.308 Winchester',
    bulletWeight: 168,
    ballisticCoefficientG1: 0.462,
    ballisticCoefficientG7: 0,
    muzzleVelocity: 2650,
  };

  /** A full snapshot, as the solver needs humidity too. */
  const conditions = (id: number) =>
    ({
      id,
      temperature: 59,
      humidity: 50,
      pressure: 29.92,
      altitude: 0,
      densityAltitude: 0,
      windSpeed: 0,
      windDirection: 0,
    }) as never;

  /** The solver's own elevation for a 500-yard log in those conditions. */
  const predicted = elevationTable(rifleProfile, ammoProfile, conditions(1), 500, 'MIL')(500)!;

  const seedWithProfiles = (logs: DOPELog[]): void => {
    useDOPEStore.setState({ dopeLogs: logs });
    useEnvironmentStore.setState({
      snapshots: [conditions(1)] as never,
      current: conditions(1) as never,
    });
    useRifleStore.setState({ rifles: [rifleProfile] as never });
    useAmmoStore.setState({ ammoProfiles: [ammoProfile] as never });
  };

  /** The signed number out of "Offset +0.40 MIL from 2 logs". */
  const offsetNumber = (text: string): number => Number(/([+-][\d.]+)/.exec(text)?.[1]);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the adjusted elevation beside the solver figure', () => {
    // Two logs, each dialled 0.4 MIL more than the solver predicted for them.
    // Two matches fill the weight budget, so the whole 0.4 is applied.
    seedWithProfiles([
      log({ id: 1, environmentId: 1, elevationCorrection: predicted + 0.4 }),
      log({ id: 2, environmentId: 1, elevationCorrection: predicted + 0.4 }),
    ]);

    const { getByTestId, getByText } = renderWithProviders(
      <BallisticSolutionResults route={route} navigation={navigation} />
    );

    const solver = Number(getByTestId('dope-adjustment-solver').props.children);
    const adjusted = Number(getByTestId('dope-adjustment-adjusted').props.children);
    const offset = getByTestId('dope-adjustment-offset').props.children as string;

    expect(getByText('SOLVER')).toBeTruthy();
    expect(getByText('DOPE-ADJUSTED')).toBeTruthy();
    expect(offsetNumber(offset)).toBeCloseTo(0.4, 1);
    expect(adjusted - solver).toBeCloseTo(0.4, 1);
    expect(offset).toContain('2 logs');
  });

  it('keeps the solver figure and says why when nothing is logged', () => {
    seedWithProfiles([]);

    const { getByTestId } = renderWithProviders(
      <BallisticSolutionResults route={route} navigation={navigation} />
    );

    expect(getByTestId('dope-adjustment-status').props.children).toBe(NO_DATA_REASON);
    expect(Number(getByTestId('dope-adjustment-solver').props.children)).toBeGreaterThan(0);
  });

  it('switches the adjustment off and leaves the solver value', () => {
    seedWithProfiles([
      log({ id: 1, environmentId: 1, elevationCorrection: predicted + 0.4 }),
      log({ id: 2, environmentId: 1, elevationCorrection: predicted + 0.4 }),
    ]);

    const { getByTestId, queryByText } = renderWithProviders(
      <BallisticSolutionResults route={route} navigation={navigation} />
    );
    const before = getByTestId('dope-adjustment-solver').props.children;

    fireEvent(getByTestId('dope-adjustment-switch'), 'valueChange', false);

    expect(queryByText('DOPE-ADJUSTED')).toBeNull();
    expect(getByTestId('dope-adjustment-solver').props.children).toBe(before);
    expect(getByTestId('dope-adjustment-status').props.children as string).toMatch(/not applied/i);
  });

  it('offers no adjustment when the profiles have no solver inputs', () => {
    // What the rest of this suite seeds: a rifle with a name and nothing else.
    // Predicting a log from that would be arithmetic on undefined, so the screen
    // reports no data rather than a number built out of NaN.
    seed([log({ id: 1, environmentId: 1 })], [conditions(1)], conditions(1));

    const { getByTestId } = renderWithProviders(
      <BallisticSolutionResults route={route} navigation={navigation} />
    );

    expect(getByTestId('dope-adjustment-status').props.children).toBe(NO_DATA_REASON);
  });

  it('offers no adjustment for a profile the solver cannot integrate', () => {
    // A zero muzzle velocity, or a zero ballistic coefficient, is finite and
    // nonsensical: the integrator never reaches the target and runs its full
    // 100,000 iterations, on the render path, per snapshot. Measured outside the
    // suite, that does not return. `canPredict` is what stops the solve being
    // attempted -- remove it and this test hangs rather than failing cleanly,
    // which is itself the signal.
    useDOPEStore.setState({
      dopeLogs: [log({ id: 1, environmentId: 1, elevationCorrection: 3.4 })],
    });
    useEnvironmentStore.setState({
      snapshots: [conditions(1)] as never,
      current: conditions(1) as never,
    });
    useRifleStore.setState({ rifles: [rifleProfile] as never });
    useAmmoStore.setState({
      ammoProfiles: [{ ...ammoProfile, muzzleVelocity: 0 }] as never,
    });

    const { getByTestId } = renderWithProviders(
      <BallisticSolutionResults route={route} navigation={navigation} />
    );

    expect(getByTestId('dope-adjustment-status').props.children).toBe(NO_DATA_REASON);
  });

  it('leaves a log with no recorded conditions out of the offset', () => {
    // The same rule `inputCorrections` applies: predicting an unconditioned log
    // in a standard atmosphere reads an unusual day as shooter error. Log 2 has
    // no snapshot, so only log 1 is behind the offset -- and one log is capped.
    jest.spyOn(environmentRepository, 'getById').mockResolvedValue(null as never);
    seedWithProfiles([
      log({ id: 1, environmentId: 1, elevationCorrection: predicted + 0.4 }),
      log({ id: 2, environmentId: 99, elevationCorrection: predicted + 0.4 }),
    ]);

    const { getByTestId } = renderWithProviders(
      <BallisticSolutionResults route={route} navigation={navigation} />
    );

    const offset = getByTestId('dope-adjustment-offset').props.children as string;

    expect(offset).toContain('1 log');
    expect(offset).not.toContain('2 logs');
  });
});
