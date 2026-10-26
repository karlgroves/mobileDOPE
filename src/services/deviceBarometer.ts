/**
 * One-shot access to the device barometer (#62).
 *
 * expo-sensors exposes the barometer as a stream: it runs for as long as a
 * listener is attached, and on iOS that holds CMAltimeter open. The Environment
 * screen wants one number, so this subscribes, collects a few samples to smooth
 * the sensor's jitter, and unsubscribes on every way out -- enough samples, the
 * timeout, or a subscription that throws. Nothing is left listening.
 *
 * The timeout matters on iOS: if the user has declined Motion & Fitness access,
 * subscribing still succeeds and simply never delivers an event. The read then
 * resolves with no samples and the caller says so, rather than waiting forever.
 *
 * Raw hPa only. Converting to the station pressure the app stores, and applying
 * the user's calibration, is `src/utils/barometer.ts`.
 */

import { Barometer } from 'expo-sensors';

/** Samples to average. iOS delivers roughly one a second, Android faster. */
export const BAROMETER_SAMPLE_COUNT = 3;

/** How long to wait for those samples before settling for what has arrived. */
export const BAROMETER_TIMEOUT_MS = 5000;

/**
 * Whether this device has a barometer the app can read.
 *
 * A check that throws -- a build without the native module, say -- is treated
 * as no barometer, so the screen simply does not offer the action.
 */
export const isBarometerAvailable = async (): Promise<boolean> => {
  try {
    return await Barometer.isAvailableAsync();
  } catch {
    return false;
  }
};

/**
 * Collect up to {@link BAROMETER_SAMPLE_COUNT} readings, in hPa.
 *
 * @returns The samples received, in order. Empty if the sensor sent nothing
 *   within {@link BAROMETER_TIMEOUT_MS}.
 */
export const readBarometerHpa = (): Promise<number[]> =>
  new Promise((resolve, reject) => {
    const samples: number[] = [];
    let finished = false;
    let subscription: { remove: () => void } | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (timer !== undefined) clearTimeout(timer);
      subscription?.remove();
      resolve(samples);
    };

    try {
      subscription = Barometer.addListener(({ pressure }) => {
        if (finished) return;
        samples.push(pressure);
        if (samples.length >= BAROMETER_SAMPLE_COUNT) finish();
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    // A sensor that reported synchronously from inside addListener finished
    // before `subscription` was assigned; release it now that it exists.
    if (finished) {
      subscription.remove();
      return;
    }
    timer = setTimeout(finish, BAROMETER_TIMEOUT_MS);
  });
