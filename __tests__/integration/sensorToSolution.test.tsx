import { act, fireEvent, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { Barometer } from 'expo-sensors';
import React from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { EnvironmentInput } from '../../src/screens/EnvironmentInput';
import { environmentRepository } from '../../src/services/database';
import { BAROMETER_SAMPLE_COUNT, BAROMETER_TIMEOUT_MS } from '../../src/services/deviceBarometer';
import { useAppStore } from '../../src/store/useAppStore';
import { useEnvironmentStore } from '../../src/store/useEnvironmentStore';
import { calculateBallisticSolution } from '../../src/utils/ballistics';
import { ammoConfigFor, atmosphereFor, rifleConfigFor } from '../../src/utils/solverInputs';
import { validAmmo, validRifle } from '../helpers/fixtures';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { installTestDatabase, uninstallTestDatabase } from '../helpers/testDatabase';

import type { TestDatabase } from '../helpers/testDatabase';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../helpers/testDatabase').openDatabaseAsync(),
}));

jest.mock('expo-sensors', () => ({
  Barometer: {
    isAvailableAsync: jest.fn(),
    addListener: jest.fn(),
  },
}));

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { High: 4, Highest: 5 },
}));

/**
 * Sensor integration: a device reading, through the app, into a solution
 * (#68, "test sensor integration").
 *
 * The issue's audit was precise about why this box stayed open: *"The only
 * sensor mention outside `src/` is `appConfig.test.ts`, which checks permission
 * configuration, not sensor behaviour."* `deviceBarometer.test.ts` covers the
 * one-shot read and `deviceBarometer.test.tsx` covers the screen's control.
 * Neither follows a reading any further, and the question a shooter has is
 * whether the number the sensor produced is the number the solver used.
 *
 * So only the two platform modules are mocked -- `expo-sensors` and
 * `expo-location`, at their boundaries. The conversion, the user's calibration
 * offset, the latitude coarsening, the store, real SQLite through the real
 * repository, and the real solver are all the app's own.
 */

/** ISA pressure at 5,000 ft: a station pressure of 24.90 inHg. */
const AT_5000_FT_HPA = 843.07;

/** Sea-level standard: 29.92 inHg. */
const AT_SEA_LEVEL_HPA = 1013.25;

type Listener = (sample: { pressure: number; timestamp: number }) => void;

const listeners: Listener[] = [];

const sensors = Barometer as unknown as {
  isAvailableAsync: jest.Mock;
  addListener: jest.Mock;
};

const location = Location as unknown as {
  getForegroundPermissionsAsync: jest.Mock;
  requestForegroundPermissionsAsync: jest.Mock;
  hasServicesEnabledAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
};

/** Delivers one reading to every attached listener. */
const emit = (hpa: number) =>
  act(() => {
    [...listeners].forEach((listener) => listener({ pressure: hpa, timestamp: 0 }));
  });

/** Delivers enough readings for the one-shot read to settle. */
const emitEnough = (hpa: number) => {
  for (let i = 0; i < BAROMETER_SAMPLE_COUNT; i += 1) emit(hpa);
};

const fieldValue = (
  view: ReturnType<typeof renderWithProviders>,
  label: RegExp
): string | undefined => (view.getByLabelText(label).props as { value?: string }).value;

let db: TestDatabase;

beforeEach(async () => {
  jest.clearAllMocks();
  db = await installTestDatabase();

  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});

  listeners.length = 0;
  sensors.isAvailableAsync.mockResolvedValue(true);
  sensors.addListener.mockImplementation((listener: Listener) => {
    listeners.push(listener);
    return {
      remove: () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      },
    };
  });

  location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
  location.hasServicesEnabledAsync.mockResolvedValue(false);

  useEnvironmentStore.setState({ current: null, snapshots: [] });
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, barometerOffsetInHg: 0 },
  });
});

afterEach(async () => {
  await uninstallTestDatabase();
});

