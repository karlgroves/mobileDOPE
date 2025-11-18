/**
 * Main application state store
 * Manages app-level state including settings, theme, and initialization
 */

import { create } from 'zustand';
import type { ThemeMode } from '../constants/colors';

interface AppSettings {
  defaultDistanceUnit: 'yards' | 'meters';
  defaultCorrectionUnit: 'MIL' | 'MOA';
  themeMode: ThemeMode;
  lastSelectedRifleId?: number;
  lastSelectedAmmoId?: number;
}

interface AppState {
  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;

  // Initialization
  isInitialized: boolean;
  setInitialized: (value: boolean) => void;

  // Database
  isDatabaseReady: boolean;
  setDatabaseReady: (value: boolean) => void;

  // Loading states
  isLoading: boolean;
  setLoading: (value: boolean) => void;

  // Error state
  error: string | null;
  setError: (error: string | null) => void;
  clearError: () => void;
}

const defaultSettings: AppSettings = {
  defaultDistanceUnit: 'yards',
  defaultCorrectionUnit: 'MIL',
  themeMode: 'dark',
};

export const useAppStore = create<AppState>((set) => ({
  // Settings
  settings: defaultSettings,
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),

  // Initialization
  isInitialized: false,
  setInitialized: (value) => set({ isInitialized: value }),

  // Database
  isDatabaseReady: false,
  setDatabaseReady: (value) => set({ isDatabaseReady: value }),

  // Loading
  isLoading: false,
  setLoading: (value) => set({ isLoading: value }),

  // Error
  error: null,
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
