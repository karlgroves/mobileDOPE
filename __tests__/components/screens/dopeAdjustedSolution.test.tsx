import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { DOPELog } from '../../../src/models/DOPELog';
import { BallisticSolutionResults } from '../../../src/screens/BallisticSolutionResults';
import { environmentRepository } from '../../../src/services/database';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useDOPEStore } from '../../../src/store/useDOPEStore';
import { useEnvironmentStore } from '../../../src/store/useEnvironmentStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { calculateBallisticSolution } from '../../../src/utils/ballistics';
import { renderWithProviders } from '../../helpers/renderWithProviders';

import type { DOPELogData } from '../../../src/models/DOPELog';
import type { AlertButton } from 'react-native';

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

/**
 * The fields `calculateConfidence` reads, set to a well-shot group.
 *
 * Needed wherever a test seeds a *single* log, because #161 gates the
 * adjustment on confidence and one log that records neither a shot count nor a
 * group size does not clear the threshold. These tests are about the wiring,
 * not about the gate, so they say plainly that their one log is a good one.
 * The gate itself is asserted separately, at the bottom of this file.
 */
const WELL_EVIDENCED = { shotCount: 5, hitCount: 5, groupSize: 3 };

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

/**
 * The same seed with no notion of today's air: nothing in the store's snapshot
 * list, and `current` null as it is on every cold launch until the Environment
 * screen is opened (#187). The logs' own snapshots stay reachable by id, so the
 * adjustment still happens -- what is missing is the air to compare it against.
 */
const seedWithoutConditions = (logs: DOPELog[]): void => {
  seed(logs);
  useEnvironmentStore.setState({ snapshots: [] as never, current: null });
};

/**
 * `current` null, as on a cold launch, with only a latest snapshot taken the
 * given number of hours ago to stand in for today's air.
 */