describe('a barometer reading reaches the solver (#68)', () => {
  it('is the figure the solution is computed in, not a default atmosphere', async () => {
    const view = renderWithProviders(<EnvironmentInput />);

    fireEvent.press(await view.findByText('Read Barometer'));
    await waitFor(() => expect(listeners).toHaveLength(1));
    emitEnough(AT_5000_FT_HPA);

    await waitFor(() => expect(fieldValue(view, /^Station Pressure/)).toBe('24.90'));

    fireEvent.press(view.getByText('Save to History'));
    await waitFor(() => expect(useEnvironmentStore.getState().snapshots).toHaveLength(1));

    // Read back out of SQLite rather than out of the store, so the column the
    // solver will be handed tomorrow is the one asserted on.
    const stored = await environmentRepository.getRecent(1);
    expect(stored[0].pressure).toBeCloseTo(24.9, 2);

    const rifle = validRifle();
    const ammo = validAmmo();
    const fromSensor = calculateBallisticSolution(
      rifleConfigFor(rifle),
      ammoConfigFor(ammo),
      { distance: 800, angle: 0, windSpeed: 0, windDirection: 90 },
      atmosphereFor(stored[0])
    );
    const atSeaLevel = calculateBallisticSolution(
      rifleConfigFor(rifle),
      ammoConfigFor(ammo),
      { distance: 800, angle: 0, windSpeed: 0, windDirection: 90 },
      atmosphereFor({ temperature: stored[0].temperature, pressure: 29.92, humidity: 50 })
    );

    // Thin air at 5,000 ft means less drag and less drop. If the sensor reading
    // had been dropped anywhere along the path, these two would be equal -- and
    // that is exactly the failure this test exists to catch, because the screen
    // would still show a perfectly plausible solution.
    expect(fromSensor.elevationMIL).toBeLessThan(atSeaLevel.elevationMIL);
    expect(atSeaLevel.elevationMIL - fromSensor.elevationMIL).toBeGreaterThan(0.1);
  });

  it('carries the shooter’s calibration offset all the way to the stored column', async () => {
    // The offset describes this handset's sensor, so it belongs on the reading
    // and nowhere else. A conversion that applied it twice, or not at all,
    // produces a plausible pressure and a wrong trajectory.
    useAppStore.setState({
      settings: { ...useAppStore.getState().settings, barometerOffsetInHg: 0.05 },
    });

    const view = renderWithProviders(<EnvironmentInput />);
    fireEvent.press(await view.findByText('Read Barometer'));
    await waitFor(() => expect(listeners).toHaveLength(1));
    emitEnough(AT_SEA_LEVEL_HPA);

    await waitFor(() => expect(fieldValue(view, /^Station Pressure/)).toBe('29.97'));

    fireEvent.press(view.getByText('Save to History'));
    await waitFor(() => expect(useEnvironmentStore.getState().snapshots).toHaveLength(1));

    expect((await environmentRepository.getRecent(1))[0].pressure).toBeCloseTo(29.97, 2);
  });

  it('does not apply the offset to a pressure typed by hand', async () => {
    useAppStore.setState({
      settings: { ...useAppStore.getState().settings, barometerOffsetInHg: 0.05 },
    });

    const view = renderWithProviders(<EnvironmentInput />);
    await waitFor(() => expect(sensors.isAvailableAsync).toHaveBeenCalled());

    fireEvent.changeText(view.getByLabelText(/^Station Pressure/), '28.50');
    fireEvent.press(view.getByText('Save to History'));

    await waitFor(() => expect(useEnvironmentStore.getState().snapshots).toHaveLength(1));
    expect((await environmentRepository.getRecent(1))[0].pressure).toBeCloseTo(28.5, 2);
  });

  it('leaves no listener attached once the reading has settled', async () => {
    // On iOS a live listener holds CMAltimeter open. A leak here is invisible
    // on screen and shows up as battery drain during a range session.
    const view = renderWithProviders(<EnvironmentInput />);

    fireEvent.press(await view.findByText('Read Barometer'));
    await waitFor(() => expect(listeners).toHaveLength(1));
    emitEnough(AT_SEA_LEVEL_HPA);

    await waitFor(() => expect(fieldValue(view, /^Station Pressure/)).toBe('29.92'));
    expect(listeners).toHaveLength(0);
  });

  it('offers nothing to press on a device with no barometer', async () => {
    sensors.isAvailableAsync.mockResolvedValue(false);
    const view = renderWithProviders(<EnvironmentInput />);

    await waitFor(() => expect(sensors.isAvailableAsync).toHaveBeenCalled());
    expect(view.queryByText('Read Barometer')).toBeNull();
    expect(sensors.addListener).not.toHaveBeenCalled();
  });

  it('says so rather than storing a reading the sensor never sent', async () => {
    // The iOS case the service was written for: Motion & Fitness declined, so
    // subscribing succeeds and no event ever arrives. Fake timers so the test
    // reaches the service's timeout instead of ending with it still pending;
    // promises stay real, because the screen's work is all awaited.
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
    try {
      const view = renderWithProviders(<EnvironmentInput />);

      fireEvent.press(await view.findByText('Read Barometer'));
      await waitFor(() => expect(listeners).toHaveLength(1));

      // Nothing emitted, and the timeout passes.
      await act(async () => {
        jest.advanceTimersByTime(BAROMETER_TIMEOUT_MS);
      });

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith('No Barometer Reading', expect.any(String))
      );
      expect(listeners).toHaveLength(0);
      expect(fieldValue(view, /^Station Pressure/)).toBe('29.92');
      expect(useEnvironmentStore.getState().snapshots).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('a GPS reading reaches the stored snapshot (#68)', () => {
  it('stores the altitude it measured, coarsened latitude, and no longitude', async () => {
    location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    location.hasServicesEnabledAsync.mockResolvedValue(true);
    location.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 39.7392358, longitude: -104.990251, altitude: 1609.344 },
    });

    const view = renderWithProviders(<EnvironmentInput />);

    fireEvent.press(await view.findByText('Update from GPS'));
    await waitFor(() => expect(location.getCurrentPositionAsync).toHaveBeenCalled());

    // 1609.344 m is a mile: 5,280 ft. Asserted to within a couple of feet
    // (the field shows 5279) rather than exactly, because the field rounds for display and the conversion factor
    // is not what this test is about -- that the reading reached the column is.
    await waitFor(() => expect(Number(fieldValue(view, /^Altitude/))).toBeCloseTo(5280, -0.5));

    fireEvent.press(view.getByText('Save to History'));
    await waitFor(() => expect(useEnvironmentStore.getState().snapshots).toHaveLength(1));

    const row = await db.getFirstAsync<{ latitude: number | null; altitude: number }>(
      'SELECT latitude, altitude FROM environment_snapshots ORDER BY id DESC LIMIT 1'
    );

    // Coarsened to one decimal place -- about 11 km -- at the point of capture,
    // which is the chokepoint PRIVACY.md and CLAUDE.md both commit to.
    expect(row?.latitude).toBeCloseTo(39.7, 6);
    expect(row?.altitude ?? 0).toBeCloseTo(5280, -0.5);

    // And the column PRIVACY.md says does not exist.
    const columns = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM pragma_table_info('environment_snapshots')"
    );
    expect(columns.map((column) => column.name)).not.toContain('longitude');
  });
});
