import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { DOPELog } from '../../../src/models/DOPELog';
import { BallisticSolutionResults } from '../../../src/screens/BallisticSolutionResults';
import { SettingsScreen } from '../../../src/screens/SettingsScreen';
import { environmentRepository } from '../../../src/services/database';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { DEFAULT_SETTINGS, useAppStore } from '../../../src/store/useAppStore';
import { useDOPEStore } from '../../../src/store/useDOPEStore';
import { useEnvironmentStore } from '../../../src/store/useEnvironmentStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { calculateBallisticSolution } from '../../../src/utils/ballistics';
import { renderWithProviders } from '../../helpers/renderWithProviders';

import type { DOPELogData } from '../../../src/models/DOPELog';
import type { AlertButton } from 'react-native';

/**
 * The stored settings for DOPE-assisted aiming (#167).
 *
 * Two halves. That the Settings screen reads and writes them, and that the
 * *solution screen actually obeys them* -- which is the half worth testing,
 * because a setting that is stored and ignored is worse than no setting: the
 * shooter believes they changed something.
 *
 * `dopeSettings.test.ts` covers the bounds and the guide's figures.
 */

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

const snapshot = {
  id: 1,
  temperature: 59,
  pressure: 29.92,
  humidity: 50,
  altitude: 0,
  densityAltitude: 0,
  windSpeed: 0,
  windDirection: 90,
};

const solution = calculateBallisticSolution(
  {
    zeroDistance: 100,
    sightHeight: 1.5,
    twistRate: '1:10',
    barrelLength: 24,
    caliber: '.308 Winchester',
  },
  { bulletWeight: 168, ballisticCoefficient: 0.462, dragModel: 'G1', muzzleVelocity: 2650 },
  { distance: 500, angle: 0, windSpeed: 0, windDirection: 90 },
  { temperature: 59, pressure: 29.92, humidity: 50, altitude: 0, densityAltitude: 0 },
  false
);

const SOLVER_SHOWN = Number(solution.elevationMIL.toFixed(2));

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
    elevationCorrection: solution.elevationMIL + 0.5,
    windageCorrection: 0,
    correctionUnit: 'MIL',
    targetType: 'steel',
    timestamp: new Date().toISOString(),
    ...WELL_EVIDENCED,
    ...over,
  } as DOPELogData);

const seed = (logs: DOPELog[]) => {
  useDOPEStore.setState({ dopeLogs: logs });
  useEnvironmentStore.setState({ snapshots: [snapshot] as never, current: snapshot as never });
  useRifleStore.setState({ rifles: [rifle] as never });
  useAmmoStore.setState({ ammoProfiles: [ammo] as never });
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

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
};

const renderSolution = () =>
  renderWithProviders(
    <BallisticSolutionResults route={route as never} navigation={navigation as never} />
  );

const shown = (view: ReturnType<typeof renderSolution>): number =>
  Number(view.getByTestId('elevation-value').props.children);

/** Presses the alert button whose text is `label`. */
const pressAlertButton = async (label: string) => {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const buttons = (calls[calls.length - 1][2] ?? []) as AlertButton[];
  const button = buttons.find((candidate) => candidate.text === label);
  if (!button?.onPress) throw new Error(`No alert button labelled "${label}"`);
  await button.onPress();
};

const setSettings = (over: Partial<typeof DEFAULT_SETTINGS>) => {
  useAppStore.setState({ settings: { ...DEFAULT_SETTINGS, ...over } });
};

beforeEach(() => {
  jest.clearAllMocks();
  nextId = 1;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest
    .spyOn(environmentRepository, 'getById')
    .mockImplementation(() => Promise.resolve(snapshot as never));
  setSettings({});
});

