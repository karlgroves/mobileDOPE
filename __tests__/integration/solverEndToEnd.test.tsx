import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { AmmoProfile } from '../../src/models/AmmoProfile';
import { RifleProfile } from '../../src/models/RifleProfile';
import { BallisticCalculator } from '../../src/screens/BallisticCalculator';
import { BallisticSolutionResults } from '../../src/screens/BallisticSolutionResults';
import { useAmmoStore } from '../../src/store/useAmmoStore';
import { useDOPEStore } from '../../src/store/useDOPEStore';
import { useEnvironmentStore } from '../../src/store/useEnvironmentStore';
import { useRifleStore } from '../../src/store/useRifleStore';
import { validAmmo, validRifle } from '../helpers/fixtures';
import { renderWithProviders } from '../helpers/renderWithProviders';

import type { BallisticSolution } from '../../src/types/ballistic.types';

/**
 * The ballistic solver, end to end, through the screens a shooter uses (#68,
 * "test ballistic solver integration end to end").
 *
 * Every layer here is real: rifle and ammo *model instances* in the stores, the
 * calculator screen building the solver's inputs from them, the real solver,
 * and the results screen formatting what it was handed. Nothing is mocked but
 * navigation, which is only the hand-off between the two screens -- the
 * parameters the calculator passes are the ones the results screen renders.
 *
 * The unit suites already prove each piece in isolation. What only this can
 * catch is a seam: a profile field the calculator stops reading, a unit the
 * results screen formats from the wrong field, a distance passed in the wrong
 * unit (#106 was exactly that).
 *
 * ## Where the pinned numbers come from
 *
 * The load is Federal Gold Medal Match .308 Win 175 gr Sierra MatchKing
 * (GM308M2): G1 BC .505, 2600 fps. That is `validAmmo()`'s G1 figure and
 * velocity, and the calculator solves with the G1 coefficient. (It always
 * does: `BallisticCalculator` ignores the G7 figure, while the DOPE curve and
 * the DOPE adjustment predict through `solverInputs.ammoConfigFor`, which
 * prefers G7. That divergence is pinned here as current behaviour, not
 * endorsed; flagged for a decision on #68.) The rifle is
 * set to a 1.5 in sight height and a 100 yd zero to match the conditions
 * Federal's own table is published for.
 *
 * Federal publishes, for this load (federalpremium.com, product 11-GM308M2,
 * "Ballistics" tab, read 2026-10-26):
 *
 *   500 yd   1803 fps   1264 ft-lb   10 mph wind drift 20.3 in
 *   300 yd   -15.7 in path (100 yd zero)
 *
 * The figures pinned below were derived from the solver once and then checked
 * against those: velocity within 1% (1792 v 1803), energy within 1.5%
 * (1248 v 1264), drift within 1 in (21.0 v 20.3 at 500 yd, 7.0 v 6.9 at
 * 300), and the 300 yd path exact (-15.7 in). The `published` assertions keep that check in the
 * suite, at deliberately loose tolerances, so the pinned strings cannot later be
 * "updated" to a value the published table contradicts.
 *
 * Writing this test is how the wind-drift defect fixed alongside it was found:
 * the solver multiplied the crosswind by the whole time of flight, and put
 * 122 in of drift on this load at 500 yd against Federal's 20.3.
 */

/** Derived from the solver once; see "Where the pinned numbers come from". */
const PINNED = {
  // Federal: 1803 fps, 20.3 in drift. Solver: 1792 fps, 21.0 in (1.16 MIL).
  mil500: {
    elevation: '3.52',
    windage: '-1.16',
    drop: '-63.4 in',
    velocity: '1792 fps',
    timeOfFlight: '0.70 sec',
  },
  // Past Federal's table. 411.8 in of drop and 100.9 in of drift; the drift is
  // what a lag-time model gives, the drop is the same G1 integration as above.
  moa1000: { elevation: '39.32', windage: '-9.64' },
};

const navigate = jest.fn();
const navigation = {
  navigate,
  goBack: jest.fn(),
} as unknown as Parameters<typeof BallisticCalculator>[0]['navigation'];

/** The rifle and load, as the profile forms would have saved them. */
const seedProfiles = (): void => {
  useRifleStore.setState({
    rifles: [new RifleProfile(validRifle({ id: 1, scopeHeight: 1.5, zeroDistance: 100 }))],
  });
  useAmmoStore.setState({ ammoProfiles: [new AmmoProfile(validAmmo({ id: 1 }))] });
  // No logged DOPE and no snapshot: the results screen then shows the solver's
  // own figure, unadjusted, which is what this suite is about.
  useDOPEStore.setState({ dopeLogs: [] });
  useEnvironmentStore.setState({ snapshots: [], current: null });
};

interface Entry {
  yards: number;
  windMph?: number;
  temperature?: number;
  angularUnit?: 'MIL' | 'MOA';
}

/**
 * Drive the calculator the way a shooter does, and return what it hands the
 * results screen.
 */
