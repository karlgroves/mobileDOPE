import React from 'react';

import { DOPELog } from '../../../src/models/DOPELog';
import { BallisticSolutionResults } from '../../../src/screens/BallisticSolutionResults';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useDOPEStore } from '../../../src/store/useDOPEStore';
import { useEnvironmentStore } from '../../../src/store/useEnvironmentStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { calculateBallisticSolution } from '../../../src/utils/ballistics';
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
