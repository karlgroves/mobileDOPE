import { act, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { AmmoProfile } from '../../../src/models/AmmoProfile';
import { RifleProfile } from '../../../src/models/RifleProfile';
import { DOPELogEntry } from '../../../src/screens/DOPELogEntry';
import { RangeSessionStart } from '../../../src/screens/RangeSessionStart';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useEnvironmentStore } from '../../../src/store/useEnvironmentStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { validAmmo, validRifle } from '../../helpers/fixtures';
import { renderWithProviders } from '../../helpers/renderWithProviders';

/**
 * A screen that needs a rifle and ammunition says so when there are none, and
 * takes the shooter to where they can make one (#132).
 *
 * New DOPE Log rendered its whole form with empty pickers, and Range Session
 * Start's "Go to Rifles" button had an empty handler. Both were found by using
 * the app on the iOS Simulator after a fresh install.
 */

const navigation = () =>
  ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }) as unknown as {
    navigate: jest.Mock;
  };

const logRoute = { params: {}, key: 'k', name: 'DOPELogEdit' } as never;
const sessionRoute = { params: {}, key: 'k', name: 'RangeSessionStart' } as never;

const stores = (rifles: boolean, ammo: boolean): void => {
  useRifleStore.setState({
    rifles: rifles ? [new RifleProfile({ ...validRifle(), id: 1 })] : [],
    loading: false,
    // The screens load on mount; these tests seed the stores instead.
    loadRifles: jest.fn().mockResolvedValue(undefined),
  });
  useAmmoStore.setState({
    ammoProfiles: ammo ? [new AmmoProfile({ ...validAmmo(), id: 1 })] : [],
    loading: false,
    loadAmmoProfiles: jest.fn().mockResolvedValue(undefined),
  });
  useEnvironmentStore.setState({
    snapshots: [],
    loading: false,
    loadSnapshots: jest.fn().mockResolvedValue(undefined),
  });
};

describe('New DOPE Log with no profiles (#132)', () => {
  it('asks for a rifle profile first, and goes to Rifles', async () => {
    stores(false, false);
    const nav = navigation();
    const { getByText, queryByText, findByText } = renderWithProviders(
      <DOPELogEntry route={logRoute} navigation={nav as never} />
    );

    expect(await findByText('No Rifle Profiles')).toBeTruthy();
    // Not the form with nothing to pick.
    expect(queryByText('Select Rifle')).toBeNull();

    fireEvent.press(getByText('Go to Rifles'));
    expect(nav.navigate).toHaveBeenCalledWith('Rifles');
  });

  it('asks for ammunition when there is a rifle but no load, and goes to Ammo', async () => {
    stores(true, false);
    const nav = navigation();
    const { getByText, queryByText, findByText } = renderWithProviders(
      <DOPELogEntry route={logRoute} navigation={nav as never} />
    );

    expect(await findByText('No Ammunition Profiles')).toBeTruthy();
    expect(queryByText('Select Ammunition')).toBeNull();

    fireEvent.press(getByText('Go to Ammo'));
    expect(nav.navigate).toHaveBeenCalledWith('Ammo');
  });

  it('shows the form once there is a rifle and a load', () => {
    stores(true, true);
    const { queryByText, getByText } = renderWithProviders(
      <DOPELogEntry route={logRoute} navigation={navigation() as never} />
    );

    expect(queryByText('No Rifle Profiles')).toBeNull();
    expect(queryByText('No Ammunition Profiles')).toBeNull();
    expect(getByText('Rifle & Ammunition')).toBeTruthy();
  });
});

describe('New DOPE Log before the profiles have loaded (#132 review)', () => {
  /**
   * Found on the Simulator: relaunching into New DOPE Log restores the screen
   * before anything has loaded the rifle store. The screen has to load what it
   * needs, and must not call an unloaded store "no profiles".
   */
  const rifle = () => new RifleProfile({ ...validRifle({ name: 'Tikka T3x' }), id: 7 });

  it('loads every rifle and every load itself, not one caliber', async () => {
    stores(false, false);
    renderWithProviders(<DOPELogEntry route={logRoute} navigation={navigation() as never} />);
    await act(async () => {});

    expect(useRifleStore.getState().loadRifles).toHaveBeenCalled();
    // AmmoProfileList loads one caliber into the shared store; this must not
    // inherit that.
    expect(useAmmoStore.getState().loadAmmoProfiles).toHaveBeenCalledWith();
  });

  it('does not say "No Rifle Profiles" while the rifles are still loading', async () => {
    stores(false, false);
    let finishLoading: () => void = () => undefined;
    useRifleStore.setState({
      loadRifles: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            finishLoading = () => {
              useRifleStore.setState({ rifles: [rifle()] });
              useAmmoStore.setState({
                ammoProfiles: [new AmmoProfile({ ...validAmmo(), id: 1 })],
              });
              resolve();
            };
          })
      ),
    });

    const { queryByText, findByText } = renderWithProviders(
      <DOPELogEntry route={logRoute} navigation={navigation() as never} />
    );
    expect(queryByText('No Rifle Profiles')).toBeNull();

    await act(async () => finishLoading());

    // The rifle that arrived late is the one selected, not "Select Rifle".
    expect(await findByText('Tikka T3x')).toBeTruthy();
    expect(queryByText('No Rifle Profiles')).toBeNull();
  });

  it('does not say "No Ammunition Profiles" while the ammunition is still loading', async () => {
    // Rifles already in the store (the Dashboard loaded them), ammunition not
    // yet -- or holding only another caliber, as AmmoProfileList leaves it.
    stores(true, false);
    let finishLoading: () => void = () => undefined;
    useAmmoStore.setState({
      loadAmmoProfiles: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            finishLoading = () => {
              useAmmoStore.setState({
                ammoProfiles: [new AmmoProfile({ ...validAmmo(), id: 1 })],
              });
              resolve();
            };
          })
      ),
    });

    const { queryByText, findByText } = renderWithProviders(
      <DOPELogEntry route={logRoute} navigation={navigation() as never} />
    );
    expect(queryByText('No Ammunition Profiles')).toBeNull();

    await act(async () => finishLoading());

    expect(await findByText('Rifle & Ammunition')).toBeTruthy();
    expect(queryByText('No Ammunition Profiles')).toBeNull();
  });
});

describe('Range Session Start with no rifles', () => {
  it('"Go to Rifles" goes to Rifles', () => {
    stores(false, false);
    const nav = navigation();
    const { getByText } = renderWithProviders(
      <RangeSessionStart route={sessionRoute} navigation={nav as never} />
    );

    fireEvent.press(getByText('Go to Rifles'));
    expect(nav.navigate).toHaveBeenCalledWith('Rifles');
  });
});
