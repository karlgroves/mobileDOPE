import ammoProfileRepository from '../../src/services/database/AmmoProfileRepository';
import dopeLogRepository from '../../src/services/database/DOPELogRepository';
import environmentRepository from '../../src/services/database/EnvironmentRepository';
import rifleProfileRepository from '../../src/services/database/RifleProfileRepository';

import { validAmmo, validDopeLog, validEnvironment, validRifle } from './fixtures';

/**
 * A long-serving shooter's history, written through the real repositories (#68,
 * "measure database query performance with 1000+ logs").
 *
 * Shaped like a real one rather than 1,200 copies of one row, because the
 * queries' cost depends on the shape: two rifles with two loads each, so the
 * rifle and rifle+load filters actually filter; range sessions of ten shots
 * sharing one environment snapshot, as `DOPELogEntry` saves them; distances
 * across 100-1000 yd; and timestamps an hour apart but inserted out of order,
 * so an `ORDER BY` that stopped working could not hide behind insertion order.
 *
 * Shared by the correctness suite (`__tests__/integration/dopeLogScale`) and the
 * timing suite (`__tests__/performance/dopeLogQueryPerformance`) so the two
 * measure the same database.
 */

export const LOG_COUNT = 1200;
export const SHOTS_PER_SESSION = 10;

export interface SeededHistory {
  rifleIds: number[];
  ammoIds: number[];
  /** Logs per `${rifleId}:${ammoId}`. */
  perPair: Map<string, number>;
  /** The latest timestamp written for each rifle. */
  lastFiredAt: Map<number, string>;
}

const HOUR = 3_600_000;
const EPOCH = Date.UTC(2026, 0, 1);

/**
 * A fixed permutation of 0..n-1 (multiplication by a unit mod n), so insertion
 * order is scrambled but the run is reproducible.
 */
const scrambled = (n: number): number[] => Array.from({ length: n }, (_, i) => (i * 7919) % n);

export const seedLargeHistory = async (): Promise<SeededHistory> => {
  const rifleIds: number[] = [];
  const ammoIds: number[] = [];
  for (const name of ['Tikka T3x', 'Bergara HMR']) {
    rifleIds.push((await rifleProfileRepository.create(validRifle({ name }))).id as number);
  }
  for (const name of ['175gr SMK', '168gr ELD-M']) {
    ammoIds.push((await ammoProfileRepository.create(validAmmo({ name }))).id as number);
  }

  const perPair = new Map<string, number>();
  const lastFiredAt = new Map<number, string>();
  const snapshotFor = new Map<number, number>();

  for (const i of scrambled(LOG_COUNT)) {
    const session = Math.floor(i / SHOTS_PER_SESSION);
    let environmentId = snapshotFor.get(session);
    if (environmentId === undefined) {
      environmentId = (
        await environmentRepository.create(
          validEnvironment({
            temperature: 20 + (session % 70),
            pressure: 24.5 + (session % 12) * 0.5,
            humidity: session % 100,
            timestamp: new Date(EPOCH + session * SHOTS_PER_SESSION * HOUR).toISOString(),
          })
        )
      ).id as number;
      snapshotFor.set(session, environmentId);
    }

    // A session is one rifle and one load, as at the range.
    const rifleId = rifleIds[session % 2];
    const ammoId = ammoIds[Math.floor(session / 2) % 2];
    const timestamp = new Date(EPOCH + i * HOUR).toISOString();

    await dopeLogRepository.create(
      validDopeLog(
        { rifleId, ammoId, environmentId },
        {
          distance: 100 + (i % 37) * 25,
          elevationCorrection: 0.5 + (i % 37) * 0.3,
          timestamp,
        }
      )
    );

    const pair = `${rifleId}:${ammoId}`;
    perPair.set(pair, (perPair.get(pair) ?? 0) + 1);
    if (timestamp > (lastFiredAt.get(rifleId) ?? '')) lastFiredAt.set(rifleId, timestamp);
  }

  return { rifleIds, ammoIds, perPair, lastFiredAt };
};
