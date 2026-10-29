import AsyncStorage from '@react-native-async-storage/async-storage';

import { caliberDiameter, setCustomCalibers } from '../../../src/constants/calibers';
import {
  DEFAULT_DISTANCE_PRESETS,
  DEFAULT_SETTINGS,
  useAppStore,
} from '../../../src/store/useAppStore';

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

    it('backs up only on request until the shooter picks a schedule (#66)', async () => {
      // Settings saved by a release before scheduling existed have neither field;
      // they must load as today's behaviour, not start writing files unasked.
      mockStorage.getItem.mockResolvedValue(JSON.stringify({ themeMode: 'light' }));
      await store().loadSettings();
      expect(store().settings.backupSchedule).toBe('manual');
      expect(store().settings.lastAutomaticBackupAt).toBeUndefined();
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

  describe('barometer calibration (#62)', () => {
    it('starts uncalibrated', async () => {
      await store().loadSettings();

      expect(store().settings.barometerOffsetInHg).toBe(0);
    });

    it('persists an offset with the other settings', async () => {
      await store().updateSettings({ barometerOffsetInHg: 0.04 });

      const [, payload] = mockStorage.setItem.mock.calls[0] as [string, string];
      expect(JSON.parse(payload)).toMatchObject({ barometerOffsetInHg: 0.04 });
    });

    it('restores a stored offset', async () => {
      mockStorage.getItem.mockResolvedValueOnce(JSON.stringify({ barometerOffsetInHg: -0.03 }));

      await store().loadSettings();

      expect(store().settings.barometerOffsetInHg).toBe(-0.03);
    });

    it.each([['"0.5"'], ['null'], ['5'], ['-2']])(
      'drops a stored offset of %s rather than skewing every reading with it',
      async (stored) => {
        // The offset is added to every barometer reading without the user seeing
        // it again, so a corrupted or out-of-range value must not survive a load.
        mockStorage.getItem.mockResolvedValueOnce(`{"barometerOffsetInHg": ${stored}}`);

        await store().loadSettings();

        expect(store().settings.barometerOffsetInHg).toBe(0);
      }
    );
  });

  describe('DOPE-assisted aiming settings on load (#167)', () => {
    it('restores stored values inside their ranges', async () => {
      mockStorage.getItem.mockResolvedValueOnce(
        JSON.stringify({
          dopeAdjustmentEnabled: false,
          dopeDistanceDeltaYards: 75,
          dopeConfidenceThreshold: 0.6,
          coldBoreModellingEnabled: false,
          heatShiftModellingEnabled: false,
        })
      );

      await store().loadSettings();

      expect(store().settings).toMatchObject({
        dopeAdjustmentEnabled: false,
        dopeDistanceDeltaYards: 75,
        dopeConfidenceThreshold: 0.6,
        coldBoreModellingEnabled: false,
        heatShiftModellingEnabled: false,
      });
    });

    it('drops values that would silently switch the feature off', async () => {
      // A window of 0 matches no log and a threshold above 1 can never be
      // cleared; neither reports anything, so neither may survive a load.
      mockStorage.getItem.mockResolvedValueOnce(
        JSON.stringify({
          dopeAdjustmentEnabled: 'yes',
          dopeDistanceDeltaYards: 0,
          dopeConfidenceThreshold: 1.5,
          coldBoreModellingEnabled: null,
          heatShiftModellingEnabled: 1,
        })
      );

      await store().loadSettings();

      expect(store().settings).toMatchObject({
        dopeAdjustmentEnabled: DEFAULT_SETTINGS.dopeAdjustmentEnabled,
        dopeDistanceDeltaYards: DEFAULT_SETTINGS.dopeDistanceDeltaYards,
        dopeConfidenceThreshold: DEFAULT_SETTINGS.dopeConfidenceThreshold,
        coldBoreModellingEnabled: DEFAULT_SETTINGS.coldBoreModellingEnabled,
        heatShiftModellingEnabled: DEFAULT_SETTINGS.heatShiftModellingEnabled,
      });
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

  describe('custom calibers (#67)', () => {
    const wildcat = { name: '6.5 Wildcat', diameter: 0.264 };
    afterEach(() => setCustomCalibers([]));

    it('start empty, including for settings saved before they existed', async () => {
      mockStorage.getItem.mockResolvedValueOnce(JSON.stringify({ themeMode: 'light' }));
      await store().loadSettings();
      expect(store().settings.customCalibers).toEqual([]);
    });

    it('are known to the solver as soon as they are loaded', async () => {
      // The solver looks diameters up without the store, so loading has to
      // tell the caliber database; otherwise a custom caliber would fall
      // through to a guess from its name until something else saved settings.
      mockStorage.getItem.mockResolvedValueOnce(JSON.stringify({ customCalibers: [wildcat] }));
      await store().loadSettings();
      expect(caliberDiameter('6.5 Wildcat')).toBe(0.264);
    });

    it('are known to the solver as soon as they are saved, and forgotten on reset', async () => {
      await store().updateSettings({ customCalibers: [wildcat] });
      expect(caliberDiameter('6.5 Wildcat')).toBe(0.264);

      await store().resetSettings();
      expect(caliberDiameter('6.5 Wildcat')).toBeUndefined();
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
