/**
 * Export Service
 * Handles data export in various formats (JSON, CSV, PDF)
 */

import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { RifleProfile } from '../models/RifleProfile';
import type { AmmoProfile } from '../models/AmmoProfile';
import type { DOPELog } from '../models/DOPELog';

export interface ExportResult {
  success: boolean;
  uri?: string;
  error?: string;
}

/**
 * Export rifle profile to JSON
 */
export async function exportRifleProfileJSON(rifle: RifleProfile): Promise<ExportResult> {
  try {
    const filename = `rifle_${rifle.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
    const file = new File(Paths.document, filename);

    const data = {
      exportDate: new Date().toISOString(),
      exportVersion: '1.0',
      type: 'rifle_profile',
      data: rifle.toJSON(),
    };

    await file.write(JSON.stringify(data, null, 2));

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Rifle Profile',
        UTI: 'public.json',
      });
    }

    return { success: true, uri: file.uri };
  } catch (error) {
    console.error('Error exporting rifle profile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Export ammunition profile to JSON
 */
export async function exportAmmoProfileJSON(ammo: AmmoProfile): Promise<ExportResult> {
  try {
    const filename = `ammo_${ammo.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
    const fileUri = `${FileSystem.documentDirectory}${filename}`;

    const data = {
      exportDate: new Date().toISOString(),
      exportVersion: '1.0',
      type: 'ammo_profile',
      data: ammo.toJSON(),
    };

    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2));

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Ammo Profile',
        UTI: 'public.json',
      });
    }

    return { success: true, uri: fileUri };
  } catch (error) {
    console.error('Error exporting ammo profile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Export multiple rifle profiles to JSON
 */
export async function exportAllRifleProfilesJSON(
  rifles: RifleProfile[]
): Promise<ExportResult> {
  try {
    const filename = `all_rifles_${Date.now()}.json`;
    const fileUri = `${FileSystem.documentDirectory}${filename}`;

    const data = {
      exportDate: new Date().toISOString(),
      exportVersion: '1.0',
      type: 'rifle_profiles_batch',
      count: rifles.length,
      data: rifles.map((r) => r.toJSON()),
    };

    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2));

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export All Rifle Profiles',
        UTI: 'public.json',
      });
    }

    return { success: true, uri: fileUri };
  } catch (error) {
    console.error('Error exporting all rifle profiles:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Convert DOPE logs to CSV format
 */
function dopeLogsToCSV(
  logs: DOPELog[],
  rifles: RifleProfile[],
  ammos: AmmoProfile[]
): string {
  const getRifleName = (rifleId?: number) => {
    const rifle = rifles.find((r) => r.id === rifleId);
    return rifle ? rifle.name : 'Unknown';
  };

  const getAmmoName = (ammoId?: number) => {
    const ammo = ammos.find((a) => a.id === ammoId);
    return ammo ? ammo.name : 'Unknown';
  };

  // CSV header
  const headers = [
    'Date',
    'Rifle',
    'Ammunition',
    'Distance',
    'Elevation Correction',
    'Windage Correction',
    'Angular Unit',
    'Hit',
    'Target Type',
    'Group Size',
    'Temperature',
    'Humidity',
    'Pressure',
    'Wind Speed',
    'Wind Direction',
    'Altitude',
    'Notes',
  ];

  const rows = logs.map((log) => {
    return [
      log.timestamp ? new Date(log.timestamp).toISOString() : '',
      getRifleName(log.rifleId),
      getAmmoName(log.ammoId),
      log.distance,
      log.elevationCorrection,
      log.windageCorrection,
      log.correctionUnit,
      log.hitCount || log.shotCount ? 'Yes' : 'No',
      log.targetType || '',
      log.groupSize || '',
      '', // temperature - would need environment lookup
      '', // humidity - would need environment lookup
      '', // pressure - would need environment lookup
      '', // windSpeed - would need environment lookup
      '', // windDirection - would need environment lookup
      '', // altitude - would need environment lookup
      log.notes ? `"${log.notes.replace(/"/g, '""')}"` : '',
    ];
  });

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  return csvContent;
}

/**
 * Export DOPE logs to CSV
 */
export async function exportDOPELogsCSV(
  logs: DOPELog[],
  rifles: RifleProfile[],
  ammos: AmmoProfile[]
): Promise<ExportResult> {
  try {
    const filename = `dope_logs_${Date.now()}.csv`;
    const fileUri = `${FileSystem.documentDirectory}${filename}`;

    const csvContent = dopeLogsToCSV(logs, rifles, ammos);
    await FileSystem.writeAsStringAsync(fileUri, csvContent);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export DOPE Logs',
        UTI: 'public.comma-separated-values-text',
      });
    }

    return { success: true, uri: fileUri };
  } catch (error) {
    console.error('Error exporting DOPE logs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Export DOPE logs to JSON
 */
export async function exportDOPELogsJSON(logs: DOPELog[]): Promise<ExportResult> {
  try {
    const filename = `dope_logs_${Date.now()}.json`;
    const fileUri = `${FileSystem.documentDirectory}${filename}`;

    const data = {
      exportDate: new Date().toISOString(),
      exportVersion: '1.0',
      type: 'dope_logs',
      count: logs.length,
      data: logs.map((log) => log.toJSON()),
    };

    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2));

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export DOPE Logs',
        UTI: 'public.json',
      });
    }

    return { success: true, uri: fileUri };
  } catch (error) {
    console.error('Error exporting DOPE logs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Export full database backup (all data)
 */
export async function exportFullBackup(
  rifles: RifleProfile[],
  ammos: AmmoProfile[],
  logs: DOPELog[]
): Promise<ExportResult> {
  try {
    const filename = `mobiledope_backup_${Date.now()}.json`;
    const fileUri = `${FileSystem.documentDirectory}${filename}`;

    const data = {
      exportDate: new Date().toISOString(),
      exportVersion: '1.0',
      type: 'full_backup',
      data: {
        rifles: rifles.map((r) => r.toJSON()),
        ammos: ammos.map((a) => a.toJSON()),
        logs: logs.map((l) => l.toJSON()),
      },
      counts: {
        rifles: rifles.length,
        ammos: ammos.length,
        logs: logs.length,
      },
    };

    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2));

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Full Backup',
        UTI: 'public.json',
      });
    }

    return { success: true, uri: fileUri };
  } catch (error) {
    console.error('Error exporting full backup:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