const solveOnScreen = ({ yards, windMph = 10, temperature, angularUnit = 'MIL' }: Entry) => {
  navigate.mockClear();
  const screen = renderWithProviders(
    <BallisticCalculator
      navigation={navigation}
      route={{ key: 'calc', name: 'BallisticCalculator', params: undefined } as never}
    />
  );

  fireEvent.press(screen.getByLabelText(/^Rifle Profile:/));
  fireEvent.press(screen.getByLabelText('Tikka T3x'));
  fireEvent.press(screen.getByLabelText(/^Ammunition:/));
  fireEvent.press(screen.getByLabelText('175gr SMK'));

  fireEvent.press(screen.getByLabelText(/^Target Distance:/));
  fireEvent.press(screen.getByLabelText(`${yards} yards`));

  fireEvent.changeText(screen.getByLabelText('Wind Speed'), String(windMph));
  if (temperature !== undefined) {
    fireEvent.changeText(screen.getByLabelText('Temperature'), String(temperature));
  }
  if (angularUnit === 'MOA') fireEvent.press(screen.getByText('MOA'));

  fireEvent.press(screen.getByText('Calculate Solution'));

  expect(navigate).toHaveBeenCalledTimes(1);
  const [route, params] = navigate.mock.calls[0] as [
    string,
    {
      solution: BallisticSolution;
      rifleId: number;
      ammoId: number;
      distance: number;
      distanceUnit: 'yards' | 'meters';
      angularUnit: 'MIL' | 'MOA';
    },
  ];
  expect(route).toBe('BallisticSolutionResults');
  screen.unmount();
  return params;
};

/** Render the results screen with exactly what the calculator passed. */
const showResults = (params: ReturnType<typeof solveOnScreen>) =>
  renderWithProviders(
    <BallisticSolutionResults
      navigation={navigation as never}
      route={{ key: 'results', name: 'BallisticSolutionResults', params } as never}
    />
  );

/** The windage column of "Required Corrections" has no testID; it is the sibling column. */
const shownWindage = (screen: ReturnType<typeof showResults>): string => {
  const label = screen.getByText('WINDAGE');
  const column = label.parent;
  const values = column?.parent?.children ?? [];
  // label, value, unit
  return String((values[1] as { props: { children: unknown } }).props.children);
};

describe('solver end to end: profiles -> calculator -> solver -> results (#68)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedProfiles();
  });

  it('solves from the stored profiles, not from defaults', () => {
    const { solution } = solveOnScreen({ yards: 500 });

    // The seam a refactor most easily breaks: a field read from the wrong
    // place solves happily with a plausible wrong number.
    expect(solution.rifle.zeroDistance).toBe(100);
    expect(solution.rifle.sightHeight).toBe(1.5);
    expect(solution.ammo.ballisticCoefficient).toBe(0.505);
    expect(solution.ammo.dragModel).toBe('G1');
    expect(solution.ammo.muzzleVelocity).toBe(2600);
    expect(solution.shot.distance).toBe(500);
    expect(solution.shot.windSpeed).toBe(10);
    expect(solution.shot.windDirection).toBe(90);
  });

  it('agrees with the published table for this load (Federal GM308M2)', () => {
    const at500 = solveOnScreen({ yards: 500 }).solution;
    const at300 = solveOnScreen({ yards: 300 }).solution;

    expect(at500.velocity).toBeGreaterThan(1803 * 0.98);
    expect(at500.velocity).toBeLessThan(1803 * 1.02);
    expect(at500.energy).toBeGreaterThan(1264 * 0.97);
    expect(at500.energy).toBeLessThan(1264 * 1.03);
    expect(Math.abs(at500.windage)).toBeGreaterThan(20.3 - 3);
    expect(Math.abs(at500.windage)).toBeLessThan(20.3 + 3);
    expect(at300.drop).toBeGreaterThan(-15.7 - 1.5);
    expect(at300.drop).toBeLessThan(-15.7 + 1.5);
  });

  it('shows the pinned corrections at 500 yd in MIL', () => {
    const screen = showResults(solveOnScreen({ yards: 500 }));

    expect(screen.getByTestId('elevation-value').props.children).toBe(PINNED.mil500.elevation);
    expect(shownWindage(screen)).toBe(PINNED.mil500.windage);
    expect(screen.getByText(PINNED.mil500.drop)).toBeTruthy();
    expect(screen.getByText(PINNED.mil500.velocity)).toBeTruthy();
    expect(screen.getByText(PINNED.mil500.timeOfFlight)).toBeTruthy();
  });

  it('shows the pinned corrections at 1000 yd in MOA', () => {
    const screen = showResults(solveOnScreen({ yards: 1000, angularUnit: 'MOA' }));

    expect(screen.getByTestId('elevation-value').props.children).toBe(PINNED.moa1000.elevation);
    expect(shownWindage(screen)).toBe(PINNED.moa1000.windage);
  });

  it('changes the solution with the conditions entered, in the right direction', () => {
    // Cold air is dense air: more drag, a slower bullet, more drop, and more
    // time for the wind to work on it.
    const cold = solveOnScreen({ yards: 800, temperature: 10 }).solution;
    const hot = solveOnScreen({ yards: 800, temperature: 100 }).solution;

    expect(cold.elevationMIL).toBeGreaterThan(hot.elevationMIL);
    expect(cold.velocity).toBeLessThan(hot.velocity);
    expect(Math.abs(cold.windageMIL)).toBeGreaterThan(Math.abs(hot.windageMIL));
  });
});
