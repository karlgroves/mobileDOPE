import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { Barometer } from 'expo-sensors';
import React from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { EnvironmentInput } from '../../../src/screens/EnvironmentInput';
import { SettingsScreen } from '../../../src/screens/SettingsScreen';
import { useAppStore } from '../../../src/store/useAppStore';
import { renderWithProviders } from '../../helpers/renderWithProviders';

/**
 * Reading the device barometer into the pressure field, and calibrating it (#62).
 *
 * expo-sensors is mocked at the module boundary -- availability, and a listener
 * the test drives by hand. The conversion, the calibration offset, the sampling
 * and the store are all real.
 */
type Listener = (m: { pressure: number; timestamp: number }) => void;

const listeners: Listener[] = [];
const remove = jest.fn();

jest.mock('expo-sensors', () => ({
  Barometer: {
    isAvailableAsync: jest.fn(),
    addListener: jest.fn(),
  },
}));

const mocked = Barometer as unknown as {
  isAvailableAsync: jest.Mock;
  addListener: jest.Mock;
};

/** ISA pressure at 5,000 ft: station pressure 24.90 inHg. */
const AT_5000_FT_HPA = 843.07;

const emit = (pressure: number) =>
  act(() => {
    [...listeners].forEach((l) => l({ pressure, timestamp: 0 }));
  });

const pressureField = (getByLabelText: (label: string) => { props: { value?: string } }) =>
  getByLabelText('Station Pressure, required').props.value;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  listeners.length = 0;
  mocked.addListener.mockImplementation((listener: Listener) => {
    listeners.push(listener);
    return {
      remove: () => {
        remove();
        listeners.splice(listeners.indexOf(listener), 1);
      },
    };
  });
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, barometerOffsetInHg: 0 },
  });
});

describe('Environment screen', () => {
  it('does not offer the barometer on a device without one', async () => {
    mocked.isAvailableAsync.mockResolvedValue(false);
    const { queryByText } = renderWithProviders(<EnvironmentInput />);

    await waitFor(() => expect(mocked.isAvailableAsync).toHaveBeenCalled());
    expect(queryByText('Read Barometer')).toBeNull();
  });

  it('fills station pressure from the sensor, unconverted to sea level, and stops listening', async () => {
    mocked.isAvailableAsync.mockResolvedValue(true);
    const { findByText, getByLabelText } = renderWithProviders(<EnvironmentInput />);

    fireEvent.press(await findByText('Read Barometer'));
    await waitFor(() => expect(listeners).toHaveLength(1));
    emit(AT_5000_FT_HPA);
    emit(AT_5000_FT_HPA);
    emit(AT_5000_FT_HPA);

    await waitFor(() => expect(pressureField(getByLabelText)).toBe('24.90'));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(0);
  });

  it('tells a screen-reader user what the reading filled in', async () => {
    mocked.isAvailableAsync.mockResolvedValue(true);
    const { findByText } = renderWithProviders(<EnvironmentInput />);

    fireEvent.press(await findByText('Read Barometer'));
    await waitFor(() => expect(listeners).toHaveLength(1));
    emit(AT_5000_FT_HPA);
    emit(AT_5000_FT_HPA);
    emit(AT_5000_FT_HPA);

    await waitFor(() =>
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
        'Station pressure set to 24.90 inHg'
      )
    );
  });

  it('keeps the button named while the read is in progress', async () => {
    mocked.isAvailableAsync.mockResolvedValue(true);
    const { findByText, getByLabelText, queryByText } = renderWithProviders(<EnvironmentInput />);

    fireEvent.press(await findByText('Read Barometer'));
    await waitFor(() => expect(listeners).toHaveLength(1));

    // The title text is replaced by a spinner; the accessible name must survive.
    expect(queryByText('Read Barometer')).toBeNull();
    expect(getByLabelText('Read Barometer')).toBeTruthy();
  });

  it('says the barometer could not be read when subscribing fails, and leaves the field', async () => {
    mocked.isAvailableAsync.mockResolvedValue(true);
    mocked.addListener.mockImplementationOnce(() => {
      throw new Error('sensor unavailable');
    });
    const { findByText, getByLabelText } = renderWithProviders(<EnvironmentInput />);
    const before = pressureField(getByLabelText);

    fireEvent.press(await findByText('Read Barometer'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'No Barometer Reading',
        expect.stringContaining('could not be read')
      )
    );
    expect(pressureField(getByLabelText)).toBe(before);
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
  });

  it('applies the calibration offset from Settings to the reading', async () => {
    useAppStore.setState({
      settings: { ...useAppStore.getState().settings, barometerOffsetInHg: 0.05 },
    });
    mocked.isAvailableAsync.mockResolvedValue(true);
    const { findByText, getByLabelText } = renderWithProviders(<EnvironmentInput />);

    fireEvent.press(await findByText('Read Barometer'));
    await waitFor(() => expect(listeners).toHaveLength(1));
    emit(AT_5000_FT_HPA);
    emit(AT_5000_FT_HPA);
    emit(AT_5000_FT_HPA);

    await waitFor(() => expect(pressureField(getByLabelText)).toBe('24.95'));
  });

  it('leaves the field alone and says why when the sensor gives nothing usable', async () => {
    mocked.isAvailableAsync.mockResolvedValue(true);
    const { findByText, getByLabelText } = renderWithProviders(<EnvironmentInput />);
    const before = pressureField(getByLabelText);

    fireEvent.press(await findByText('Read Barometer'));
    await waitFor(() => expect(listeners).toHaveLength(1));
    // A faulty sensor: 0 hPa three times.
    emit(0);
    emit(0);
    emit(0);

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('No Barometer Reading', expect.any(String))
    );
    expect(pressureField(getByLabelText)).toBe(before);
    expect(listeners).toHaveLength(0);
  });
});

describe('Settings', () => {
  const OFFSET = 'Barometer Offset';
  const renderSettings = () =>
    renderWithProviders(
      <SettingsScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />
    );

  beforeEach(() => mocked.isAvailableAsync.mockResolvedValue(true));

  it('offers calibration only where there is a barometer to calibrate', async () => {
    mocked.isAvailableAsync.mockResolvedValue(false);
    const { queryByLabelText } = renderSettings();

    await waitFor(() => expect(mocked.isAvailableAsync).toHaveBeenCalled());
    expect(queryByLabelText(OFFSET)).toBeNull();
  });

  it('saves a barometer offset the user types', async () => {
    const { findByLabelText } = renderSettings();

    fireEvent.changeText(await findByLabelText(OFFSET), '-0.03');

    await waitFor(() => expect(useAppStore.getState().settings.barometerOffsetInHg).toBe(-0.03));
  });

  it('treats an emptied offset field as no offset, not the old one', async () => {
    useAppStore.setState({
      settings: { ...useAppStore.getState().settings, barometerOffsetInHg: 0.05 },
    });
    const { findByLabelText } = renderSettings();

    fireEvent.changeText(await findByLabelText(OFFSET), '');

    await waitFor(() => expect(useAppStore.getState().settings.barometerOffsetInHg).toBe(0));
  });

  it('does not save an offset past the limit', async () => {
    const { findByLabelText } = renderSettings();

    fireEvent.changeText(await findByLabelText(OFFSET), '3');

    await act(async () => {});
    expect(useAppStore.getState().settings.barometerOffsetInHg).toBe(0);
  });

  it('explains the offset in plain words', async () => {
    const { findByText, getByText } = renderSettings();

    expect(await findByText(/trusted station-pressure source/i)).toBeTruthy();
    expect(getByText(/typed by hand is never changed/i)).toBeTruthy();
  });
});
