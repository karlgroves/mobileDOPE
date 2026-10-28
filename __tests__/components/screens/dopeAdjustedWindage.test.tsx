import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { DOPELog } from '../../../src/models/DOPELog';
import { BallisticSolutionResults } from '../../../src/screens/BallisticSolutionResults';
import { WindTable } from '../../../src/screens/WindTable';
import { environmentRepository } from '../../../src/services/database';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useDOPEStore } from '../../../src/store/useDOPEStore';
import { useEnvironmentStore } from '../../../src/store/useEnvironmentStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { calculateBallisticSolution } from '../../../src/utils/ballistics';
import { predictWindagePerMph } from '../../../src/utils/solverInputs';
import { renderWithProviders } from '../../helpers/renderWithProviders';

import type { DOPELogData } from '../../../src/models/DOPELog';

/**
 * The windage adjusted by the shooter's own logs, on screen (#163).
 *
 * `windageAdjustment.test.ts` covers the normalisation on supplied predictions.
 * What is asserted here is the wiring: that the solution screen reaches the
 * right offset from real logs through a real solver, that the solver's own
 * figure is still available, and that the wind table can be switched between
 * the two.
 *
 * Profiles are seeded in full. With the BC or the muzzle velocity missing every
 * per-log prediction is dropped and the adjustment silently never happens, so a
 * test on a stub profile would assert nothing.
 */

/**
 * The wind table imports the charting and screenshot stack at module scope, and
 * none of it parses under jest-expo. Only the table view is exercised here, so
 * each is replaced with the smallest stand-in that lets the module load.
 */
/**
 * The solution-screen cases run the real solver once per log, which is seconds
 * rather than milliseconds. Raised deliberately rather than left to race the
 * default under load -- an existing suite in this directory has already flaked
 * that way.
 */
jest.setTimeout(60_000);

jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(() => Promise.resolve(false)) }));
const nullComponent = () => null;
jest.mock('victory-native', () => ({
  CartesianChart: nullComponent,
  Line: nullComponent,
}));

/**
 * The wind table solves 10 distances x 5 wind speeds on every render -- fifty
 * full trajectories, which took 15-40 s per test here. A linear stand-in is
 * substituted for the table generator only; `calculateCrosswindComponent` stays
 * real, because the per-mph offset is scaled by it and that scaling is the
 * behaviour under test.
 *
 * The stand-in is deliberately linear in both distance and wind speed, which is
 * what real windage is to a good approximation -- so a cell's adjusted figure is
 * checkable by hand.
 */
jest.mock('../../../src/utils/windTable', () => {
  const actual = jest.requireActual('../../../src/utils/windTable');
  return {
    ...actual,
    generateComprehensiveWindTable: (
      _rifle: unknown,
      _ammo: unknown,
      distances: number[],
      _atmosphere: unknown,
      windSpeeds: number[],
      windDirection: number
    ) =>
      distances.flatMap((distance) =>
        windSpeeds.map((windSpeed) => {
          const crosswind = actual.calculateCrosswindComponent(windSpeed, windDirection);
          const correction = (distance / 1000) * crosswind * 0.1;
          return {
            distance,
            windSpeed,
            windDirection,
            windDrift: correction * distance * 0.036,
            windageCorrection: correction,
          };
        })
      ),
  };
});

const rifle = {
  id: 1,
  name: 'Tikka T3x',
  caliber: '.308 Winchester',
  zeroDistance: 100,
  scopeHeight: 1.5,
  twistRate: '1:10',
  barrelLength: 24,
};

const ammo = {
  id: 1,
  name: 'Federal 175',
  caliber: '.308 Winchester',
  bulletWeight: 168,
  ballisticCoefficientG1: 0.462,
  ballisticCoefficientG7: 0,
  muzzleVelocity: 2650,
};

/** A snapshot with a 10 mph full-value crosswind, as both halves read it. */
const windySnapshot = {
  id: 1,
  temperature: 59,
  pressure: 29.92,
  humidity: 50,
  altitude: 0,
  densityAltitude: 0,
  windSpeed: 10,
  windDirection: 90,
};

/** The same air, dead calm. */
const calmSnapshot = { ...windySnapshot, windSpeed: 0 };

