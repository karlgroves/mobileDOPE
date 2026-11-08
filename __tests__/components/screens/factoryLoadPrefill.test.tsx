import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { factoryLoadById } from '../../../src/constants/factoryLoads';
import { AmmoProfile } from '../../../src/models/AmmoProfile';
import { AmmoProfileForm } from '../../../src/screens/AmmoProfileForm';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { validAmmo } from '../../helpers/fixtures';
import { renderWithProviders } from '../../helpers/renderWithProviders';

/**
 * Starting a new ammunition profile from a factory load (#225).
 *
 * The table only pre-fills the form. These pin the two halves of that: the
 * published figures land in the fields, and what is saved is whatever the
 * fields say afterwards -- including anything the shooter changed.
 */

let mockRouteParams: Record<string, unknown> | undefined;
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
  useRoute: () => ({ key: 'k', name: 'AmmoProfileForm', params: mockRouteParams }),
}));

const create = jest.fn();
const update = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = undefined;
  create.mockResolvedValue(undefined);
  update.mockResolvedValue(undefined);
  useAmmoStore.setState({
    ammoProfiles: [new AmmoProfile({ ...validAmmo(), id: 7 })],
    createAmmoProfile: create,
    updateAmmoProfile: update,
  });
});

const PICKER = 'Factory Load: Optional: start from a factory load';
const HORNADY_168 = 'Hornady 308 Win 168 gr ELD Match';

const pickLoad = (screen: ReturnType<typeof renderWithProviders>, name: string) => {
  fireEvent.press(screen.getByLabelText(PICKER));
  fireEvent.press(screen.getByRole('radio', { name }));
};

it('fills the form with the published figures', () => {
  const screen = renderWithProviders(<AmmoProfileForm />);

  pickLoad(screen, HORNADY_168);

  expect(screen.getByDisplayValue(HORNADY_168)).toBeTruthy();
  expect(screen.getByDisplayValue('Hornady')).toBeTruthy();
  expect(screen.getByDisplayValue('ELD Match')).toBeTruthy();
  expect(screen.getByDisplayValue('0.523')).toBeTruthy();
  expect(screen.getByDisplayValue('0.263')).toBeTruthy();
  expect(screen.getByDisplayValue('2700')).toBeTruthy();
  // The caliber picker now shows the load's caliber.
  expect(screen.getByLabelText(/^Caliber: \.308\/7\.62x51mm/)).toBeTruthy();
  // And the note says where the numbers came from and what barrel they describe.
  expect(
    screen.getByDisplayValue(/Factory figures: Hornady #80966, 2700 fps from a 24 in\. test barrel/)
  ).toBeTruthy();
});

it('saves what the shooter changed, not the factory figure', async () => {
  const screen = renderWithProviders(<AmmoProfileForm />);

  pickLoad(screen, HORNADY_168);
  const velocity = screen.getByDisplayValue('2700');
  fireEvent.changeText(velocity, '2645');
  fireEvent(velocity, 'blur');
  fireEvent.press(screen.getByText('Create'));

  await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  expect(create).toHaveBeenCalledTimes(1);
  const load = factoryLoadById('hornady-80966')!;
  expect(create.mock.calls[0][0]).toMatchObject({
    name: load.name,
    manufacturer: 'Hornady',
    caliber: '.308 Winchester',
    bulletWeight: 168,
    bulletType: 'ELD Match',
    ballisticCoefficientG1: 0.523,
    ballisticCoefficientG7: 0.263,
    muzzleVelocity: 2645,
  });
});

it('keeps notes the shooter already wrote', () => {
  const screen = renderWithProviders(<AmmoProfileForm />);

  fireEvent.changeText(screen.getByLabelText('Notes about this ammunition'), 'Lot from the club');
  pickLoad(screen, HORNADY_168);

  expect(screen.getByDisplayValue('Lot from the club')).toBeTruthy();
});

it('offers the loads for the caliber the form was opened with', () => {
  mockRouteParams = { caliber: '6.5 Creedmoor' };
  const screen = renderWithProviders(<AmmoProfileForm />);

  fireEvent.press(screen.getByLabelText(PICKER));

  expect(
    screen.getByRole('radio', { name: 'Hornady 6.5 Creedmoor 140 gr ELD Match' })
  ).toBeTruthy();
  expect(screen.queryByRole('radio', { name: HORNADY_168 })).toBeNull();
});

it('is not offered when editing a saved profile, which it would overwrite', () => {
  mockRouteParams = { ammoId: 7 };
  const screen = renderWithProviders(<AmmoProfileForm />);

  expect(screen.queryByLabelText(PICKER)).toBeNull();
});
