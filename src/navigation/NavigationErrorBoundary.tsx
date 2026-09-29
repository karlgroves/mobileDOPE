import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';

import { ErrorBoundary } from '../components/ErrorBoundary';

/** Where RootNavigator saves its state between launches. */
export const NAVIGATION_PERSISTENCE_KEY = '@mobileDOPE:navigation_state';

/**
 * Forget the saved navigation state. The state is restored at launch, so
 * keeping it after a screen throws would reopen that screen on the next start.
 */
const forgetNavigationState = (): void => {
  AsyncStorage.removeItem(NAVIGATION_PERSISTENCE_KEY).catch((error) => {
    console.error('Failed to clear navigation state:', error);
  });
};

/**
 * Catches a render error anywhere in the navigator. Without it, one screen
 * throwing unmounted the whole tree and left a blank screen. "Try Again"
 * remounts the navigator, which then starts from its initial route.
 */
export const NavigationErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary onError={forgetNavigationState}>{children}</ErrorBoundary>
);
