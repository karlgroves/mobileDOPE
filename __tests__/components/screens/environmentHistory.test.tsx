import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert, FlatList } from 'react-native';

import { EnvironmentHistory } from '../../../src/screens/EnvironmentHistory';
import { EnvironmentInput } from '../../../src/screens/EnvironmentInput';
import { useEnvironmentStore } from '../../../src/store/useEnvironmentStore';
import { renderWithProviders } from '../../helpers/renderWithProviders';

import type { AlertButton } from 'react-native';

/**
 * Saved conditions: listing them, editing one, comparing two (#62).
 *
 * Two of that issue's boxes needed the same missing thing -- somewhere to
 * choose a reading -- and `environmentComparison` had been written, tested and
 * left with no caller for exactly that reason. The arithmetic is covered in
 * `environmentComparison.test.ts`; what is asserted here is the affordance, and
 * the one thing a comparison can silently get wrong: which of the two readings
 * is the earlier one.
 */

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  hasServicesEnabledAsync: jest.fn(() => Promise.resolve(false)),
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { High: 4 },
}));

jest.mock('../../../src/services/deviceBarometer', () => ({
  isBarometerAvailable: jest.fn(() => Promise.resolve(false)),
  readBarometerHpa: jest.fn(),
}));

/** A saved reading. `altitude` and `pressure` drive the density altitude. */
const snapshot = (
  id: number,
  over: Partial<{
    temperature: number;
    pressure: number;
    humidity: number;
    altitude: number;
    windSpeed: number;
    windDirection: number;
    timestamp: string;
  }> = {}
) => ({
  id,
  temperature: 59,
  pressure: 29.92,
  humidity: 50,
  altitude: 0,
  windSpeed: 5,
  windDirection: 90,
  timestamp: new Date(Date.UTC(2026, 0, id, 12, 0, 0)).toISOString(),
  ...over,
});

const loadSnapshots = jest.fn();
const updateSnapshot = jest.fn();
const deleteSnapshot = jest.fn();

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const seed = (snapshots: ReturnType<typeof snapshot>[]) => {
  useEnvironmentStore.setState({
    snapshots: snapshots as never,
    current: null,
    loadSnapshots,
    updateSnapshot,
    deleteSnapshot,
    loading: false,
  });
};

const renderHistory = () =>
  renderWithProviders(<EnvironmentHistory navigation={navigation as never} route={{} as never} />);

/** Presses the alert button whose text is `label`. */
const pressAlertButton = async (label: string) => {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const buttons = (calls[calls.length - 1][2] ?? []) as AlertButton[];
  const button = buttons.find((candidate) => candidate.text === label);
  if (!button?.onPress) throw new Error(`No alert button labelled "${label}"`);
  await button.onPress();
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  loadSnapshots.mockImplementation(() => Promise.resolve());
  updateSnapshot.mockImplementation(() => Promise.resolve({ id: 1 }));
  deleteSnapshot.mockImplementation(() => Promise.resolve());
});

describe('the saved-conditions list (#62)', () => {
  it('says what to do when nothing has been recorded', async () => {
    seed([]);
    const view = renderHistory();

    await waitFor(() => expect(view.getByText('No Saved Conditions')).toBeTruthy());
    fireEvent.press(view.getByText('Record Conditions'));
    expect(navigation.navigate).toHaveBeenCalledWith('EnvironmentInput');
  });

  it('lists every saved reading with its conditions and density altitude', async () => {
    seed([snapshot(2), snapshot(1)]);
    const view = renderHistory();

    await waitFor(() => expect(view.getByTestId('snapshot-2')).toBeTruthy());
    expect(view.getByTestId('snapshot-1')).toBeTruthy();
    expect(view.getAllByText(/Density altitude/)).toHaveLength(2);
  });

  it('derives a density altitude for a reading saved before the field existed', async () => {
    // `summariseConditions` prefers the stored figure and derives one otherwise,
    // so an older snapshot is still comparable rather than excluded.
    seed([snapshot(1, { temperature: 95, pressure: 24.9, altitude: 5000 })]);
    const view = renderHistory();

    await waitFor(() => expect(view.getByText(/Density altitude \d/)).toBeTruthy());
  });

  it('virtualises the list, because snapshots grow without limit', async () => {
    // A reading every time the shooter goes out, for years. A ScrollView with a
    // `.map` would mount every row before the first frame. #68's
    // `listVirtualisation` sweep gates this across the app; this pins it here,
    // where the screen can be seen to render only what is on screen.
    seed([snapshot(3), snapshot(2), snapshot(1)]);
    const view = renderHistory();

    await waitFor(() => expect(view.getByTestId('snapshot-1')).toBeTruthy());
    expect(view.UNSAFE_getByType(FlatList)).toBeTruthy();
  });

  it('loads the list on mount, for a deep link or a cold launch', async () => {
    seed([snapshot(1)]);
    renderHistory();

    await waitFor(() => expect(loadSnapshots).toHaveBeenCalled());
  });
});

