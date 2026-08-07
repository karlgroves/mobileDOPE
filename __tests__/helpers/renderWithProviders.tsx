import { render } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider } from '../../src/contexts/ThemeContext';

import type { RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

/**
 * Wraps a component in the providers the app supplies at runtime.
 *
 * Components that call `useTheme()` throw "useTheme must be used within a
 * ThemeProvider" when rendered bare, so any component test that touches the theme
 * must go through this instead of RNTL's `render` directly. Screens (issue #28
 * phase 6) will need this too.
 */
const AllProviders = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

/**
 * Drop-in replacement for `@testing-library/react-native`'s `render` that mounts the
 * app's provider tree around `ui`.
 */
export const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): ReturnType<typeof render> => render(ui, { wrapper: AllProviders, ...options });
