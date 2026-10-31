import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { RangeSessionStart } from '../../../src/screens/RangeSessionStart';
import { rangeSessionRepository } from '../../../src/services/database/RangeSessionRepository';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useEnvironmentStore } from '../../../src/store/useEnvironmentStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { renderWithProviders } from '../../helpers/renderWithProviders';

import type { AlertButton } from 'react-native';

/**
 * Session start does not re-stamp the conditions it copies (#192).
 *
 * The screen gives a session an environment of its own by copying the latest
 * snapshot. It used to stamp the copy `new Date()`, which made conditions
 * measured weeks ago look minutes old and defeated #190's 24-hour limit on
 * ranking against the latest snapshot.
 *
 * The stores and the session repository are mocked at their boundaries; the
 * staleness decision, the copy and the warning are real.
 */

const THIRTY_DAYS_MS = 30 * 86_400_000;

const navigation = { navigate: jest.fn() };

const rifle = { id: 1, name: 'Test Rifle', caliber: '.308 Winchester' };
const ammo = { id: 2, name: 'Test Load', caliber: '.308 Winchester' };

/** A stored snapshot measured `ms` ago. */
const snapshotMeasured = (ms: number) => ({
  id: 7,
  temperature: 59,
  humidity: 50,
  pressure: 29.92,
  altitude: 1200,
  windSpeed: 5,
  windDirection: 90,
  densityAltitude: 1500,
  timestamp: new Date(Date.now() - ms).toISOString(),
});

const createSnapshot = jest.fn();

/** Mounts the screen with one rifle, one load and `snapshot` as the latest. */
const mount = (snapshot: ReturnType<typeof snapshotMeasured>) => {
  useRifleStore.setState({ rifles: [rifle] as never, loadRifles: jest.fn(), loading: false });
  useAmmoStore.setState({
    ammoProfiles: [ammo] as never,
    loadAmmoProfiles: jest.fn(),
    loading: false,
  });
  useEnvironmentStore.setState({
    snapshots: [snapshot] as never,
    loadSnapshots: jest.fn(),
    createSnapshot,
    loading: false,
  });

  return renderWithProviders(
    <RangeSessionStart navigation={navigation as never} route={{} as never} />
  );
};

/** Picks a rifle and a load, then presses Start. */
const startSession = async (view: ReturnType<typeof mount>) => {
  fireEvent.press(view.getByText('Select a rifle'));
  fireEvent.press(await view.findByText('Test Rifle'));
  fireEvent.press(view.getByText('Select ammunition'));
  fireEvent.press(await view.findByText('Test Load'));
  fireEvent.press(view.getByText('Start Range Session'));
};

/** The buttons of the most recent `Alert.alert` call. */
const alertButtons = (): AlertButton[] => {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  return (calls[calls.length - 1][2] ?? []) as AlertButton[];
};

/** Presses the alert button whose text is `label`. */
const pressAlertButton = (label: string) => {
  const button = alertButtons().find((candidate) => candidate.text === label);
  if (!button?.onPress) throw new Error(`No alert button labelled "${label}"`);
  button.onPress();
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  createSnapshot.mockImplementation((data: { timestamp?: string }) =>
    Promise.resolve({ ...data, id: 99 })
  );
  jest
    .spyOn(rangeSessionRepository, 'create')
    .mockImplementation(() => Promise.resolve({ id: 42 } as never));
});

describe('RangeSessionStart with fresh conditions (#192)', () => {
  it("copies the source snapshot's own measurement time, not now", async () => {
    const latest = snapshotMeasured(2 * 3_600_000);
    const view = mount(latest);

    await startSession(view);

    await waitFor(() => expect(createSnapshot).toHaveBeenCalled());
    expect(createSnapshot.mock.calls[0][0].timestamp).toBe(latest.timestamp);
    expect(rangeSessionRepository.create).toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('starts the session and navigates to it', async () => {
    const view = mount(snapshotMeasured(60_000));

    await startSession(view);

    await waitFor(() =>
      expect(navigation.navigate).toHaveBeenCalledWith('RangeSessionActive', { sessionId: 42 })
    );
  });
});

describe('RangeSessionStart with stale conditions (#192)', () => {
  it('does not start silently on a 30-day-old snapshot', async () => {
    const view = mount(snapshotMeasured(THIRTY_DAYS_MS));

    await startSession(view);

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(createSnapshot).not.toHaveBeenCalled();
    expect(rangeSessionRepository.create).not.toHaveBeenCalled();
  });

  it('says how old the conditions are, and why it matters', async () => {
    const view = mount(snapshotMeasured(THIRTY_DAYS_MS));

    await startSession(view);

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    const [title, message] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toBe('Stale Conditions');
    expect(message).toContain('30 days old');
    expect(message).toContain('will not be compared');
  });

  it('offers the Environment screen', async () => {
    const view = mount(snapshotMeasured(THIRTY_DAYS_MS));

    await startSession(view);

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    pressAlertButton('Update Conditions');
    expect(navigation.navigate).toHaveBeenCalledWith('EnvironmentInput');
  });

  it('lets the shooter start anyway, still without re-stamping the air', async () => {
    // A shooter standing at the range with a 25-hour-old reading may well want
    // to go on. What they must not get is a session whose conditions claim to
    // have been measured just now -- the ranking would then compare against
    // them, which is the defect.
    const latest = snapshotMeasured(THIRTY_DAYS_MS);
    const view = mount(latest);

    await startSession(view);
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    pressAlertButton('Start Anyway');

    await waitFor(() => expect(createSnapshot).toHaveBeenCalled());
    expect(createSnapshot.mock.calls[0][0].timestamp).toBe(latest.timestamp);
  });

  it('warns the same way when the snapshot has no timestamp at all', async () => {
    const view = mount({ ...snapshotMeasured(0), timestamp: undefined as never });

    await startSession(view);

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect((Alert.alert as jest.Mock).mock.calls[0][1]).toContain('of unknown age');
    expect(createSnapshot).not.toHaveBeenCalled();
  });
});
