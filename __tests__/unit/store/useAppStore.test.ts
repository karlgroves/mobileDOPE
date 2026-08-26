import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_DISTANCE_PRESETS, useAppStore } from '../../../src/store/useAppStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

/**
 * App settings store. Unlike the other stores this one persists to AsyncStorage
 * rather than SQLite, so the mock is the seam. See issue #28 phase 3.
 */
const store = () => useAppStore.getState();

const SETTINGS_KEY = '@mobileDOPE:settings';

const defaults = {
  defaultDistanceUnit: 'yards',
  defaultCorrectionUnit: 'MIL',
  themeMode: 'dark',
  hapticFeedbackEnabled: true,
  keepScreenAwakeDuringSession: true,
  distancePresets: DEFAULT_DISTANCE_PRESETS,
};

describe('useAppStore', () => {
  let consoleError: typeof console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.getItem.mockResolvedValue(null);
    mockStorage.setItem.mockResolvedValue(undefined);
    mockStorage.removeItem.mockResolvedValue(undefined);
    useAppStore.setState({
      settings: { ...defaults } as ReturnType<typeof store>['settings'],
      isInitialized: false,
      isDatabaseReady: false,
      isLoading: false,
      error: null,
    });
    consoleError = console.error;
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = consoleError;
  });

  describe('defaults', () => {
    it('ships a full set of defaults', () => {
      expect(store().settings).toMatchObject(defaults);
    });

    it('exposes ten distance presets from 100 to 1000', () => {
      expect(DEFAULT_DISTANCE_PRESETS).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
    });
  });

  describe('updateSettings', () => {
    it('merges rather than replacing', async () => {
      await store().updateSettings({ defaultCorrectionUnit: 'MOA' });

      expect(store().settings.defaultCorrectionUnit).toBe('MOA');
      expect(store().settings.defaultDistanceUnit).toBe('yards');
    });

    it('persists the merged result, not just the delta', async () => {
      await store().updateSettings({ themeMode: 'nightVision' });

      const [key, payload] = mockStorage.setItem.mock.calls[0] as [string, string];
      expect(key).toBe(SETTINGS_KEY);
      expect(JSON.parse(payload)).toMatchObject({
        themeMode: 'nightVision',
        defaultCorrectionUnit: 'MIL',
      });
    });

    it('rejects when storage cannot be written', async () => {
      mockStorage.setItem.mockRejectedValueOnce(new Error('disk full'));

      await expect(store().updateSettings({ themeMode: 'light' })).rejects.toThrow('disk full');
    });
  });

  describe('loadSettings', () => {
    it('falls back to defaults when nothing is stored', async () => {
      await store().loadSettings();

      expect(store().settings).toMatchObject(defaults);
    });

    it('merges stored settings over the defaults', async () => {
      mockStorage.getItem.mockResolvedValueOnce(JSON.stringify({ defaultCorrectionUnit: 'MOA' }));

      await store().loadSettings();

      expect(store().settings.defaultCorrectionUnit).toBe('MOA');
      // A key absent from an older stored payload must still get its default.
      expect(store().settings.distancePresets).toEqual(DEFAULT_DISTANCE_PRESETS);
    });

    it('falls back to defaults rather than throwing on unreadable storage', async () => {
      mockStorage.getItem.mockRejectedValueOnce(new Error('unavailable'));

      await expect(store().loadSettings()).resolves.toBeUndefined();
      expect(store().settings).toMatchObject(defaults);
    });

    it('falls back to defaults when the stored payload is not valid JSON', async () => {
      // A truncated write must not brick the app on next launch.
      mockStorage.getItem.mockResolvedValueOnce('{ not json');

      await store().loadSettings();

      expect(store().settings).toMatchObject(defaults);
    });
  });

  describe('resetSettings', () => {
    it('restores defaults and clears storage', async () => {
      await store().updateSettings({ themeMode: 'light' });

      await store().resetSettings();

      expect(store().settings).toMatchObject(defaults);
      expect(mockStorage.removeItem).toHaveBeenCalledWith(SETTINGS_KEY);
    });

    it('rejects when storage cannot be cleared', async () => {
      mockStorage.removeItem.mockRejectedValueOnce(new Error('locked'));

      await expect(store().resetSettings()).rejects.toThrow('locked');
    });
  });

  describe('lifecycle flags', () => {
    it('tracks initialization, database readiness and loading independently', () => {
      store().setInitialized(true);
      store().setDatabaseReady(true);
      store().setLoading(true);

      expect(store().isInitialized).toBe(true);
      expect(store().isDatabaseReady).toBe(true);
      expect(store().isLoading).toBe(true);
    });

    it('sets and clears the error', () => {
      store().setError('database failed to open');
      expect(store().error).toBe('database failed to open');

      store().clearError();
      expect(store().error).toBeNull();
    });
  });
});