const solution = calculateBallisticSolution(
  {
    zeroDistance: 100,
    sightHeight: 1.5,
    twistRate: '1:10',
    barrelLength: 24,
    caliber: '.308 Winchester',
  },
  { bulletWeight: 168, ballisticCoefficient: 0.462, dragModel: 'G1', muzzleVelocity: 2650 },
  { distance: 500, angle: 0, windSpeed: 10, windDirection: 90 },
  { temperature: 59, pressure: 29.92, humidity: 50, altitude: 0, densityAltitude: 0 },
  false
);

/** The solver's windage per mph at 500 yd in this air -- what the logs beat. */
const PER_MPH_500 = predictWindagePerMph(rifle, ammo, 500, windySnapshot, 'MIL');

/** The fields #161's confidence reads, set to a well-shot group. */
const WELL_EVIDENCED = { shotCount: 5, hitCount: 5, groupSize: 3 };

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
    windageCorrection: PER_MPH_500 * 10,
    correctionUnit: 'MIL',
    targetType: 'steel',
    timestamp: new Date().toISOString(),
    ...WELL_EVIDENCED,
    ...over,
  } as DOPELogData);

/**
 * Logs that each dialled `extraPerMph` more windage per mph than the solver,
 * in the snapshot's own 10 mph crosswind.
 */
const windyLogs = (count: number, extraPerMph: number): DOPELog[] =>
  Array.from({ length: count }, () => log({ windageCorrection: (PER_MPH_500 + extraPerMph) * 10 }));