const seedWithLatestSnapshot = (logs: DOPELog[], hoursOld: number): void => {
  seed(logs);
  const timestamp = new Date(Date.now() - hoursOld * 3600000).toISOString();
  useEnvironmentStore.setState({
    snapshots: [{ ...(snapshot(1) as object), timestamp }] as never,
    current: null,
  });
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
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
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
    seed([log({ elevationCorrection: solverElevation + 0.5, ...WELL_EVIDENCED })]);

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
    seed([log({ elevationCorrection: solverElevation + 0.4, ...WELL_EVIDENCED })]);

    const screen = render();

    await waitFor(() => {
      expect(screen.getByText('Based on 1 log from similar conditions.')).toBeTruthy();
    });
  });

  it('returns the solver’s number when the switch is turned off', async () => {
    seed([log({ elevationCorrection: solverElevation + 0.5, ...WELL_EVIDENCED })]);

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

/**
 * Confidence in the adjustment, on screen (#161).
 *
 * The score itself is covered in `adjustmentConfidence.test.ts` and the badge
 * in `AdjustmentConfidenceBadge.test.tsx`. What is asserted here is that the
 * screen gates on it: that a weak set of logs stops moving the headline, that
 * the shooter is told why rather than just shown an unchanged number, and that
 * the badge appears beside the adjustment rather than instead of it.
 */
describe('confidence in the adjustment, on the solution screen (#161)', () => {
  it('shows the badge beside an adjustment it did apply', async () => {
    seed([
      log({ id: 1, elevationCorrection: solverElevation + 0.4, ...WELL_EVIDENCED }),
      log({
        id: 2,
        elevationCorrection: solverElevation + 0.4,
        environmentId: 2,
        ...WELL_EVIDENCED,
      }),
    ]);

    const screen = render();

    await waitFor(() => {
      expect(screen.getByTestId('adjustment-confidence')).toBeTruthy();
    });
    expect(screen.getByText('Confidence in this adjustment')).toBeTruthy();
    expect(screen.getByTestId('dope-adjustment-summary')).toBeTruthy();
  });

  it('leaves the headline on the solver when the logs flatly disagree', async () => {
    // Four logs at this distance, every one well evidenced, saying four
    // different things. There is plenty of evidence and none of it agrees, so
    // their mean is not a measurement and must not be dialled.
    seed(
      [+0.8, -0.7, +0.6, -0.9].map((delta, i) =>
        log({
          id: i + 1,
          elevationCorrection: solverElevation + delta,
          environmentId: (i % 3) + 1,
          ...WELL_EVIDENCED,
        })
      )
    );

    const screen = render();

    await waitFor(() => {
      expect(screen.getByText('Confidence too low, using solver only')).toBeTruthy();
    });
    expect(shown(screen)).toBe(SOLVER_SHOWN);
    expect(screen.getByText('ELEVATION')).toBeTruthy();
    expect(screen.queryByTestId('dope-adjustment-summary')).toBeNull();
  });

  it('still shows the badge when it withheld the adjustment, with the reason', async () => {
    // The case the shooter most needs the reasons for: the number did not
    // move, and without the badge there is nothing on screen saying why.
    seed(
      [+0.8, -0.7, +0.6, -0.9].map((delta, i) =>
        log({
          id: i + 1,
          elevationCorrection: solverElevation + delta,
          environmentId: (i % 3) + 1,
          ...WELL_EVIDENCED,
        })
      )
    );

    const screen = render();

    await waitFor(() => {
      expect(screen.getByTestId('adjustment-confidence')).toBeTruthy();
    });
    expect(screen.getByText(/not applied/)).toBeTruthy();
    expect(screen.getByText(/Logs disagree by/)).toBeTruthy();
  });

  it('withholds the adjustment from one log that records nothing about itself', async () => {
    // No shot count and no group size: `calculateConfidence` marks it down,
    // and one such log is not enough to move a dialled correction. This is the
    // case the three wiring tests above opt out of with WELL_EVIDENCED.
    seed([log({ elevationCorrection: solverElevation + 0.5 })]);

    const screen = render();

    await waitFor(() => {
      expect(screen.getByText('Confidence too low, using solver only')).toBeTruthy();
    });
    expect(shown(screen)).toBe(SOLVER_SHOWN);
  });

  it('hides the badge while the switch is off, rather than describing an absent number', async () => {
    seed([
      log({ id: 1, elevationCorrection: solverElevation + 0.4, ...WELL_EVIDENCED }),
      log({
        id: 2,
        elevationCorrection: solverElevation + 0.4,
        environmentId: 2,
        ...WELL_EVIDENCED,
      }),
    ]);

    const screen = render();
    await waitFor(() => {
      expect(screen.getByTestId('adjustment-confidence')).toBeTruthy();
    });

    fireEvent(screen.getByTestId('dope-adjust-switch'), 'valueChange', false);

    await waitFor(() => {
      expect(screen.queryByTestId('adjustment-confidence')).toBeNull();
    });
  });

  it('shows no badge at all when nothing matched', async () => {
    seed([log({ distance: 2000 })]);

    const screen = render();

    await waitFor(() => {
      expect(screen.getByText('No historical data, using solver only')).toBeTruthy();
    });
    expect(screen.queryByTestId('adjustment-confidence')).toBeNull();
  });
});

/**
 * What "Save to DOPE Log" actually records (#185).
 *
 * The headline can read `ELEVATION (ADJUSTED)` while the log stores the
 * solver's own figure. That is deliberate -- the offset is measured against the
 * solver, so storing an adjusted number would fold the offset in again on the
 * next solve, and again on the one after -- but nothing on screen said so, and
 * nothing pinned the choice, which is how it comes to be "fixed" by saving the
 * figure the shooter can see.
 */
describe('what Save to DOPE Log records (#185)', () => {
  const saveWithAdjustment = async () => {
    seed([
      log({ id: 1, elevationCorrection: solverElevation + 0.5 }),
      log({ id: 2, elevationCorrection: solverElevation + 0.5, environmentId: 2 }),
      log({ id: 3, elevationCorrection: solverElevation + 0.5, environmentId: 3 }),
    ]);
    const createDopeLog = jest.fn().mockResolvedValue(undefined);
    useDOPEStore.setState({ createDopeLog } as never);
    useEnvironmentStore.setState({
      saveCurrent: jest.fn().mockResolvedValue({ id: 7 }),
    } as never);

    const screen = render();
    await waitFor(() => expect(screen.getByTestId('dope-adjustment-summary')).toBeTruthy());

    fireEvent.press(screen.getByText('Save to DOPE Log'));
    const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as AlertButton[];
    await buttons.find((b) => b.text === 'Steel')?.onPress?.();

    return { screen, createDopeLog };
  };

  it('records the solver’s elevation, not the adjusted one', async () => {
    const { screen, createDopeLog } = await saveWithAdjustment();

    // The headline is the adjusted figure, so this is the gap the note exists
    // to explain. Asserting both halves in one test is deliberate: either alone
    // would pass if the screen stopped adjusting at all.
    expect(shown(screen)).toBeGreaterThan(SOLVER_SHOWN);
    await waitFor(() => expect(createDopeLog).toHaveBeenCalledTimes(1));
    expect(createDopeLog.mock.calls[0][0].elevationCorrection).toBeCloseTo(solverElevation, 10);
  });

  it('tells the shooter which of the two figures it is about to store', async () => {
    const { screen } = await saveWithAdjustment();

    const note = screen.getByTestId('save-records-note').props.children as string;
    expect(note).toContain(`${solverElevation.toFixed(2)} MIL`);
    expect(note).toContain(shown(screen).toFixed(2));
  });

  it('says nothing when the figure on screen is the one being stored', async () => {
    // Adjustment off: the headline is already the solver's own number, so a
    // note distinguishing them would be describing a difference that is not
    // there.
    seed([log({ elevationCorrection: solverElevation + 0.5, ...WELL_EVIDENCED })]);

    const screen = render();
    await waitFor(() => expect(screen.getByTestId('dope-adjustment-summary')).toBeTruthy());
    fireEvent(screen.getByTestId('dope-adjust-switch'), 'valueChange', false);

    expect(screen.queryByTestId('save-records-note')).toBeNull();
  });

  it('says nothing when there is no logged DOPE to adjust by', async () => {
    seed([]);

    const screen = render();

    expect(screen.queryByTestId('save-records-note')).toBeNull();
  });
});

describe('when today’s conditions are unknown (#187)', () => {
  it('does not claim the matches came from similar conditions', async () => {
    // Every log scored the neutral 0.5 on the environment factor, because there
    // was nothing to compare them against. Saying "from similar conditions"
    // asserts a similarity nothing checked.
    jest.spyOn(environmentRepository, 'getById').mockResolvedValue(snapshot(1));
    seedWithoutConditions([log({ elevationCorrection: solverElevation + 0.5, ...WELL_EVIDENCED })]);

    const screen = render();

    await waitFor(() => expect(screen.getByTestId('dope-adjustment-summary')).toBeTruthy());
    expect(screen.getByText('Based on 1 log.')).toBeTruthy();
    expect(screen.queryByText(/similar conditions/)).toBeNull();
  });

  it('names the latest snapshot when that is what the logs were compared with', async () => {
    seedWithLatestSnapshot(
      [log({ elevationCorrection: solverElevation + 0.5, ...WELL_EVIDENCED })],
      2
    );

    const screen = render();

    await waitFor(() =>
      expect(
        screen.getByText('Based on 1 log from conditions similar to your latest snapshot.')
      ).toBeTruthy()
    );
  });

  it('says conditions were not compared when the latest snapshot is over a day old', async () => {
    jest.spyOn(environmentRepository, 'getById').mockResolvedValue(snapshot(1));
    seedWithLatestSnapshot(
      [log({ elevationCorrection: solverElevation + 0.5, ...WELL_EVIDENCED })],
      25
    );

    const screen = render();

    await waitFor(() =>
      expect(
        screen.getByText(
          'Based on 1 log. Conditions not compared: the latest snapshot is over 24 hours old.'
        )
      ).toBeTruthy()
    );
    expect(screen.queryByText(/similar/)).toBeNull();
  });

  it('still says so when it does know them', async () => {
    // The claim is worth making when it is true, so the fallback and the
    // wording have to be asserted together -- dropping the phrase everywhere
    // would pass the test above and lose the information.
    seed([log({ elevationCorrection: solverElevation + 0.5, ...WELL_EVIDENCED })]);

    const screen = render();

    await waitFor(() =>
      expect(screen.getByText('Based on 1 log from similar conditions.')).toBeTruthy()
    );
  });
});

/**
 * The offset interpolated across logged distances, on screen (#162).
 *
 * PR #182 built `interpolateOffset` and nothing called it: with no log near
 * today's distance the screen fell straight back to the solver. What is pinned
 * here is that it now reads the curve, labels the figure as interpolated, and
 * warns when it was held past the last log -- and that it stays out of the way
 * of a matched adjustment that was good enough on its own.
 */
describe('interpolating between logged distances (#162)', () => {
  /** The solver's elevation at `yards`, in the same air every snapshot here has. */
  const solverAt = (yards: number): number =>
    calculateBallisticSolution(
      {
        zeroDistance: 100,
        sightHeight: 1.5,
        twistRate: '1:10',
        barrelLength: 24,
        caliber: '.308 Winchester',
      },
      { bulletWeight: 168, ballisticCoefficient: 0.462, dragModel: 'G1', muzzleVelocity: 2650 },
      { distance: yards, angle: 0, windSpeed: 10, windDirection: 90 },
      { temperature: 59, pressure: 29.92, humidity: 50, altitude: 0, densityAltitude: 0 },
      false
    ).elevationMIL;

  /** Three well-evidenced logs at `yards`, each `offset` MIL above the solver there. */
  const logsAt = (yards: number, offset: number, firstId: number): DOPELog[] =>
    [0, 1, 2].map((i) =>
      log({
        id: firstId + i,
        distance: yards,
        environmentId: i + 1,
        elevationCorrection: solverAt(yards) + offset,
        ...WELL_EVIDENCED,
      })
    );

  it('interpolates the offset when no log is near enough to match', async () => {
    // 430 and 560 yd are both outside the 50-yard matching window around 500,
    // so before #162 this showed the solver alone.
    seed([...logsAt(430, 0.3, 1), ...logsAt(560, 0.3, 10)]);

    const screen = render();

    await waitFor(() => {
      expect(screen.getByTestId('dope-adjustment-caption')).toBeTruthy();
    });
    expect(screen.getByText('Interpolated between your 430 and 560 yd logs')).toBeTruthy();
    expect(screen.getByText('ELEVATION (ADJUSTED)')).toBeTruthy();
    expect(shown(screen)).toBeGreaterThan(SOLVER_SHOWN);
    expect(shown(screen)).toBeLessThanOrEqual(Number((solverElevation + 0.3).toFixed(2)));
    expect(screen.getByTestId('adjustment-confidence')).toBeTruthy();
    expect(screen.queryByTestId('dope-extrapolated-warning')).toBeNull();
  });

  it('warns when the figure was held past the last logged distance', async () => {
    // The logs near 500 disagree with each other as a set -- 0.0 at 470, 0.6 at
    // 480 -- so the matched adjustment is withheld. Read as a curve they agree
    // within each distance, and 500 lies past the furthest, at 480.
    seed([...logsAt(470, 0, 1), ...logsAt(480, 0.6, 10)]);

    const screen = render();

    await waitFor(() => {
      expect(screen.getByTestId('dope-extrapolated-warning')).toBeTruthy();
    });
    expect(
      screen.getByText('Extrapolated beyond your logged distances: nearest is 480 yd, 20 yd away')
    ).toBeTruthy();
    expect(shown(screen)).toBeGreaterThan(SOLVER_SHOWN);
  });

  it('shows the solver alone across a gap too wide to interpolate', async () => {
    seed([...logsAt(200, 0.3, 1), ...logsAt(800, 0.3, 10)]);

    const screen = render();

    await waitFor(() => {
      expect(screen.getByText('No historical data, using solver only')).toBeTruthy();
    });
    expect(shown(screen)).toBe(SOLVER_SHOWN);
    expect(screen.queryByTestId('dope-adjustment-caption')).toBeNull();
  });

  it('leaves a matched adjustment alone when it was good enough by itself', async () => {
    seed([...logsAt(500, 0.4, 1), ...logsAt(800, -1.0, 10)]);

    const screen = render();

    await waitFor(() => {
      expect(screen.getByTestId('dope-adjustment-caption')).toBeTruthy();
    });
    expect(screen.queryByText(/Interpolated/)).toBeNull();
    expect(screen.getByText(/^Based on 3 logs/)).toBeTruthy();
  });

  it('returns the solver’s number when the switch is turned off', async () => {
    seed([...logsAt(430, 0.3, 1), ...logsAt(560, 0.3, 10)]);

    const screen = render();

    await waitFor(() => {
      expect(screen.getByTestId('dope-adjustment-caption')).toBeTruthy();
    });
    fireEvent(screen.getByTestId('dope-adjust-switch'), 'valueChange', false);

    expect(shown(screen)).toBe(SOLVER_SHOWN);
    expect(screen.queryByTestId('dope-adjustment-caption')).toBeNull();
  });
});
