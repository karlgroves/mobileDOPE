import { act, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { AmmoProfile } from '../../../src/models/AmmoProfile';
import { DOPELog } from '../../../src/models/DOPELog';
import { EnvironmentSnapshot } from '../../../src/models/EnvironmentSnapshot';
import { RifleProfile } from '../../../src/models/RifleProfile';
import { DOPELogEntry } from '../../../src/screens/DOPELogEntry';
import { dopeLogRepository } from '../../../src/services/database';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useDOPEStore } from '../../../src/store/useDOPEStore';
import { useEnvironmentStore } from '../../../src/store/useEnvironmentStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { validAmmo, validDopeLog, validEnvironment, validRifle } from '../../helpers/fixtures';
import { renderWithProviders } from '../../helpers/renderWithProviders';

/**
 * New DOPE Log on a cold launch (#231).
 *
 * Seen on the iOS Simulator: with a saved snapshot, and Start Session showing
 * it, New DOPE Log said "No environmental data captured. Go to Range ->
 * Environmental Conditions" and disabled Save. It read only
 * `useEnvironmentStore().current`, which stays null until the Environmental
 * Data screen is opened, and the app has no Range tab.
 */

const HOUR = 3_600_000;

const snapshot = (ageMs: number) =>
  new EnvironmentSnapshot({
    ...validEnvironment({ temperature: 71 }),
    id: 42,
    timestamp: new Date(Date.now() - ageMs).toISOString(),
  });

const navigation = () =>
  ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }) as unknown as {
    navigate: jest.Mock;
    goBack: jest.Mock;
  };

const render = () =>
  renderWithProviders(
    <DOPELogEntry
      navigation={navigation() as never}
      route={{ params: {}, key: 'k', name: 'DOPELogEdit' } as never}
    />
  );

/** The store as a cold launch leaves it, with these snapshots on disk. */
const coldLaunchWith = (snapshots: EnvironmentSnapshot[]) => {
  useEnvironmentStore.setState({
    current: null,
    snapshots: [],
    loadSnapshots: jest.fn(async () => useEnvironmentStore.setState({ snapshots })),
    saveCurrent: jest.fn(),
  } as never);
};

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(dopeLogRepository, 'getLastFiredAt').mockResolvedValue(undefined);
  useDOPEStore.setState({ dopeLogs: [], createDopeLog: jest.fn().mockResolvedValue({}) });
  useRifleStore.setState({
    rifles: [new RifleProfile({ ...validRifle(), id: 1 })],
    loadRifles: jest.fn().mockResolvedValue(undefined),
  });
  useAmmoStore.setState({
    ammoProfiles: [new AmmoProfile({ ...validAmmo(), id: 1 })],
    loadAmmoProfiles: jest.fn().mockResolvedValue(undefined),
  });
});

const saveButton = (screen: ReturnType<typeof render>) =>
  screen.getByRole('button', { name: 'Save DOPE Log' });

/** A new log starts with no ammunition chosen; choose the one profile. */
const chooseAmmo = async (screen: ReturnType<typeof render>) => {
  fireEvent.press(await screen.findByLabelText(/^Ammunition:/));
  fireEvent.press(screen.getByLabelText('175gr SMK'));
};

describe('New DOPE Log conditions on a cold launch (#231)', () => {
  it('shows a snapshot under a day old instead of "No environmental data captured"', async () => {
    coldLaunchWith([snapshot(2 * HOUR)]);

    const screen = render();

    expect(await screen.findByText('Latest Conditions (2 hours old)')).toBeTruthy();
    expect(screen.getByText(/71°F/)).toBeTruthy();
    expect(screen.queryByText(/No environmental data captured/)).toBeNull();
  });

  it('saves the log against that snapshot, linked rather than copied', async () => {
    coldLaunchWith([snapshot(2 * HOUR)]);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const createDopeLog = jest.fn().mockResolvedValue({});
    useDOPEStore.setState({ createDopeLog });

    const screen = render();
    await screen.findByText('Latest Conditions (2 hours old)');
    await chooseAmmo(screen);

    expect(saveButton(screen)).not.toBeDisabled();
    await act(async () => {
      fireEvent.press(saveButton(screen));
    });

    expect(createDopeLog).toHaveBeenCalledWith(expect.objectContaining({ environmentId: 42 }));
    // A copy would carry a new timestamp and make the air look newly measured.
    expect(useEnvironmentStore.getState().saveCurrent).not.toHaveBeenCalled();
  });

  it('does not record against a snapshot over a day old, and says how old it is', async () => {
    coldLaunchWith([snapshot(30 * 24 * HOUR)]);

    const screen = render();

    expect(await screen.findByText(/The latest conditions are 30 days old/)).toBeTruthy();
    expect(screen.getByText(/Session tab: Current Conditions → Update/)).toBeTruthy();
    expect(screen.queryByText(/Latest Conditions/)).toBeNull();
    await chooseAmmo(screen);
    expect(saveButton(screen)).toBeDisabled();
  });

  it('names a screen that exists when there are no conditions at all', async () => {
    coldLaunchWith([]);

    const screen = render();

    expect(
      await screen.findByText(
        /No environmental data captured\. Record conditions on the Session tab/
      )
    ).toBeTruthy();
    expect(screen.queryByText(/Range →/)).toBeNull();
    await chooseAmmo(screen);
    expect(saveButton(screen)).toBeDisabled();
  });

  it('lets an existing log be edited without conditions recorded this launch', async () => {
    // The log already carries the conditions it was shot in; the old check
    // demanded `current` anyway, so Update was disabled on every cold launch.
    coldLaunchWith([]);
    jest.spyOn(dopeLogRepository, 'getById').mockResolvedValue(
      new DOPELog({
        ...validDopeLog({ rifleId: 1, ammoId: 1, environmentId: 5 }, { distance: 700 }),
        id: 7,
      })
    );

    const screen = renderWithProviders(
      <DOPELogEntry
        navigation={navigation() as never}
        route={{ params: { logId: 7 }, key: 'k', name: 'DOPELogEdit' } as never}
      />
    );

    expect(await screen.findByDisplayValue('700')).toBeTruthy();
    expect(screen.queryByText(/No environmental data captured/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Update DOPE Log' })).not.toBeDisabled();
  });
});