const seed = (logs: DOPELog[], snapshot: typeof windySnapshot = windySnapshot) => {
  useDOPEStore.setState({ dopeLogs: logs, loadDopeLogs: jest.fn(() => Promise.resolve()) });
  useEnvironmentStore.setState({ snapshots: [snapshot] as never, current: snapshot as never });
  useRifleStore.setState({ rifles: [rifle] as never });
  useAmmoStore.setState({ ammoProfiles: [ammo] as never });
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const solutionRoute = {
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
};

const renderSolution = () =>
  renderWithProviders(
    <BallisticSolutionResults route={solutionRoute as never} navigation={navigation as never} />
  );

const renderWindTable = () =>
  renderWithProviders(
    <WindTable
      route={
        { params: { rifleId: 1, ammoId: 1, distance: 500 }, key: 'w', name: 'WindTable' } as never
      }
      navigation={navigation as never}
    />
  );

/** The windage headline as rendered, to the two places the screen shows. */
const shownWindage = (view: ReturnType<typeof renderSolution>): number =>
  Number(view.getByTestId('windage-value').props.children);

beforeEach(() => {
  jest.clearAllMocks();
  nextId = 1;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest
    .spyOn(environmentRepository, 'getById')
    .mockImplementation(() => Promise.resolve(windySnapshot as never));
});

describe('the solution screen’s windage (#163)', () => {
  it('moves the headline windage towards what the logs dialled', async () => {
    // Six logs, each 0.01 MIL per mph above the solver, in 10 mph. Today is
    // also 10 mph, so the offset is 0.01 * trust * 10.
    seed(windyLogs(6, 0.01));
    const view = renderSolution();

    const solverWindage = solution.windageMIL;
    await waitFor(() => expect(shownWindage(view)).not.toBe(Number(solverWindage.toFixed(2))));
    expect(shownWindage(view)).toBeCloseTo(solverWindage + 0.01 * (6 / 7) * 10, 1);
  });

  it('labels the figure as adjusted, so the shooter knows which it is', async () => {
    seed(windyLogs(6, 0.01));
    const view = renderSolution();

    await waitFor(() => expect(view.getByText('WINDAGE (ADJUSTED)')).toBeTruthy());
  });

  it('shows the solver’s own windage and the offset beside it', async () => {
    seed(windyLogs(6, 0.01));
    const view = renderSolution();

    await waitFor(() => expect(view.getByTestId('dope-windage-offset')).toBeTruthy());
    expect(view.getByText('Solver windage:')).toBeTruthy();
    expect(view.getByTestId('dope-windage-caption').props.children).toMatch(
      /scaled from the wind each was shot in/
    );
  });

  it('returns the solver’s windage when the switch is turned off', async () => {
    seed(windyLogs(6, 0.01));
    const view = renderSolution();

    await waitFor(() => expect(view.getByText('WINDAGE (ADJUSTED)')).toBeTruthy());

    fireEvent(view.getByTestId('dope-adjust-switch'), 'valueChange', false);

    expect(shownWindage(view)).toBe(Number(solution.windageMIL.toFixed(2)));
    expect(view.getByText('WINDAGE')).toBeTruthy();
  });

  it('says it has no crosswind to scale from when today is calm', async () => {
    seed(windyLogs(6, 0.01), calmSnapshot);
    const view = renderSolution();

    await waitFor(() =>
      expect(view.getByTestId('dope-windage-caption').props.children).toMatch(
        /No crosswind to scale from/
      )
    );
    expect(shownWindage(view)).toBe(Number(solution.windageMIL.toFixed(2)));
  });

  it('says none of the logs were shot in a crosswind when they were not', async () => {
    // Plenty of logs to rank, none of them usable for windage. The two reasons
    // are answered differently -- wait for wind, or log in it -- so they are
    // reported differently.
    jest
      .spyOn(environmentRepository, 'getById')
      .mockImplementation(() => Promise.resolve(calmSnapshot as never));
    useDOPEStore.setState({ dopeLogs: windyLogs(6, 0.01) });
    useEnvironmentStore.setState({
      snapshots: [calmSnapshot] as never,
      current: windySnapshot as never,
    });
    useRifleStore.setState({ rifles: [rifle] as never });
    useAmmoStore.setState({ ammoProfiles: [ammo] as never });

    const view = renderSolution();

    await waitFor(() =>
      expect(view.getByTestId('dope-windage-caption').props.children).toMatch(
        /None of your logs were shot in a crosswind/
      )
    );
  });

  it('shows nothing about windage when there are no logs at all', async () => {
    seed([]);
    const view = renderSolution();

    await waitFor(() => expect(view.getByTestId('windage-value')).toBeTruthy());
    expect(view.queryByTestId('dope-windage')).toBeNull();
  });
});

describe('the wind table’s source toggle (#163)', () => {
  it('offers no toggle when there is no offset to apply', async () => {
    seed([]);
    const view = renderWindTable();

    await waitFor(() => expect(view.queryByText('Generating wind table...')).toBeNull());
    expect(view.queryByTestId('windage-source-note')).toBeNull();
  });

  it('shows the solver’s own figures until the shooter asks otherwise', async () => {
    seed(windyLogs(6, 0.01));
    const view = renderWindTable();

    await waitFor(() => expect(view.getByTestId('windage-source-note')).toBeTruthy());
    expect(view.getByTestId('windage-source-note').props.children).toMatch(
      /solver's own figures, with no correction/
    );
  });

  it('switches to the shooter’s own logged windage', async () => {
    seed(windyLogs(6, 0.01));
    const view = renderWindTable();

    await waitFor(() => expect(view.getByTestId('windage-source-note')).toBeTruthy());
    fireEvent.press(view.getByText('My DOPE'));

    await waitFor(() =>
      expect(view.getByTestId('windage-source-note').props.children).toMatch(
        /Adjusted by your logged windage/
      )
    );
  });

  it('says in the footer which figures are on screen', async () => {
    seed(windyLogs(6, 0.01));
    const view = renderWindTable();

    await waitFor(() => expect(view.getByTestId('windage-source-note')).toBeTruthy());
    expect(view.getByText(/solver only/)).toBeTruthy();

    fireEvent.press(view.getByText('My DOPE'));

    await waitFor(() => expect(view.getByText(/adjusted by your logged DOPE/)).toBeTruthy());
  });

  it('leaves the 0 mph column alone, because the offset is per mph', async () => {
    // The offset is scaled by each cell's own crosswind, so a column with no
    // wind in it cannot move. A flat per-row offset would shift it, which
    // would be a windage correction applied in no wind.
    seed(windyLogs(6, 0.05));
    const view = renderWindTable();

    await waitFor(() => expect(view.getByTestId('windage-source-note')).toBeTruthy());
    const zeros = () => view.getAllByText('0.00').length;
    const before = zeros();

    fireEvent.press(view.getByText('My DOPE'));

    await waitFor(() =>
      expect(view.getByTestId('windage-source-note').props.children).toMatch(/Adjusted/)
    );
    expect(zeros()).toBe(before);
  });
});
