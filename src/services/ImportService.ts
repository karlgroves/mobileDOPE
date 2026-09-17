/**
 * Import Service
 * Handles data import from various formats (JSON backups)
 */

import { DOPELogData } from '../models/DOPELog';
import { useAmmoStore } from '../store/useAmmoStore';
import { useDOPEStore } from '../store/useDOPEStore';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { useRifleStore } from '../store/useRifleStore';
import {
  ammoKey,
  dopeLogKey,
  environmentKey,
  MergeStrategy,
  planMerge,
  rifleKey,
} from '../utils/importMerge';

import { exceedsMaxDepth, exceedsMaxSize, isLocalFileUri, oversizedMessage } from './importGuards';

export interface ImportResult {
  success: boolean;
  imported?: {
    rifles?: number;
    ammos?: number;
    environments?: number;
    logs?: number;
  };
  /**
   * Records that overwrote a stored record, under `replace-existing` (#66).
   * Separate from `imported` so "the file won" is distinguishable from
   * "this is new", which is the whole point of offering the choice.
   */
  replaced?: {
    rifles?: number;
    ammos?: number;
    environments?: number;
    logs?: number;
  };
  /**
   * Records present in the file that were not imported: either already stored
   * (the normal case under `skip-existing`) or unimportable. Previously these were swallowed
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

    const uri = result.assets[0].uri;

    // The picker is asked to copy into the cache directory, so this should always
    // be a local path -- but `fetch` would just as happily go to a remote host,
    // and PRIVACY.md promises users the app has no network layer. Checking here
    // turns that promise from something everyone has been careful about into
    // something the code enforces. (Issue #68.)
    if (!isLocalFileUri(uri)) {
      return { success: false, error: 'That file is not on this device.' };
    }

    const response = await fetch(uri);
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
 * The `id` a record carries, when it has one.
 *
 * Reading it is safe: it is used only as a lookup key -- to point a child at the
 * row its parent actually became, and to address a row a `replace` should
 * overwrite -- and is never assigned to a new row. `pickAllowedFields` keeps it
 * out of every insert.
 */
const originalId = (record: unknown): number | undefined => {
  const id = (record as { id?: unknown })?.id;
  return typeof id === 'number' ? id : undefined;
};

/**
 * Import full backup (all data).
 *
 * `strategy` decides what happens to records the device already has (#66).
 * `skip-existing` keeps what is stored and imports only what is new, which is
 * what restoring a backup onto a device you have kept using should do.
 * `replace-existing` lets the file win. `create-all` is the behaviour before
 * #66 -- every record imported as new -- kept because it is the only way to
 * deliberately end up with two of something.
 */
export async function importFullBackup(
  strategy: MergeStrategy = 'skip-existing'
): Promise<ImportResult> {
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
    let riflesReplaced = 0;
    let ammosReplaced = 0;
    let environmentsReplaced = 0;
    let logsReplaced = 0;
    /**
     * Logs skipped because a parent is missing, as opposed to skipped because
     * they are already stored. Only the first is a problem worth warning about;
     * conflating them made a normal second import report that its backup was
     * incomplete.
     */
    let logsOrphaned = 0;
    const warnings: string[] = [];

    /**
     * Old id -> new id, per entity type.
     *
     * `id` is deliberately stripped from every record before insert (mass-assignment
     * hardening), so parents receive fresh AUTOINCREMENT ids. DOPE logs reference their
     * parents by id, so those references have to be translated or every insert violates a
     * foreign key -- which is exactly what issue #39 was. See `originalId` for why reading
     * the incoming id is safe.
     */
    const rifleIdMap = new Map<number, number>();
    const ammoIdMap = new Map<number, number>();
    const environmentIdMap = new Map<number, number>();

    // Import rifles (only allowed fields, no ID).
    //
    // Planned before executing, so a record that already exists is skipped
    // rather than duplicated (#66). The id mapping is the part that has to be
    // right: a SKIPPED rifle still needs its old id pointed at the EXISTING
    // row, or every DOPE log referencing it violates a foreign key -- which is
    // what #39 was.
    if (data.data.rifles && Array.isArray(data.data.rifles)) {
      // Re-read the state after loading rather than using the `rifleStore`
      // snapshot taken above: zustand's `getState()` returns the state object as
      // it was, so `rifleStore.rifles` would still be whatever was in memory
      // before `loadRifles()` replaced it. Planning against a stale list is the
      // worst possible input -- it skips records that are not really there.
      await rifleStore.loadRifles();
      const plan = planMerge(useRifleStore.getState().rifles, data.data.rifles, rifleKey, strategy);

      for (const { record: rifleData, action, existing } of plan.actions) {
        const oldId = originalId(rifleData);
        const existingId = originalId(existing);

        if (action === 'skip') {
          if (oldId !== undefined && existingId !== undefined) {
            rifleIdMap.set(oldId, existingId);
          }
          riflesSkipped++;
          continue;
        }

        try {
          const sanitizedRifle = pickAllowedFields(rifleData, RIFLE_ALLOWED_FIELDS);

          if (action === 'replace' && existingId !== undefined) {
            await rifleStore.updateRifle(existingId, sanitizedRifle);
            if (oldId !== undefined) rifleIdMap.set(oldId, existingId);
            riflesReplaced++;
            continue;
          }

          const created = await rifleStore.createRifle(sanitizedRifle);
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

    // Import ammo profiles (only allowed fields, no ID). Same planning and same
    // id-mapping rule as rifles above.
    if (data.data.ammos && Array.isArray(data.data.ammos)) {
      await ammoStore.loadAmmoProfiles();
      const plan = planMerge(
        useAmmoStore.getState().ammoProfiles,
        data.data.ammos,
        ammoKey,
        strategy
      );

      for (const { record: ammoData, action, existing } of plan.actions) {
        const oldId = originalId(ammoData);
        const existingId = originalId(existing);

        if (action === 'skip') {
          if (oldId !== undefined && existingId !== undefined) {
            ammoIdMap.set(oldId, existingId);
          }
          ammosSkipped++;
          continue;
        }

        try {
          const sanitizedAmmo = pickAllowedFields(ammoData, AMMO_ALLOWED_FIELDS);

          if (action === 'replace' && existingId !== undefined) {
            await ammoStore.updateAmmoProfile(existingId, sanitizedAmmo);
            if (oldId !== undefined) ammoIdMap.set(oldId, existingId);
            ammosReplaced++;
            continue;
          }

          const created = await ammoStore.createAmmoProfile(sanitizedAmmo);
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
    //
    // Planned like the rest: a snapshot that is already stored must map its old
    // id to the EXISTING row, or the logs referencing it are dropped on every
    // re-import. `loadSnapshots()` is called without a limit on purpose: with
    // one it returns only the most recent, and planning against a truncated list
    // would re-create snapshots that are already stored.
    if (data.data.environments && Array.isArray(data.data.environments)) {
      await environmentStore.loadSnapshots();
      const plan = planMerge(
        useEnvironmentStore.getState().snapshots,
        data.data.environments,
        environmentKey,
        strategy
      );

      for (const { record: environmentData, action, existing } of plan.actions) {
        const oldId = originalId(environmentData);
        const existingId = originalId(existing);

        if (action === 'skip') {
          if (oldId !== undefined && existingId !== undefined) {
            environmentIdMap.set(oldId, existingId);
          }
          environmentsSkipped++;
          continue;
        }

        try {
          const sanitized = pickAllowedFields(environmentData, ENVIRONMENT_ALLOWED_FIELDS);

          if (action === 'replace' && existingId !== undefined) {
            await environmentStore.updateSnapshot(existingId, sanitized);
            if (oldId !== undefined) environmentIdMap.set(oldId, existingId);
            environmentsReplaced++;
            continue;
          }

          const created = await environmentStore.createSnapshot(sanitized);
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

    // Import DOPE logs (only allowed fields, no ID).
    //
    // Two passes, because the parent ids have to be translated BEFORE the logs
    // can be matched against what is stored: `dopeLogKey` includes rifleId and
    // ammoId, and the ids in the file are the exporting device's. Keying on
    // those would compare the backup's numbering against this device's and
    // match nothing, so every re-import would duplicate every log.
    if (data.data.logs && Array.isArray(data.data.logs)) {
      // `pickAllowedFields` returns `any` by design (it validates by allow-list,
      // not by type), so these hold exactly what the old code passed straight to
      // `createDopeLog` -- just kept for a pass first.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const translated: any[] = [];

      for (const logData of data.data.logs) {
        const sanitizedLog = pickAllowedFields(logData, DOPE_LOG_ALLOWED_FIELDS);
        const rifleId = rifleIdMap.get(sanitizedLog.rifleId);
        const ammoId = ammoIdMap.get(sanitizedLog.ammoId);
        const environmentId = environmentIdMap.get(sanitizedLog.environmentId);

        if (rifleId === undefined || ammoId === undefined || environmentId === undefined) {
          // A parent is missing from the file (or failed to import). Inserting anyway would
          // either violate a foreign key or, worse, silently attach the log to an unrelated
          // rifle whose id happens to collide.
          logsOrphaned++;
          logsSkipped++;
          continue;
        }

        translated.push({ ...sanitizedLog, rifleId, ammoId, environmentId });
      }

      await dopeStore.loadDopeLogs();
      // T is pinned rather than inferred: with `any` on one side and `DOPELog`
      // on the other, inference settles on `unknown` and the store rejects it.
      const plan = planMerge<DOPELogData>(
        useDOPEStore.getState().dopeLogs,
        translated,
        dopeLogKey,
        strategy
      );

      for (const { record: logRecord, action, existing } of plan.actions) {
        if (action === 'skip') {
          logsSkipped++;
          continue;
        }

        try {
          const existingId = originalId(existing);

          if (action === 'replace' && existingId !== undefined) {
            await dopeStore.updateDopeLog(existingId, logRecord);
            logsReplaced++;
            continue;
          }

          await dopeStore.createDopeLog(logRecord);
          logsImported++;
        } catch (error) {
          console.error('Failed to import DOPE log:', error);
          logsSkipped++;
        }
      }
    }

    if (logsOrphaned > 0 && warnings.length === 0) {
      warnings.push(
        `${logsOrphaned} DOPE log(s) were skipped because the rifle, ammo or environment they ` +
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
      replaced: {
        rifles: riflesReplaced,
        ammos: ammosReplaced,
        environments: environmentsReplaced,
        logs: logsReplaced,
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
export async function importRifleProfiles(
  strategy: MergeStrategy = 'skip-existing'
): Promise<ImportResult> {
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
    let riflesReplaced = 0;
    let riflesSkipped = 0;

    // Handle single or batch import.
    //
    // The three shapes are all real files. `exportRifleProfileJSON` writes one
    // profile as `data`, `exportAllRifleProfilesJSON` writes an array as `data`,
    // and a full backup nests them under `data.rifles`. This only ever read the
    // third, so every file the profile exporters actually produce imported zero
    // records and reported success.
    const payload: unknown = data.data;
    const rifles = Array.isArray(payload)
      ? payload
      : ((payload as { rifles?: unknown[] })?.rifles ??
        (payload && typeof payload === 'object' ? [payload] : []));

    // Planned like the full backup (#66): sharing a profile twice should not
    // leave two of it. No id translation is needed here -- a profile export
    // carries no children to re-point.
    await rifleStore.loadRifles();
    const plan = planMerge(useRifleStore.getState().rifles, rifles, rifleKey, strategy);

    for (const { record: rifleData, action, existing } of plan.actions) {
      if (action === 'skip') {
        riflesSkipped++;
        continue;
      }

      try {
        const sanitizedRifle = pickAllowedFields(rifleData, RIFLE_ALLOWED_FIELDS);
        const existingId = originalId(existing);

        if (action === 'replace' && existingId !== undefined) {
          await rifleStore.updateRifle(existingId, sanitizedRifle);
          riflesReplaced++;
          continue;
        }

        await rifleStore.createRifle(sanitizedRifle);
        riflesImported++;
      } catch (error) {
        console.error('Failed to import rifle:', error);
        riflesSkipped++;
      }
    }

    return {
      success: true,
      imported: { rifles: riflesImported },
      replaced: { rifles: riflesReplaced },
      skipped: { rifles: riflesSkipped },
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
