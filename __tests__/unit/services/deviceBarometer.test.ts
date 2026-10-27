import { Barometer } from 'expo-sensors';

import {
  BAROMETER_SAMPLE_COUNT,
  BAROMETER_TIMEOUT_MS,
  isBarometerAvailable,
  readBarometerHpa,
} from '../../../src/services/deviceBarometer';

/**
 * One reading from the device barometer, and no listener left behind (#62).
 *
 * The native barometer streams continuously for as long as anything is
 * subscribed -- on iOS it holds CMAltimeter open. The Environment screen needs
 * one number, so the read subscribes, takes a few samples, and unsubscribes on
 * every exit path: enough samples, a timeout, or a sensor that never reports.
 *
 * expo-sensors is mocked at the module boundary; everything above it is real.
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

const emit = (pressure: number) => listeners.forEach((l) => l({ pressure, timestamp: 0 }));

beforeEach(() => {
  jest.useFakeTimers();
  listeners.length = 0;
  remove.mockClear();
  mocked.addListener.mockReset().mockImplementation((listener: Listener) => {
    listeners.push(listener);
    return { remove };
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('isBarometerAvailable', () => {
  it('reports what the sensor module says', async () => {
    mocked.isAvailableAsync.mockResolvedValueOnce(true);
    await expect(isBarometerAvailable()).resolves.toBe(true);
    mocked.isAvailableAsync.mockResolvedValueOnce(false);
    await expect(isBarometerAvailable()).resolves.toBe(false);
  });

  it('treats an availability check that throws as no barometer', async () => {
    mocked.isAvailableAsync.mockRejectedValueOnce(new Error('module missing'));
    await expect(isBarometerAvailable()).resolves.toBe(false);
  });
});

describe('readBarometerHpa', () => {
  it('resolves with the samples once it has enough, and unsubscribes', async () => {
    const reading = readBarometerHpa();
    for (let i = 0; i < BAROMETER_SAMPLE_COUNT; i++) emit(1000 + i);

    await expect(reading).resolves.toEqual(
      Array.from({ length: BAROMETER_SAMPLE_COUNT }, (_, i) => 1000 + i)
    );
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('settles for the samples it has when the time runs out', async () => {
    const reading = readBarometerHpa();
    emit(1001);
    jest.advanceTimersByTime(BAROMETER_TIMEOUT_MS);

    await expect(reading).resolves.toEqual([1001]);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('resolves empty, and still unsubscribes, when the sensor never reports', async () => {
    // What iOS does when Motion & Fitness access has been declined: the
    // subscription succeeds and no event ever arrives.
    const reading = readBarometerHpa();
    jest.advanceTimersByTime(BAROMETER_TIMEOUT_MS);

    await expect(reading).resolves.toEqual([]);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('ignores events that arrive after it has finished', async () => {
    const reading = readBarometerHpa();
    for (let i = 0; i < BAROMETER_SAMPLE_COUNT; i++) emit(1000);
    emit(5);
    jest.advanceTimersByTime(BAROMETER_TIMEOUT_MS);

    await expect(reading).resolves.toHaveLength(BAROMETER_SAMPLE_COUNT);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('releases a sensor that delivered every sample from inside addListener', async () => {
    // Some implementations replay buffered events synchronously on subscribe, so
    // the read can finish before addListener has returned a subscription to remove.
    mocked.addListener.mockImplementationOnce((listener: Listener) => {
      for (let i = 0; i < BAROMETER_SAMPLE_COUNT; i++) listener({ pressure: 1000, timestamp: 0 });
      return { remove };
    });

    await expect(readBarometerHpa()).resolves.toHaveLength(BAROMETER_SAMPLE_COUNT);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects, without leaking, when subscribing throws', async () => {
    mocked.addListener.mockImplementationOnce(() => {
      throw new Error('sensor unavailable');
    });

    await expect(readBarometerHpa()).rejects.toThrow('sensor unavailable');
    expect(jest.getTimerCount()).toBe(0);
  });
});
