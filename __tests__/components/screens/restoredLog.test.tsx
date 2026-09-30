import { act, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { AmmoProfile } from '../../../src/models/AmmoProfile';
import { DOPELog } from '../../../src/models/DOPELog';
import { RifleProfile } from '../../../src/models/RifleProfile';
import { DOPELogDetail } from '../../../src/screens/DOPELogDetail';
import { DOPELogEntry } from '../../../src/screens/DOPELogEntry';
import { dopeLogRepository } from '../../../src/services/database';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useDOPEStore } from '../../../src/store/useDOPEStore';
import { useEnvironmentStore } from '../../../src/store/useEnvironmentStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { validAmmo, validDopeLog, validRifle } from '../../helpers/fixtures';
import { renderWithProviders } from '../../helpers/renderWithProviders';

/**
 * Screens restored on launch, before DOPE Logs has loaded the store (#141).
 *
 * Seen on the iOS Simulator: relaunching with a log's screens open alerted
 * "DOPE log not found" over a log that exists. DOPE Log Edit built its form
 * from a new log's defaults (distance 100, corrections 0) under an "Update DOPE
 * Log" title, and kept them after the log arrived.
 */

const saved = () =>
  new DOPELog({
    ...validDopeLog(
      { rifleId: 1, ammoId: 1, environmentId: 5 },
      { distance: 700, elevationCorrection: 7.2, windageCorrection: 0.3 }
    ),
    id: 7,
  });

const navigation = () =>
  ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }) as unknown as {
    navigate: jest.Mock;
    goBack: jest.Mock;
  };

const route = (name: string) => ({ params: { logId: 7 }, key: 'k', name }) as never;

beforeEach(() => {
  jest.restoreAllMocks();
  // The store has not been loaded yet, as on a restored launch.
  useDOPEStore.setState({ dopeLogs: [] });
  useRifleStore.setState({
    rifles: [new RifleProfile({ ...validRifle(), id: 1 })],
    loadRifles: jest.fn().mockResolvedValue(undefined),
  });
  useAmmoStore.setState({
    ammoProfiles: [new AmmoProfile({ ...validAmmo(), id: 1 })],
    loadAmmoProfiles: jest.fn().mockResolvedValue(undefined),
  });
  useEnvironmentStore.setState({ current: undefined } as never);
});

describe('DOPE Log Details restored before the store loads', () => {
  it('shows the log, not "not found"', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(dopeLogRepository, 'getById').mockResolvedValue(saved());

    const { findByText } = renderWithProviders(
      <DOPELogDetail route={route('DOPELogDetail')} navigation={navigation() as never} />
    );

    expect(await findByText('700 yards')).toBeTruthy();
    expect(alert).not.toHaveBeenCalled();
  });

  it('still says so when the log really is gone', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(dopeLogRepository, 'getById').mockResolvedValue(null);

    renderWithProviders(
      <DOPELogDetail route={route('DOPELogDetail')} navigation={navigation() as never} />
    );

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Error', 'DOPE log not found', expect.anything())
    );
  });
});

describe('DOPE Log Details after deleting the log', () => {
  it('goes back without also saying "DOPE log not found"', async () => {
    // Deleting empties the store before the screen has animated away; the
    // screen then read the log as missing and alerted over the list. It did
    // this before #141 too.
    const alerts: unknown[] = [];
    jest.spyOn(Alert, 'alert').mockImplementation((_title, message, buttons) => {
      alerts.push(message);
      (buttons as { text: string; onPress?: () => void }[] | undefined)
        ?.find((b) => b.text === 'Delete')
        ?.onPress?.();
    });
    jest.spyOn(dopeLogRepository, 'getById').mockResolvedValue(null);
    useDOPEStore.setState({
      dopeLogs: [saved()],
      deleteDopeLog: jest.fn(async () => useDOPEStore.setState({ dopeLogs: [] })),
    });
    const nav = navigation();

    const { getByText } = renderWithProviders(
      <DOPELogDetail route={route('DOPELogDetail')} navigation={nav as never} />
    );
    await act(async () => {
      fireEvent.press(getByText('Delete'));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(nav.goBack).toHaveBeenCalledTimes(1);
    expect(alerts).not.toContain('DOPE log not found');
  });
});

describe('DOPE Log Edit restored before the store loads', () => {
  it("fills the form from the log, not from a new log's defaults", async () => {
    jest.spyOn(dopeLogRepository, 'getById').mockResolvedValue(saved());

    const { findByDisplayValue, queryByDisplayValue } = renderWithProviders(
      <DOPELogEntry route={route('DOPELogEdit')} navigation={navigation() as never} />
    );

    expect(await findByDisplayValue('700')).toBeTruthy();
    expect(await findByDisplayValue('7.20')).toBeTruthy();
    expect(queryByDisplayValue('100')).toBeNull();
  });

  it('fills the form from the log when DOPE Logs fills the store a moment later', async () => {
    // As on the device: the list screen underneath loads the store after
    // Edit's first render. The form used to keep the defaults it started with
    // (distance 100) under an "Update DOPE Log" title. The database read is
    // left pending so only the store path is in play.
    jest.spyOn(dopeLogRepository, 'getById').mockReturnValue(new Promise(() => {}));

    const { findByDisplayValue, queryByDisplayValue } = renderWithProviders(
      <DOPELogEntry route={route('DOPELogEdit')} navigation={navigation() as never} />
    );
    await act(async () => {
      useDOPEStore.setState({ dopeLogs: [saved()] });
    });

    expect(await findByDisplayValue('700')).toBeTruthy();
    expect(queryByDisplayValue('100')).toBeNull();
  });

  it('updates the log with its own values once loaded', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(dopeLogRepository, 'getById').mockResolvedValue(saved());
    const update = jest.fn().mockResolvedValue(undefined);
    useDOPEStore.setState({ updateDopeLog: update });
    useEnvironmentStore.setState({ current: { id: 5 } } as never);

    const { findByText } = renderWithProviders(
      <DOPELogEntry route={route('DOPELogEdit')} navigation={navigation() as never} />
    );
    fireEvent.press(await findByText('Update DOPE Log'));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const [id, data] = update.mock.calls[0];
    expect(id).toBe(7);
    expect(data).toMatchObject({
      ammoId: 1,
      environmentId: 5,
      distance: 700,
      elevationCorrection: 7.2,
      windageCorrection: 0.3,
    });
  });
});
