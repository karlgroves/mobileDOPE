/**
 * Main application state store
 * Manages app-level state including settings, theme, and initialization
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { setCustomCalibers, type CustomCaliber } from '../constants/calibers';
import { DEFAULT_CONFIDENCE_THRESHOLD } from '../utils/adjustmentConfidence';
import { isValidBarometerOffset } from '../utils/barometer';
import { DEFAULT_DISTANCE_DELTA } from '../utils/dopeMatching';
import { isValidConfidenceThreshold, isValidDistanceDelta } from '../utils/dopeSettings';

import type { ThemeMode } from '../constants/colors';
import type { BackupSchedule } from '../utils/backupSchedule';

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
   * How often an automatic backup is written to the device (#66). `manual`, the
   * default, writes none -- which is how the app behaved before scheduling
   * existed, so an upgrade does not start creating files nobody asked for.
   */
  backupSchedule: BackupSchedule;
  /** ISO time of the last automatic backup, if one has run. */
  lastAutomaticBackupAt?: string;
  /**
   * Calibration for the device barometer, in inHg, added to every reading the
   * Environment screen takes from it (#62).
   *
   * Applied to the sensor reading only, never to a pressure typed by hand: it
   * describes this handset's sensor. Zero -- uncalibrated -- by default. See
   * `src/utils/barometer.ts` for why it is inHg and when it is added.
   */
  barometerOffsetInHg: number;
  /**
   * Whether the calculator adjusts its elevation by the shooter's own DOPE
   * (#167). This is the *default* for the screen's switch, not the switch -- a
   * shooter who turned it off for one shot should not find it off tomorrow.
   *
   * On by default, which is how #168 shipped: a shooter with no logs sees the
   * solver either way, and one with logs is better served by them.
   */
  dopeAdjustmentEnabled: boolean;
  /**
   * The distance window the matcher searches, in yards (#70 §10). 25-100,
   * default 50 -- `DEFAULT_DISTANCE_DELTA`, which is where the figure comes
   * from rather than being restated here.
   *
   * Wider finds more logs and trusts each one less, because distance similarity
   * falls off inside the window as well as outside it.
   */
  dopeDistanceDeltaYards: number;
  /**
   * Confidence below which the solver's figure stands alone, as a fraction
   * (#161). Default 0.4, which is `DEFAULT_CONFIDENCE_THRESHOLD`.
   */
  dopeConfidenceThreshold: number;
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
  backupSchedule: 'manual',
  barometerOffsetInHg: 0,
  // Taken from the modules that consume them, so there is one definition of each
  // default and the settings screen's "reset" cannot drift from the code's own.
  dopeAdjustmentEnabled: true,
  dopeDistanceDeltaYards: DEFAULT_DISTANCE_DELTA,
  dopeConfidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
  distancePresets: DEFAULT_DISTANCE_PRESETS,
};

export { DEFAULT_DISTANCE_PRESETS };

/**
 * The shipped settings, for a screen that offers to put one section back.
 *
 * Exported so "reset to defaults" (#167) reads the same figures the app starts
 * with, rather than restating them -- which is how a reset comes to set a value
 * the code no longer uses.
 */
export const DEFAULT_SETTINGS: Readonly<AppSettings> = defaultSettings;

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
      // Same reasoning as the offset above, and the stakes are the same shape:
      // a delta of 0 or a threshold above 1 switches DOPE-assisted aiming off
      // without reporting anything, leaving a correct-looking solver figure and
      // no explanation. See `src/utils/dopeSettings.ts`.
      if (!isValidDistanceDelta(merged.dopeDistanceDeltaYards)) {
        merged.dopeDistanceDeltaYards = defaultSettings.dopeDistanceDeltaYards;
      }
      if (!isValidConfidenceThreshold(merged.dopeConfidenceThreshold)) {
        merged.dopeConfidenceThreshold = defaultSettings.dopeConfidenceThreshold;
      }
      if (typeof merged.dopeAdjustmentEnabled !== 'boolean') {
        merged.dopeAdjustmentEnabled = defaultSettings.dopeAdjustmentEnabled;
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
