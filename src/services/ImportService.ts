/**
 * Import Service
 * Handles data import from various formats (JSON backups)
 */

import { useAmmoStore } from '../store/useAmmoStore';
import { useDOPEStore } from '../store/useDOPEStore';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { useRifleStore } from '../store/useRifleStore';

import { exceedsMaxDepth, exceedsMaxSize, oversizedMessage } from './importGuards';

export interface ImportResult {
  success: boolean;
  imported?: {
    rifles?: number;
    ammos?: number;
    environments?: number;
    logs?: number;
  };
  /**
   * Records present in the file that could not be imported. Previously these were swallowed
   * with only a `console.error`, so a total failure looked identical to success (issue #39).
   */
  skipped?: {
    rifles?: number;
    ammos?: number;
    environments?: number;
    logs?: number;
  };
  /** Human-readable explanations for skipped records, for surfacing in the UI. */
  warnings?: string[];
  error?: string;
}

interface BackupData {
  exportDate: string;
  exportVersion: string;
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: {
    rifles?: any[];
    ammos?: any[];
    environments?: any[];
    logs?: any[];
  };
  counts?: {
    rifles?: number;
    ammos?: number;
    environments?: number;
    logs?: number;
  };
}

/**
 * Pick a JSON file for import
 */
export async function pickImportFile(): Promise<{
  success: boolean;
  data?: BackupData;
  error?: string;
}> {
  try {
    // Lazy load native modules only when needed
    const DocumentPicker = await import('expo-document-picker');

    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return { success: false, error: 'Import cancelled' };
    }

    const response = await fetch(result.assets[0].uri);
    const content = await response.text();

    // Bound the input before parsing it. The file comes from a document picker, so
    // it is chosen by the user but not produced by this app -- it may have come from
    // anywhere. `JSON.parse` on an unbounded string is a memory exhaustion primitive.
    // See security/tests/import.security.spec.ts. (Issue #45 item 8.)
    if (exceedsMaxSize(content)) {
      return { success: false, error: oversizedMessage() };
    }

    const data = JSON.parse(content) as BackupData;

    // Depth-bound the parsed structure. `JSON.parse` itself tolerates deep nesting,
    // but the recursive walks downstream of it do not, and a stack overflow here
    // takes the app down rather than rejecting the file.
    if (exceedsMaxDepth(data)) {
      return { success: false, error: 'That file is nested too deeply to import.' };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error picking import file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read file',
    };
  }
}

// Allowed fields for each record type (prevents mass assignment from imported data)
const RIFLE_ALLOWED_FIELDS = [
  'name',
  'caliber',
  'barrelLength',
  'twistRate',
  'zeroDistance',
  'opticManufacturer',
  'opticModel',
  'reticleType',
  'clickValueType',
  'clickValue',
  'scopeHeight',
  'notes',
];

const AMMO_ALLOWED_FIELDS = [
  'name',
  'manufacturer',
  // `caliber` is required by AmmoProfile's validate() and is how ammo is matched to rifles
  // (see ADR-004). Omitting it here meant every ammo profile in a backup failed to
  // construct on import, and the per-record try/catch swallowed the error -- so restoring a
  // backup silently produced zero ammo profiles while still reporting success.
  'caliber',
  'bulletWeight',
  'bulletType',
  'ballisticCoefficientG1',
  'ballisticCoefficientG7',
  'muzzleVelocity',
  'powderType',
  'powderWeight',
  'lotNumber',
  'notes',
];

const ENVIRONMENT_ALLOWED_FIELDS = [
  'temperature',
  'humidity',
  'pressure',
  'altitude',
  'densityAltitude',
  'windSpeed',
  'windDirection',
  'latitude',
  'timestamp',
];

const DOPE_LOG_ALLOWED_FIELDS = [
  'rifleId',
  'ammoId',
  'environmentId',
  'distance',
  'distanceUnit',
  'distanceYards',
  'elevationCorrection',
  'windageCorrection',
  'correctionUnit',
  'targetType',
  'groupSize',
  'hitCount',
  'shotCount',
  'hitPercentage',
  'notes',
  'timestamp',
];

/**
 * Pick only allowed fields from a record, preventing prototype pollution
 * and mass assignment of unexpected fields
 */
function pickAllowedFields(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: any,
  allowedFields: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (!record || typeof record !== 'object') return {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, any> = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(record, field) && record[field] !== undefined) {
      result[field] = record[field];
    }
  }
  return result;
}

/**
 * Validate backup data structure
 */