describe('comparing two readings (#62)', () => {
  it('asks for two before comparing anything', async () => {
    seed([snapshot(2), snapshot(1)]);
    const view = renderHistory();

    await waitFor(() => expect(view.getByTestId('compare-prompt')).toBeTruthy());
    expect(view.getByTestId('compare-prompt').props.children).toContain('Choose two readings');

    fireEvent.press(view.getByTestId('snapshot-1'));

    expect(view.getByTestId('compare-prompt').props.children).toContain('one more');
    expect(view.queryByTestId('comparison')).toBeNull();
  });

  it('reports how the air changed once two are chosen', async () => {
    // Reading 1: standard day at sea level. Reading 2: hot and high. The air
    // got much thinner, and the headline is the density-altitude change rather
    // than four deltas to interpret.
    seed([snapshot(2, { temperature: 95, pressure: 24.9, altitude: 5000 }), snapshot(1)]);
    const view = renderHistory();

    await waitFor(() => expect(view.getByTestId('snapshot-1')).toBeTruthy());
    fireEvent.press(view.getByTestId('snapshot-1'));
    fireEvent.press(view.getByTestId('snapshot-2'));

    await waitFor(() => expect(view.getByTestId('comparison')).toBeTruthy());
    expect(view.getByTestId('comparison-summary').props.children).toMatch(/thinner/);
    expect(view.getByTestId('comparison-significant')).toBeTruthy();
  });

  it('orders the pair by when it was measured, not by the order they were tapped', async () => {
    // The one thing a comparison can get silently wrong. `compareEnvironments`
    // reports `later - earlier`, so tapping the older reading second must not
    // reverse the answer.
    const pair = [snapshot(2, { temperature: 95, pressure: 24.9, altitude: 5000 }), snapshot(1)];

    seed(pair);
    const inOrder = renderHistory();
    await waitFor(() => expect(inOrder.getByTestId('snapshot-1')).toBeTruthy());
    fireEvent.press(inOrder.getByTestId('snapshot-1'));
    fireEvent.press(inOrder.getByTestId('snapshot-2'));
    await waitFor(() => expect(inOrder.getByTestId('comparison-summary')).toBeTruthy());
    const forwards = inOrder.getByTestId('comparison-summary').props.children;
    inOrder.unmount();

    seed(pair);
    const reversed = renderHistory();
    await waitFor(() => expect(reversed.getByTestId('snapshot-2')).toBeTruthy());
    fireEvent.press(reversed.getByTestId('snapshot-2'));
    fireEvent.press(reversed.getByTestId('snapshot-1'));
    await waitFor(() => expect(reversed.getByTestId('comparison-summary')).toBeTruthy());

    expect(reversed.getByTestId('comparison-summary').props.children).toBe(forwards);
  });

  it('says conditions are the same when they are, and flags nothing', async () => {
    seed([snapshot(2), snapshot(1)]);
    const view = renderHistory();

    await waitFor(() => expect(view.getByTestId('snapshot-1')).toBeTruthy());
    fireEvent.press(view.getByTestId('snapshot-1'));
    fireEvent.press(view.getByTestId('snapshot-2'));

    await waitFor(() => expect(view.getByTestId('comparison-summary')).toBeTruthy());
    expect(view.getByTestId('comparison-summary').props.children).toMatch(/effectively the same/);
    expect(view.queryByTestId('comparison-significant')).toBeNull();
  });

  it('replaces the older choice when a third is picked', async () => {
    // So the shooter can walk the list comparing each reading against the one
    // they are holding on to, without clearing the selection between pairs.
    seed([snapshot(3), snapshot(2), snapshot(1)]);
    const view = renderHistory();

    await waitFor(() => expect(view.getByTestId('snapshot-1')).toBeTruthy());
    fireEvent.press(view.getByTestId('snapshot-1'));
    fireEvent.press(view.getByTestId('snapshot-2'));
    fireEvent.press(view.getByTestId('snapshot-3'));

    await waitFor(() => expect(view.getByTestId('comparison')).toBeTruthy());
    expect(view.getByTestId('snapshot-1').props.accessibilityState.checked).toBe(false);
    expect(view.getByTestId('snapshot-2').props.accessibilityState.checked).toBe(true);
    expect(view.getByTestId('snapshot-3').props.accessibilityState.checked).toBe(true);
  });

  it('names the selection in words, not only as a border', async () => {
    // WCAG 1.4.1: the border is a tint, so the state is also in the accessible
    // state and in visible text.
    seed([snapshot(1)]);
    const view = renderHistory();

    await waitFor(() => expect(view.getByTestId('snapshot-1')).toBeTruthy());
    fireEvent.press(view.getByTestId('snapshot-1'));

    expect(view.getByText('Selected')).toBeTruthy();
    expect(view.getByTestId('snapshot-1').props.accessibilityState.checked).toBe(true);
  });

  it('clears the selection on request', async () => {
    seed([snapshot(2), snapshot(1)]);
    const view = renderHistory();

    await waitFor(() => expect(view.getByTestId('snapshot-1')).toBeTruthy());
    fireEvent.press(view.getByTestId('snapshot-1'));
    fireEvent.press(view.getByTestId('snapshot-2'));
    await waitFor(() => expect(view.getByTestId('comparison')).toBeTruthy());

    fireEvent.press(view.getByText('Clear Selection'));

    await waitFor(() => expect(view.queryByTestId('comparison')).toBeNull());
  });
});

