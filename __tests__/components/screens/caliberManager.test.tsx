import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert, type AlertButton } from 'react-native';

import { CaliberManagerScreen } from '../../../src/screens/CaliberManagerScreen';
import {
  deleteCustomCaliber,
  getCaliberUsage,
  saveCustomCaliber,
} from '../../../src/services/CaliberService';
import { useAppStore } from '../../../src/store/useAppStore';
import { renderWithProviders } from '../../helpers/renderWithProviders';

/**
 * Settings > Manage Calibers (#67). What the service does to profiles is
 * tested against a real database in CaliberService.test.ts; this pins what the
 * shooter is shown and asked before it happens.
 */

jest.mock('../../../src/services/CaliberService', () => ({
  saveCustomCaliber: jest.fn(),
  deleteCustomCaliber: jest.fn(),
  getCaliberUsage: jest.fn(),
}));

const save = saveCustomCaliber as jest.Mock;
const remove = deleteCustomCaliber as jest.Mock;
const usage = getCaliberUsage as jest.Mock;
const wildcat = { name: '6.5 Wildcat', diameter: 0.264 };

const setCustom = (customCalibers: { name: string; diameter: number }[]) =>
  useAppStore.setState((s) => ({ settings: { ...s.settings, customCalibers } }));

const renderScreen = () =>
  renderWithProviders(
    <CaliberManagerScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />
  );

/** Presses the named button in the most recent alert. */
const choose = async (text: string) => {
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as AlertButton[];
  await buttons.find((b) => b.text === text)?.onPress?.();
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  save.mockResolvedValue({ ok: true, caliber: wildcat, renamed: { rifles: 0, ammos: 0 } });
  usage.mockResolvedValue({ rifles: 0, ammos: 0 });
  remove.mockResolvedValue({ deleted: true });
});

afterEach(() => setCustom([]));

it('says there are none yet, and that the built-in list cannot be changed', () => {
  setCustom([]);
  const { getByText } = renderScreen();

  expect(getByText('No custom calibers yet')).toBeTruthy();
  expect(getByText(/built-in calibers cannot be changed or deleted/)).toBeTruthy();
});

it('lists the shooter’s calibers with their diameters', () => {
  setCustom([wildcat]);
  const { getByText } = renderScreen();

  expect(getByText('6.5 Wildcat')).toBeTruthy();
  expect(getByText('0.264 in')).toBeTruthy();
});

it('adds a caliber from the form', async () => {
  setCustom([]);
  const { getByLabelText, getByText } = renderScreen();

  fireEvent.changeText(getByLabelText('Caliber name'), '6.5 Wildcat');
  fireEvent.changeText(getByLabelText('Bullet diameter, inches'), '0.264');
  fireEvent.press(getByText('Add Caliber'));

  await waitFor(() => expect(save).toHaveBeenCalledWith(wildcat, undefined));
});

it('shows why a caliber was not saved', async () => {
  save.mockResolvedValue({ ok: false, errors: { name: 'That caliber is already built in' } });
  const { getByLabelText, getByText, findByText } = renderScreen();

  fireEvent.changeText(getByLabelText('Caliber name'), '6.5 Creedmoor');
  fireEvent.changeText(getByLabelText('Bullet diameter, inches'), '0.264');
  fireEvent.press(getByText('Add Caliber'));

  expect(await findByText('That caliber is already built in')).toBeTruthy();
});

it('asks before a rename carries profiles with it, and only then renames', async () => {
  setCustom([wildcat]);
  usage.mockResolvedValue({ rifles: 2, ammos: 1 });
  const { getByLabelText, getByText } = renderScreen();

  fireEvent.press(getByLabelText('Edit 6.5 Wildcat'));
  fireEvent.changeText(getByLabelText('Caliber name'), '6.5 Kestrel');
  fireEvent.press(getByText('Save Changes'));

  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith(
      'Rename Caliber',
      expect.stringMatching(/2 rifles and 1 ammo profile .*6\.5 Kestrel/s),
      expect.any(Array)
    )
  );
  expect(save).not.toHaveBeenCalled();

  await choose('Rename');
  expect(save).toHaveBeenCalledWith({ name: '6.5 Kestrel', diameter: 0.264 }, '6.5 Wildcat');
});

it('renames without asking when nothing uses the caliber', async () => {
  setCustom([wildcat]);
  const { getByLabelText, getByText } = renderScreen();

  fireEvent.press(getByLabelText('Edit 6.5 Wildcat'));
  fireEvent.changeText(getByLabelText('Caliber name'), '6.5 Kestrel');
  fireEvent.press(getByText('Save Changes'));

  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({ name: '6.5 Kestrel', diameter: 0.264 }, '6.5 Wildcat')
  );
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('refuses to delete a caliber in use, and says what uses it', async () => {
  setCustom([wildcat]);
  usage.mockResolvedValue({ rifles: 1, ammos: 0 });
  const { getByLabelText } = renderScreen();

  fireEvent.press(getByLabelText('Delete 6.5 Wildcat'));

  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith(
      'Caliber In Use',
      expect.stringMatching(/1 rifle .*uses? 6\.5 Wildcat/s)
    )
  );
  expect(remove).not.toHaveBeenCalled();
});

it('deletes an unused caliber after confirmation', async () => {
  setCustom([wildcat]);
  const { getByLabelText } = renderScreen();

  fireEvent.press(getByLabelText('Delete 6.5 Wildcat'));
  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete Caliber',
      expect.any(String),
      expect.any(Array)
    )
  );
  expect(remove).not.toHaveBeenCalled();

  await choose('Delete');
  expect(remove).toHaveBeenCalledWith('6.5 Wildcat');
});