describe('the solution screen obeys the stored settings (#167)', () => {
  it('starts with the adjustment on, as shipped', async () => {
    seed([log(), log(), log()]);
    const view = renderSolution();

    await waitFor(() => expect(view.getByTestId('dope-adjust-switch').props.value).toBe(true));
    expect(shown(view)).not.toBe(SOLVER_SHOWN);
  });

  it('starts with the adjustment off when Settings says so', async () => {
    // The setting is the switch's *starting position*, which is the whole point
    // -- a shooter who prefers the solver should not turn it off every time.
    setSettings({ dopeAdjustmentEnabled: false });
    seed([log(), log(), log()]);
    const view = renderSolution();

    await waitFor(() => expect(view.getByTestId('dope-adjust-switch').props.value).toBe(false));
    expect(shown(view)).toBe(SOLVER_SHOWN);
  });

  it('changes which logs the matcher even finds', async () => {
    // Logs 60 yd from the shot: outside a 25-yard window, outside the default
    // 50-yard one, inside a 100-yard one. The two cases are distinguished by
    // the *reason* rather than the headline, which is the sharper assertion --
    // "No historical data" means the window found nothing, while "Confidence
    // too low" means it found these three and the gate declined them. Only the
    // window can move the app between those two statements.
    seed([log({ distance: 560 }), log({ distance: 560 }), log({ distance: 560 })]);

    setSettings({ dopeDistanceDeltaYards: 25 });
    const narrow = renderSolution();
    await waitFor(() => expect(narrow.getByText(/No historical data/)).toBeTruthy());
    expect(shown(narrow)).toBe(SOLVER_SHOWN);
    narrow.unmount();

    setSettings({ dopeDistanceDeltaYards: 100 });
    const wide = renderSolution();
    await waitFor(() => expect(wide.getByText(/Confidence too low/)).toBeTruthy());
  });

  it('moves the figure once the window finds logs the threshold accepts', async () => {
    // The same logs, the same wider window, and a threshold the shooter
    // lowered. Three logs 60 yd out score 0.35 on the default 0.4 gate, which
    // is the app being conservative rather than the window failing -- and the
    // two settings together are what let the shooter say otherwise.
    seed([log({ distance: 560 }), log({ distance: 560 }), log({ distance: 560 })]);
    setSettings({ dopeDistanceDeltaYards: 100, dopeConfidenceThreshold: 0.3 });

    const view = renderSolution();

    await waitFor(() => expect(shown(view)).not.toBe(SOLVER_SHOWN));
    expect(view.getByTestId('dope-adjustment-caption').props.children).toMatch(/Based on 3 logs/);
  });

  it('refuses the adjustment when the stored threshold is above what it scored', async () => {
    seed([log(), log(), log()]);

    setSettings({ dopeConfidenceThreshold: 0.4 });
    const permissive = renderSolution();
    await waitFor(() => expect(shown(permissive)).not.toBe(SOLVER_SHOWN));
    permissive.unmount();

    setSettings({ dopeConfidenceThreshold: 1 });
    const strict = renderSolution();
    await waitFor(() => expect(strict.getByTestId('elevation-value')).toBeTruthy());
    expect(shown(strict)).toBe(SOLVER_SHOWN);
  });

  it('says confidence was too low rather than claiming no logs', async () => {
    // The distinction #161 already draws, now reachable from Settings: "your
    // logs do not agree yet" is a different statement from "you have no logs".
    setSettings({ dopeConfidenceThreshold: 1 });
    seed([log(), log(), log()]);
    const view = renderSolution();

    await waitFor(() => expect(view.getByText(/Confidence too low/)).toBeTruthy());
  });
});

describe('the Settings screen (#167)', () => {
  const renderSettings = () =>
    renderWithProviders(<SettingsScreen navigation={navigation as never} route={{} as never} />);

  it('offers the three controls, with the shipped values', async () => {
    const view = renderSettings();

    await waitFor(() => expect(view.getByText('DOPE-Assisted Aiming')).toBeTruthy());
    expect(view.getByTestId('dope-adjustment-default').props.value).toBe(true);
    expect(view.getByLabelText(/^Matching Window: 50/)).toBeTruthy();
    expect(view.getByLabelText(/^Confidence Threshold: 40/)).toBeTruthy();
  });

  it('says in plain words what each one changes', async () => {
    // #167: "each setting says in plain words what it changes". Asserted on the
    // substance rather than on exact prose -- what is pinned is that the text
    // explains the effect, not the jargon.
    const view = renderSettings();

    await waitFor(() => expect(view.getByText('DOPE-Assisted Aiming')).toBeTruthy());
    expect(view.getByText(/Where the calculator's switch starts/)).toBeTruthy();
    expect(view.getByText(/How far from the shot a log can have been fired/)).toBeTruthy();
    expect(view.getByText(/How much the app has to believe its own recommendation/)).toBeTruthy();
  });

  it('stores a change to the adjustment default', async () => {
    const view = renderSettings();

    await waitFor(() => expect(view.getByTestId('dope-adjustment-default')).toBeTruthy());
    fireEvent(view.getByTestId('dope-adjustment-default'), 'valueChange', false);

    await waitFor(() => expect(useAppStore.getState().settings.dopeAdjustmentEnabled).toBe(false));
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('puts the three back, and nothing else, on reset', async () => {
    // Scoped deliberately: `resetSettings` would also clear the theme, the
    // units, the custom calibers and a measured barometer offset. A shooter who
    // wants their matching window back has not asked to lose a sensor
    // calibration.
    setSettings({
      dopeAdjustmentEnabled: false,
      dopeDistanceDeltaYards: 100,
      dopeConfidenceThreshold: 0.9,
      themeMode: 'nightVision',
      barometerOffsetInHg: 0.07,
      defaultCorrectionUnit: 'MOA',
    });
    const view = renderSettings();

    await waitFor(() => expect(view.getByText('DOPE-Assisted Aiming')).toBeTruthy());
    fireEvent.press(view.getByLabelText('Reset DOPE-assisted aiming settings'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    await pressAlertButton('Reset');

    await waitFor(() => {
      const settings = useAppStore.getState().settings;
      expect(settings.dopeAdjustmentEnabled).toBe(DEFAULT_SETTINGS.dopeAdjustmentEnabled);
      expect(settings.dopeDistanceDeltaYards).toBe(DEFAULT_SETTINGS.dopeDistanceDeltaYards);
      expect(settings.dopeConfidenceThreshold).toBe(DEFAULT_SETTINGS.dopeConfidenceThreshold);
    });

    const settings = useAppStore.getState().settings;
    expect(settings.themeMode).toBe('nightVision');
    expect(settings.barometerOffsetInHg).toBe(0.07);
    expect(settings.defaultCorrectionUnit).toBe('MOA');
  });

  it('names the figures it will reset to, before resetting', async () => {
    const view = renderSettings();

    await waitFor(() => expect(view.getByText('DOPE-Assisted Aiming')).toBeTruthy());
    fireEvent.press(view.getByLabelText('Reset DOPE-assisted aiming settings'));

    const message = (Alert.alert as jest.Mock).mock.calls[0][1];
    expect(message).toContain('50 yards');
    expect(message).toContain('40%');
    expect(message).toContain('Nothing else changes');
  });
});
