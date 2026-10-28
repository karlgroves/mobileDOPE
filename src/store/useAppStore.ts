/**
 * Main application state store
 * Manages app-level state including settings, theme, and initialization
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { setCustomCalibers, type CustomCaliber } from '../constants/calibers';
import { isValidBarometerOffset } from '../utils/barometer';

import type { ThemeMode } from '../constants/colors';

interface AppSettings {
  defaultDistanceUnit: 'yards' | 'meters';
  defaultCorrectionUnit: 'MIL' | 'MOA';
  themeMode: ThemeMode;
  hapticFeedbackEnabled: boolean;
  keepScreenAwakeDuringSession: boolean;
  /**
   * Fold spin drift and Coriolis into the dialled solution (#71).
   *
   * Off by default. Both terms are small until several hundred yards, and a
   * shooter who has built a DOPE card against the unadjusted solution would
   * find every number shifted underneath them by an update. Opting in is the
   * safe direction; the calculator shows the terms either way.
   */
  advancedBallisticsEnabled: boolean;
  /**
   * Calibers the shooter added alongside the built-in list (#67). Kept with the
   * settings rather than in SQLite: it is a short list of preferences with no
   * relations of its own, and storing it here needs no migration. Profiles
   * refer to a caliber by its name, as they do to the built-in ones.
   */
  customCalibers: CustomCaliber[];
  /**
   * Calibration for the device barometer, in inHg, added to every reading the
   * Environment screen takes from it (#62).
   *
   * Applied to the sensor reading only, never to a pressure typed by hand: it
   * describes this handset's sensor. Zero -- uncalibrated -- by default. See
   * `src/utils/barometer.ts` for why it is inHg and when it is added.
   */
  barometerOffsetInHg: number;
  lastSelectedRifleId?: number;
  lastSelectedAmmoId?: number;
  distancePresets: number[];
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

const DEFAULT_DISTANCE_PRESETS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

const defaultSettings: AppSettings = {
  defaultDistanceUnit: 'yards',
  defaultCorrectionUnit: 'MIL',
  themeMode: 'dark',
  hapticFeedbackEnabled: true,
  keepScreenAwakeDuringSession: true,
  advancedBallisticsEnabled: false,
  customCalibers: [],
  barometerOffsetInHg: 0,
  distancePresets: DEFAULT_DISTANCE_PRESETS,
};

export { DEFAULT_DISTANCE_PRESETS };

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
      const merged = { ...defaultSettings, ...(JSON.parse(stored) as Partial<AppSettings>) };
      // The offset is added to every barometer reading without the user seeing it
      // again, so a corrupted or out-of-range stored value is dropped, not trusted.
      if (
        typeof merged.barometerOffsetInHg !== 'number' ||
        !isValidBarometerOffset(merged.barometerOffsetInHg)
      ) {
        merged.barometerOffsetInHg = defaultSettings.barometerOffsetInHg;
      }
      return merged;
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
    // The solver reads custom diameters from the caliber database, not from here.
    if (newSettings.customCalibers) setCustomCalibers(newSettings.customCalibers);
    await saveSettingsToStorage(updatedSettings);
  },
  loadSettings: async () => {
    const settings = await loadSettingsFromStorage();
    set({ settings });
    setCustomCalibers(settings.customCalibers);
  },
  resetSettings: async () => {
    set({ settings: defaultSettings });
    setCustomCalibers(defaultSettings.customCalibers);
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
