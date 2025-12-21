/**
 * Import Service
 * Handles data import from various formats (JSON backups)
 */

import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { RifleProfile } from '../models/RifleProfile';
import type { AmmoProfile } from '../models/AmmoProfile';
import type { DOPELog } from '../models/DOPELog';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import { useDOPEStore } from '../store/useDOPEStore';

export interface ImportResult {
  success: boolean;
  imported?: {
    rifles?: number;
    ammos?: number;
    logs?: number;
  };
  error?: string;
}

interface BackupData {
  exportDate: string;
  exportVersion: string;
  type: string;
  data: {
    rifles?: any[];
    ammos?: any[];
    logs?: any[];
  };
  counts?: {
    rifles?: number;
    ammos?: number;
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
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return { success: false, error: 'Import cancelled' };
    }

    const file = new File(result.assets[0].uri);
    const content = await file.text();
    const data: BackupData = JSON.parse(content);

    return { success: true, data };
  } catch (error) {
    console.error('Error picking import file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read file',
    };
  }
}

/**
 * Validate backup data structure
 */
function validateBackupData(data: any): data is BackupData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check required top-level fields
  if (!data.exportVersion || !data.type || !data.data) {
    return false;
  }

  // Check data structure
  if (typeof data.data !== 'object') {
    return false;
  }

  // For full backups, ensure arrays exist
  if (data.type === 'full_backup') {
    if (
      !Array.isArray(data.data.rifles) ||
      !Array.isArray(data.data.ammos) ||
      !Array.isArray(data.data.logs)
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
    const dopeStore = useDOPEStore.getState();

    let riflesImported = 0;
    let ammosImported = 0;
    let logsImported = 0;

    // Import rifles
    if (data.data.rifles && Array.isArray(data.data.rifles)) {
      for (const rifleData of data.data.rifles) {
        try {
          // Remove ID to create new records (avoid conflicts)
          const { id, ...rifleWithoutId } = rifleData;
          await rifleStore.createRifle(rifleWithoutId);
          riflesImported++;
        } catch (error) {
          console.error('Failed to import rifle:', error);
        }
      }
    }

    // Import ammo profiles
    if (data.data.ammos && Array.isArray(data.data.ammos)) {
      for (const ammoData of data.data.ammos) {
        try {
          // Remove ID and rifleId (ammo is now caliber-based)
          const { id, rifleId, ...ammoWithoutId } = ammoData;
          await ammoStore.createAmmo(ammoWithoutId);
          ammosImported++;
        } catch (error) {
          console.error('Failed to import ammo:', error);
        }
      }
    }

    // Import DOPE logs
    if (data.data.logs && Array.isArray(data.data.logs)) {
      for (const logData of data.data.logs) {
        try {
          // Remove ID to create new records
          const { id, ...logWithoutId } = logData;
          await dopeStore.createDopeLog(logWithoutId);
          logsImported++;
        } catch (error) {
          console.error('Failed to import DOPE log:', error);
        }
      }
    }

    return {
      success: true,
      imported: {
        rifles: riflesImported,
        ammos: ammosImported,
        logs: logsImported,
      },
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
    const rifles = data.type === 'rifle_profile' ? [data.data] : data.data;

    if (Array.isArray(rifles)) {
      for (const rifleData of rifles) {
        try {
          const { id, ...rifleWithoutId } = rifleData;
          await rifleStore.createRifle(rifleWithoutId);
          riflesImported++;
        } catch (error) {
          console.error('Failed to import rifle:', error);
        }
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

    if (data.data && Array.isArray(data.data)) {
      for (const logData of data.data) {
        try {
          const { id, ...logWithoutId } = logData;
          await dopeStore.createDopeLog(logWithoutId);
          logsImported++;
        } catch (error) {
          console.error('Failed to import DOPE log:', error);
        }
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
