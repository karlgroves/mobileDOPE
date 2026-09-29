import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Text } from 'react-native';

import {
  NAVIGATION_PERSISTENCE_KEY,
  NavigationErrorBoundary,
} from '../../../src/navigation/NavigationErrorBoundary';
import { renderWithProviders } from '../../helpers/renderWithProviders';

/**
 * A render error in any screen used to unmount the whole tree and leave a
 * black screen: `ErrorBoundary` existed and was tested, and nothing mounted it.
 * Seen on the iOS Simulator when DOPE Log Details threw.
 *
 * RootNavigator persists its state on every change and restores it at launch,
 * so a screen that throws would be reopened on the next start. The boundary
 * forgets that saved state when it catches.
 */

const Throws: React.FC = () => {
  throw new Error('screen blew up');
};

const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalError;
});

describe('NavigationErrorBoundary', () => {
  beforeEach(async () => {
    await AsyncStorage.setItem(NAVIGATION_PERSISTENCE_KEY, JSON.stringify({ routes: [] }));
  });

  it('renders the navigator when nothing throws', () => {
    const { getByText } = renderWithProviders(
      <NavigationErrorBoundary>
        <Text>navigator</Text>
      </NavigationErrorBoundary>
    );

    expect(getByText('navigator')).toBeTruthy();
  });

  it('shows a recovery screen instead of nothing when a screen throws', async () => {
    const { findByText } = renderWithProviders(
      <NavigationErrorBoundary>
        <Throws />
      </NavigationErrorBoundary>
    );

    expect(await findByText('Something went wrong')).toBeTruthy();
    expect(await findByText('Try Again')).toBeTruthy();
  });

  it('forgets the saved navigation state, so a relaunch does not reopen the screen', async () => {
    const { findByText } = renderWithProviders(
      <NavigationErrorBoundary>
        <Throws />
      </NavigationErrorBoundary>
    );
    await findByText('Something went wrong');

    expect(await AsyncStorage.getItem(NAVIGATION_PERSISTENCE_KEY)).toBeNull();
  });

  it('keeps the saved state when nothing throws', async () => {
    renderWithProviders(
      <NavigationErrorBoundary>
        <Text>navigator</Text>
      </NavigationErrorBoundary>
    );

    expect(await AsyncStorage.getItem(NAVIGATION_PERSISTENCE_KEY)).not.toBeNull();
  });
});
