/**
 * Automatic backup (#66).
 *
 * Reads every record straight from the database rather than from the stores:
 * the scheduler runs as the app opens, before any screen has loaded its list,
 * and the DOPE and environment stores only ever hold a recent slice. A backup
 * built from them would be silently partial.
 */

import {
  ammoProfileRepository,
  dopeLogRepository,
  environmentRepository,
  rifleProfileRepository,
} from './database';
import { saveAutomaticBackup, type ExportResult } from './ExportService';

/** Write an automatic backup of the whole database, timestamped `now`. */
export async function runAutomaticBackup(now: Date): Promise<ExportResult> {
  try {
    const [rifles, ammos, logs, environments] = await Promise.all([
      rifleProfileRepository.getAll(),
      ammoProfileRepository.getAll(),
      dopeLogRepository.getAll(),
      environmentRepository.getAll(),
    ]);
    return await saveAutomaticBackup(rifles, ammos, logs, environments, now);
  } catch (error) {
    console.error('Error reading data for automatic backup:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