describe('editing and deleting a saved reading (#62)', () => {
  it('opens the capture screen on that reading', async () => {
    seed([snapshot(7)]);
    const view = renderHistory();

    await waitFor(() => expect(view.getByText('Edit')).toBeTruthy());
    fireEvent.press(view.getByText('Edit'));

    expect(navigation.navigate).toHaveBeenCalledWith('EnvironmentInput', { snapshotId: 7 });
  });

  it('asks before deleting, and says logs are unaffected', async () => {
    seed([snapshot(7)]);
    const view = renderHistory();

    await waitFor(() => expect(view.getByText('Delete')).toBeTruthy());
    fireEvent.press(view.getByText('Delete'));

    expect(deleteSnapshot).not.toHaveBeenCalled();
    expect((Alert.alert as jest.Mock).mock.calls[0][1]).toMatch(/logs are unaffected/);

    await pressAlertButton('Delete');
    await waitFor(() => expect(deleteSnapshot).toHaveBeenCalledWith(7));
  });
});

describe('the capture screen in edit mode (#62)', () => {
  const renderEdit = (snapshotId: number) =>
    renderWithProviders(
      <EnvironmentInput
        navigation={navigation as never}
        route={{ params: { snapshotId }, key: 'e', name: 'EnvironmentInput' } as never}
      />
    );

  it('fills the form from the saved reading', async () => {
    seed([snapshot(7, { temperature: 41, pressure: 28.5, humidity: 72, altitude: 6500 })]);
    const view = renderEdit(7);

    await waitFor(() => expect(view.getByLabelText(/^Temperature/).props.value).toBe('41'));
    // The field formats to its own precision, so 28.5 renders as 28.50.
    expect(view.getByLabelText(/^Station Pressure/).props.value).toBe('28.50');
    expect(view.getByLabelText(/^Altitude/).props.value).toBe('6500');
  });

  it('updates that reading rather than saving a new one', async () => {
    seed([snapshot(7)]);
    const view = renderEdit(7);

    await waitFor(() => expect(view.getByText('Save Changes')).toBeTruthy());
    fireEvent.press(view.getByText('Save Changes'));

    await waitFor(() => expect(updateSnapshot).toHaveBeenCalled());
    expect(updateSnapshot.mock.calls[0][0]).toBe(7);
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('does not re-stamp the time the conditions were measured', async () => {
    // #192's rule, which this screen is now a second write path for: the
    // timestamp records when the air was measured, and the DOPE ranking only
    // compares against conditions under a day old. Re-stamping an edited
    // reading would make air measured weeks ago look minutes old.
    seed([snapshot(7)]);
    const view = renderEdit(7);

    await waitFor(() => expect(view.getByText('Save Changes')).toBeTruthy());
    fireEvent.press(view.getByText('Save Changes'));

    await waitFor(() => expect(updateSnapshot).toHaveBeenCalled());
    expect(updateSnapshot.mock.calls[0][1]).not.toHaveProperty('timestamp');
  });

  it('says it is editing, and why the time stays put', async () => {
    seed([snapshot(7)]);
    const view = renderEdit(7);

    await waitFor(() => expect(view.getByText(/Editing a saved reading/)).toBeTruthy());
    expect(view.queryByText('Save to History')).toBeNull();
  });

  it('still captures a new reading when no id is given', async () => {
    seed([snapshot(7)]);
    const view = renderWithProviders(
      <EnvironmentInput
        navigation={navigation as never}
        route={{ params: {}, key: 'e', name: 'EnvironmentInput' } as never}
      />
    );

    await waitFor(() => expect(view.getByText('Save to History')).toBeTruthy());
    expect(view.queryByText('Save Changes')).toBeNull();
    fireEvent.press(view.getByText('Saved Conditions'));
    expect(navigation.navigate).toHaveBeenCalledWith('EnvironmentHistory');
  });
});
