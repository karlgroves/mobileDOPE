/**
 * Main application state store
 * Manages app-level state including settings, theme, and initialization
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeMode } from '../constants/colors';

interface AppSettings {
  defaultDistanceUnit: 'yards' | 'meters';
  defaultCorrectionUnit: 'MIL' | 'MOA';
  themeMode: ThemeMode;
  hapticFeedbackEnabled: boolean;
  lastSelectedRifleId?: number;
  lastSelectedAmmoId?: number;
}

interface AppState {
  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  loadSettings: () => Promise<void>;
  resetSettings: () => Promise<void>;

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
  hapticFeedbackEnabled: true,
};

const SETTINGS_STORAGE_KEY = '@mobileDOPE:settings';

/**
 * Save settings to AsyncStorage
 */
async function saveSettingsToStorage(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings to storage:', error);
    throw error;
  }
}

/**
 * Load settings from AsyncStorage
 */
async function loadSettingsFromStorage(): Promise<AppSettings> {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
    return defaultSettings;
  } catch (error) {
    console.error('Failed to load settings from storage:', error);
    return defaultSettings;
  }
}

/**
 * Clear settings from AsyncStorage
 */
async function clearSettingsFromStorage(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SETTINGS_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear settings from storage:', error);
    throw error;
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  // Settings
  settings: defaultSettings,
  updateSettings: async (newSettings) => {
    const updatedSettings = { ...get().settings, ...newSettings };
    set({ settings: updatedSettings });
    await saveSettingsToStorage(updatedSettings);
  },
  loadSettings: async () => {
    const settings = await loadSettingsFromStorage();
    set({ settings });
  },
  resetSettings: async () => {
    set({ settings: defaultSettings });
    await clearSettingsFromStorage();
  },

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
