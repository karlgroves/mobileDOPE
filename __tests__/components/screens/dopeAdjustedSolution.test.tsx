import { fireEvent, waitFor } from '@testing-library/react-native';
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
 * The solution adjusted by the shooter's own DOPE, on screen (#168).
 *
 * The arithmetic is covered in `dopeAdjustment.test.ts`. What is asserted here
 * is the part a unit test cannot see: that the screen actually wires the
 * matcher to the adjuster, that the solver's own figure stays visible however
 * the switch is set, and that turning the switch off really does return the
 * solver's number rather than relabelling the adjusted one.
 *
 * Profiles are seeded in full. The solver reads `zeroDistance`, `scopeHeight`,
 * `twistRate`, `barrelLength`, `bulletWeight`, the BCs and `muzzleVelocity`,
 * and with those missing every per-log prediction is dropped and the
 * adjustment silently never happens -- a test that passed on a stub would be
 * asserting nothing.
 */

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

const solverElevation = solution.elevationMIL;

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

/** A snapshot shaped as both the matcher and the solver read it. */
const snapshot = (id: number) =>
  ({
    id,
    temperature: 59,
    pressure: 29.92,
    humidity: 50,
    altitude: 0,
    densityAltitude: 0,
  }) as never;

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

const seed = (logs: DOPELog[]): void => {
  useDOPEStore.setState({ dopeLogs: logs });
  useEnvironmentStore.setState({
    snapshots: [snapshot(1), snapshot(2), snapshot(3)] as never,
    current: snapshot(1) as never,
  });
  useRifleStore.setState({ rifles: [rifle] as never });
  useAmmoStore.setState({ ammoProfiles: [ammo] as never });
};

const render = () =>
  renderWithProviders(<BallisticSolutionResults route={route} navigation={navigation} />);

/**
 * The headline elevation as rendered, which is `toFixed(2)` -- so assertions
 * against it compare to two places. Reading the underlying float would be
 * asserting something the shooter never sees.
 */
const shown = (screen: ReturnType<typeof render>): number =>
  Number(screen.getByTestId('elevation-value').props.children);

/** `solverElevation` rounded the way the screen rounds it. */
const SOLVER_SHOWN = Number(solverElevation.toFixed(2));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DOPE-adjusted elevation on the solution screen (#168)', () => {
  it('moves the headline elevation away from the solver when logs disagree with it', async () => {
    // Three logs at this distance, all dialled well above what the solver says
    // for these conditions. The headline must move toward them.
    seed([
      log({ id: 1, elevationCorrection: solverElevation + 0.5 }),
      log({ id: 2, elevationCorrection: solverElevation + 0.5, environmentId: 2 }),
      log({ id: 3, elevationCorrection: solverElevation + 0.5, environmentId: 3 }),
    ]);

    const screen = render();

    await waitFor(() => {
      expect(screen.getByTestId('dope-adjustment-summary')).toBeTruthy();
    });
    expect(shown(screen)).toBeGreaterThan(solverElevation);
    expect(shown(screen)).toBeLessThanOrEqual(solverElevation + 0.5);
    expect(screen.getByText('ELEVATION (ADJUSTED)')).toBeTruthy();
  });

  it('keeps the solver’s own figure on screen beside it', async () => {
    seed([log({ elevationCorrection: solverElevation + 0.5 })]);

    const screen = render();

    await waitFor(() => {
      expect(screen.getByTestId('dope-adjustment-summary')).toBeTruthy();
    });
    expect(screen.getByText('Solver alone:')).toBeTruthy();
    expect(screen.getByText(`${solverElevation.toFixed(2)} MIL`)).toBeTruthy();
  });

  it('says how many logs are behind it', async () => {
    seed([
      log({ id: 1, elevationCorrection: solverElevation + 0.4 }),
      log({ id: 2, elevationCorrection: solverElevation + 0.4, environmentId: 2 }),
    ]);

    const screen = render();

    await waitFor(() => {
      expect(screen.getByText('Based on 2 logs from similar conditions.')).toBeTruthy();
    });
  });

  it('says "log", singular, for one', async () => {
    seed([log({ elevationCorrection: solverElevation + 0.4 })]);

    const screen = render();

    await waitFor(() => {
      expect(screen.getByText('Based on 1 log from similar conditions.')).toBeTruthy();
    });
  });

  it('returns the solver’s number when the switch is turned off', async () => {
    seed([log({ elevationCorrection: solverElevation + 0.5 })]);

    const screen = render();
    await waitFor(() => {
      expect(screen.getByTestId('dope-adjustment-summary')).toBeTruthy();
    });
    const adjusted = shown(screen);

    fireEvent(screen.getByTestId('dope-adjust-switch'), 'valueChange', false);

    await waitFor(() => {
      expect(screen.getByText('Adjustment off. Showing the solver alone.')).toBeTruthy();
    });
    expect(shown(screen)).toBe(SOLVER_SHOWN);
    expect(shown(screen)).not.toBeCloseTo(adjusted, 3);
    expect(screen.getByText('ELEVATION')).toBeTruthy();
  });

  it('says it is using the solver alone when nothing matches', async () => {
    seed([log({ distance: 2000 })]);

    const screen = render();

    await waitFor(() => {
      expect(screen.getByText('No historical data, using solver only')).toBeTruthy();
    });
    expect(shown(screen)).toBe(SOLVER_SHOWN);
    expect(screen.queryByTestId('dope-adjustment-summary')).toBeNull();
  });

  it('says the same with no logs at all', async () => {
    seed([]);

    const screen = render();

    await waitFor(() => {
      expect(screen.getByText('No historical data, using solver only')).toBeTruthy();
    });
    expect(shown(screen)).toBe(SOLVER_SHOWN);
  });

  it('shows the offset that was applied, signed', async () => {
    // Logs below the solver's figure: the offset is negative and must read as
    // such, not as an unsigned magnitude.
    seed([
      log({ id: 1, elevationCorrection: solverElevation - 0.6 }),
      log({ id: 2, elevationCorrection: solverElevation - 0.6, environmentId: 2 }),
    ]);

    const screen = render();

    await waitFor(() => {
      expect(screen.getByText('Offset applied:')).toBeTruthy();
    });
    expect(screen.getByText(/^-0\.\d\d MIL$/)).toBeTruthy();
    expect(shown(screen)).toBeLessThan(solverElevation);
  });
});
