import { waitFor } from '@testing-library/react-native';
import React from 'react';

import { DOPELogList } from '../../../src/screens/DOPELogList';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useDOPEStore } from '../../../src/store/useDOPEStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { renderWithProviders } from '../../helpers/renderWithProviders';

/**
 * DOPE Logs reloads every time it comes back into view (#229).
 *
 * Other screens replace the store's logs with a filtered set (Wind Table loads
 * one rifle and ammo), so the list cannot rely on what the store holds when
 * the tab is shown again; it reads every log afresh on focus, as it did only
 * on mount before.
 */

const loadDopeLogs = jest.fn().mockResolvedValue(undefined);

const renderWithFocus = () => {
  const listeners: Record<string, () => void> = {};
  const unsubscribe = jest.fn();
  const navigation = {
    navigate: jest.fn(),
    addListener: jest.fn((event: string, handler: () => void) => {
      listeners[event] = handler;
      return unsubscribe;
    }),
  };
  const view = renderWithProviders(
    <DOPELogList navigation={navigation as never} route={{} as never} />
  );
  return { focus: () => listeners.focus?.(), unsubscribe, unmount: view.unmount };
};

beforeEach(() => {
  jest.clearAllMocks();
  useDOPEStore.setState({ dopeLogs: [], loadDopeLogs });
  useRifleStore.setState({ rifles: [] });
  useAmmoStore.setState({ ammoProfiles: [] });
});

it('loads every log again each time the screen regains focus', async () => {
  const { focus } = renderWithFocus();

  focus();
  await waitFor(() => expect(loadDopeLogs).toHaveBeenCalledTimes(1));
  focus();
  await waitFor(() => expect(loadDopeLogs).toHaveBeenCalledTimes(2));
  // Unfiltered: a rifle-filtered load would hide every other rifle's logs.
  expect(loadDopeLogs).toHaveBeenLastCalledWith();
});

it('stops listening when the screen unmounts', () => {
  const { unsubscribe, unmount } = renderWithFocus();
  unmount();
  expect(unsubscribe).toHaveBeenCalled();
});