function validateBackupData(data: unknown): data is BackupData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const record = data as Record<string, unknown>;

  // Reject prototype pollution attempts
  if (
    Object.prototype.hasOwnProperty.call(record, '__proto__') ||
    Object.prototype.hasOwnProperty.call(record, 'prototype')
  ) {
    return false;
  }

  // Check required top-level fields
  if (!record.exportVersion || !record.type || !record.data) {
    return false;
  }

  // Validate exportVersion is a string
  if (typeof record.exportVersion !== 'string') {
    return false;
  }

  // Check data structure
  if (typeof record.data !== 'object') {
    return false;
  }

  const innerData = record.data as Record<string, unknown>;

  // For full backups, ensure arrays exist
  if (record.type === 'full_backup') {
    if (
      !Array.isArray(innerData.rifles) ||
      !Array.isArray(innerData.ammos) ||
      !Array.isArray(innerData.logs)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Import full backup (all data)
 */
export async function importFullBackup(): Promise<ImportResult> {
  try {
    const pickResult = await pickImportFile();

    if (!pickResult.success || !pickResult.data) {
      return {
        success: false,
        error: pickResult.error || 'No data to import',
      };
    }

    const data = pickResult.data;

    // Validate data structure
    if (!validateBackupData(data)) {
      return {
        success: false,
        error: 'Invalid backup file format',
      };
    }

    if (data.type !== 'full_backup') {
      return {
        success: false,
        error: 'Not a full backup file. Please select a full backup export.',
      };
    }

    // Get stores
    const rifleStore = useRifleStore.getState();
    const ammoStore = useAmmoStore.getState();
    const environmentStore = useEnvironmentStore.getState();
    const dopeStore = useDOPEStore.getState();

    let riflesImported = 0;
    let ammosImported = 0;
    let environmentsImported = 0;
    let logsImported = 0;
    let riflesSkipped = 0;
    let ammosSkipped = 0;
    let environmentsSkipped = 0;
    let logsSkipped = 0;
    const warnings: string[] = [];

    /**
     * Old id -> new id, per entity type.
     *
     * `id` is deliberately stripped from every record before insert (mass-assignment
     * hardening), so parents receive fresh AUTOINCREMENT ids. DOPE logs reference their
     * parents by id, so those references have to be translated or every insert violates a
     * foreign key -- which is exactly what issue #39 was. Reading `record.id` here is safe:
     * it is used only as a lookup key and never assigned to a new row.
     */
    const rifleIdMap = new Map<number, number>();
    const ammoIdMap = new Map<number, number>();
    const environmentIdMap = new Map<number, number>();

    const originalId = (record: unknown): number | undefined => {
      const id = (record as { id?: unknown })?.id;
      return typeof id === 'number' ? id : undefined;
    };

    // Import rifles (only allowed fields, no ID)
    if (data.data.rifles && Array.isArray(data.data.rifles)) {
      for (const rifleData of data.data.rifles) {
        try {
          const sanitizedRifle = pickAllowedFields(rifleData, RIFLE_ALLOWED_FIELDS);
          const created = await rifleStore.createRifle(sanitizedRifle);
          const oldId = originalId(rifleData);
          if (oldId !== undefined && created.id !== undefined) {
            rifleIdMap.set(oldId, created.id);
          }
          riflesImported++;
        } catch (error) {
          console.error('Failed to import rifle:', error);
          riflesSkipped++;
        }
      }
    }

    // Import ammo profiles (only allowed fields, no ID)
    if (data.data.ammos && Array.isArray(data.data.ammos)) {
      for (const ammoData of data.data.ammos) {
        try {
          const sanitizedAmmo = pickAllowedFields(ammoData, AMMO_ALLOWED_FIELDS);
          const created = await ammoStore.createAmmoProfile(sanitizedAmmo);
          const oldId = originalId(ammoData);
          if (oldId !== undefined && created.id !== undefined) {
            ammoIdMap.set(oldId, created.id);
          }
          ammosImported++;
        } catch (error) {
          console.error('Failed to import ammo:', error);
          ammosSkipped++;
        }
      }
    }

    // Import environment snapshots. Added to the backup format in exportVersion 1.1; a 1.0
    // file has none, which is why its logs cannot be restored.
    if (data.data.environments && Array.isArray(data.data.environments)) {
      for (const environmentData of data.data.environments) {
        try {
          const sanitized = pickAllowedFields(environmentData, ENVIRONMENT_ALLOWED_FIELDS);
          const created = await environmentStore.createSnapshot(sanitized);
          const oldId = originalId(environmentData);
          if (oldId !== undefined && created.id !== undefined) {
            environmentIdMap.set(oldId, created.id);
          }
          environmentsImported++;
        } catch (error) {
          console.error('Failed to import environment snapshot:', error);
          environmentsSkipped++;
        }
      }
    } else if (data.data.logs && Array.isArray(data.data.logs) && data.data.logs.length > 0) {
      warnings.push(
        `This backup (exportVersion ${data.exportVersion}) contains no environment snapshots, ` +
          'so its DOPE logs cannot be restored. Re-export from a current version of the app ' +
          'to produce a restorable backup.'
      );
    }

    // Import DOPE logs (only allowed fields, no ID)
    if (data.data.logs && Array.isArray(data.data.logs)) {
      for (const logData of data.data.logs) {
        try {
          const sanitizedLog = pickAllowedFields(logData, DOPE_LOG_ALLOWED_FIELDS);

          // Translate the backup's ids to the ids the parents were just given.
          const rifleId = rifleIdMap.get(sanitizedLog.rifleId);
          const ammoId = ammoIdMap.get(sanitizedLog.ammoId);
          const environmentId = environmentIdMap.get(sanitizedLog.environmentId);

          if (rifleId === undefined || ammoId === undefined || environmentId === undefined) {
            // A parent is missing from the file (or failed to import). Inserting anyway would
            // either violate a foreign key or, worse, silently attach the log to an unrelated
            // rifle whose id happens to collide.
            logsSkipped++;
            continue;
          }

          await dopeStore.createDopeLog({ ...sanitizedLog, rifleId, ammoId, environmentId });
          logsImported++;
        } catch (error) {
          console.error('Failed to import DOPE log:', error);
          logsSkipped++;
        }
      }
    }

    if (logsSkipped > 0 && warnings.length === 0) {
      warnings.push(
        `${logsSkipped} DOPE log(s) were skipped because the rifle, ammo or environment they ` +
          'reference is missing from the backup file.'
      );
    }

    return {
      success: true,
      imported: {
        rifles: riflesImported,
        ammos: ammosImported,
        environments: environmentsImported,
        logs: logsImported,
      },
      skipped: {
        rifles: riflesSkipped,
        ammos: ammosSkipped,
        environments: environmentsSkipped,
        logs: logsSkipped,
      },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  } catch (error) {
    console.error('Error importing full backup:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Import failed',
    };
  }
}

/**
 * Import rifle profiles only
 */
export async function importRifleProfiles(): Promise<ImportResult> {
  try {
    const pickResult = await pickImportFile();

    if (!pickResult.success || !pickResult.data) {
      return {
        success: false,
        error: pickResult.error || 'No data to import',
      };
    }

    const data = pickResult.data;

    if (data.type !== 'rifle_profiles_batch' && data.type !== 'rifle_profile') {
      return {
        success: false,
        error: 'Not a rifle profile export file',
      };
    }

    const rifleStore = useRifleStore.getState();
    let riflesImported = 0;

    // Handle single or batch import
    const rifles = data.data.rifles ?? [];

    for (const rifleData of rifles) {
      try {
        const sanitizedRifle = pickAllowedFields(rifleData, RIFLE_ALLOWED_FIELDS);
        await rifleStore.createRifle(sanitizedRifle);
        riflesImported++;
      } catch (error) {
        console.error('Failed to import rifle:', error);
      }
    }

    return {
      success: true,
      imported: { rifles: riflesImported },
    };
  } catch (error) {
    console.error('Error importing rifle profiles:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Import failed',
    };
  }
}

/**
 * Import DOPE logs only
 */
export async function importDOPELogs(): Promise<ImportResult> {
  try {
    const pickResult = await pickImportFile();

    if (!pickResult.success || !pickResult.data) {
      return {
        success: false,
        error: pickResult.error || 'No data to import',
      };
    }

    const data = pickResult.data;

    if (data.type !== 'dope_logs') {
      return {
        success: false,
        error: 'Not a DOPE logs export file',
      };
    }

    const dopeStore = useDOPEStore.getState();
    let logsImported = 0;

    const logs = data.data.logs ?? [];

    for (const logData of logs) {
      try {
        const sanitizedLog = pickAllowedFields(logData, DOPE_LOG_ALLOWED_FIELDS);
        await dopeStore.createDopeLog(sanitizedLog);
        logsImported++;
      } catch (error) {
        console.error('Failed to import DOPE log:', error);
      }
    }

    return {
      success: true,
      imported: { logs: logsImported },
    };
  } catch (error) {
    console.error('Error importing DOPE logs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Import failed',
    };
  }
}
