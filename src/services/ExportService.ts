/**
 * Export Service
 * Handles data export in various formats (JSON, CSV, PDF)
 */

import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { RifleProfile } from '../models/RifleProfile';
import type { AmmoProfile } from '../models/AmmoProfile';
import type { DOPELog } from '../models/DOPELog';
import type { RangeSession } from '../models/RangeSession';
import type { EnvironmentSnapshot } from '../models/EnvironmentSnapshot';

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
    const file = new File(Paths.document, filename);

    const data = {
      exportDate: new Date().toISOString(),
      exportVersion: '1.0',
      type: 'ammo_profile',
      data: ammo.toJSON(),
    };

    await file.write(JSON.stringify(data, null, 2));

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Ammo Profile',
        UTI: 'public.json',
      });
    }

    return { success: true, uri: file.uri };
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
export async function exportAllRifleProfilesJSON(rifles: RifleProfile[]): Promise<ExportResult> {
  try {
    const filename = `all_rifles_${Date.now()}.json`;
    const file = new File(Paths.document, filename);

    const data = {
      exportDate: new Date().toISOString(),
      exportVersion: '1.0',
      type: 'rifle_profiles_batch',
      count: rifles.length,
      data: rifles.map((r) => r.toJSON()),
    };

    await file.write(JSON.stringify(data, null, 2));

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export All Rifle Profiles',
        UTI: 'public.json',
      });
    }

    return { success: true, uri: file.uri };
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
function dopeLogsToCSV(logs: DOPELog[], rifles: RifleProfile[], ammos: AmmoProfile[]): string {
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
    const file = new File(Paths.document, filename);

    const csvContent = dopeLogsToCSV(logs, rifles, ammos);
    await file.write(csvContent);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export DOPE Logs',
        UTI: 'public.comma-separated-values-text',
      });
    }

    return { success: true, uri: file.uri };
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
    const file = new File(Paths.document, filename);

    const data = {
      exportDate: new Date().toISOString(),
      exportVersion: '1.0',
      type: 'dope_logs',
      count: logs.length,
      data: logs.map((log) => log.toJSON()),
    };

    await file.write(JSON.stringify(data, null, 2));

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export DOPE Logs',
        UTI: 'public.json',
      });
    }

    return { success: true, uri: file.uri };
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
    const file = new File(Paths.document, filename);

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

    await file.write(JSON.stringify(data, null, 2));

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Full Backup',
        UTI: 'public.json',
      });
    }

    return { success: true, uri: file.uri };
  } catch (error) {
    console.error('Error exporting full backup:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate session report as Markdown
 */
function generateSessionReportMarkdown(
  session: RangeSession,
  rifle: RifleProfile | null,
  ammo: AmmoProfile | null,
  environment: EnvironmentSnapshot | null
): string {
  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const calculateDuration = (): string => {
    if (!session.startTime || !session.endTime) return 'In progress';

    const start = new Date(session.startTime);
    const end = new Date(session.endTime);
    const diffMs = end.getTime() - start.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    const hrs = Math.floor(diffSeconds / 3600);
    const mins = Math.floor((diffSeconds % 3600) / 60);
    const secs = diffSeconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  let report = `# Range Session Report\n\n`;

  // Session header
  if (session.sessionName) {
    report += `**Session:** ${session.sessionName}\n\n`;
  }
  report += `**Date:** ${formatDate(session.startTime)}\n\n`;

  // Summary section
  report += `## Summary\n\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| Shots Fired | ${session.shotCount} |\n`;
  report += `| Duration | ${calculateDuration()} |\n`;
  report += `| Distance | ${session.distance} yards |\n`;
  report += `| Cold Bore | ${session.coldBoreShot ? 'Yes' : 'No'} |\n\n`;

  // Time details
  report += `## Time Details\n\n`;
  report += `- **Started:** ${formatTime(session.startTime)}\n`;
  if (session.endTime) {
    report += `- **Ended:** ${formatTime(session.endTime)}\n`;
  }
  report += `\n`;

  // Equipment section
  report += `## Equipment\n\n`;
  report += `### Rifle\n\n`;
  if (rifle) {
    report += `- **Name:** ${rifle.name}\n`;
    report += `- **Caliber:** ${rifle.caliber}\n`;
    report += `- **Zero Distance:** ${rifle.zeroDistance} yards\n`;
    if (rifle.opticManufacturer || rifle.opticModel) {
      report += `- **Optic:** ${rifle.opticManufacturer || ''} ${rifle.opticModel || ''}\n`;
    }
  } else {
    report += `Unknown rifle\n`;
  }
  report += `\n`;

  report += `### Ammunition\n\n`;
  if (ammo) {
    report += `- **Name:** ${ammo.name}\n`;
    report += `- **Manufacturer:** ${ammo.manufacturer}\n`;
    report += `- **Caliber:** ${ammo.caliber}\n`;
    report += `- **Bullet Weight:** ${ammo.bulletWeight} gr\n`;
    report += `- **Muzzle Velocity:** ${ammo.muzzleVelocity} fps\n`;
    if (ammo.ballisticCoefficientG1) {
      report += `- **BC (G1):** ${ammo.ballisticCoefficientG1}\n`;
    }
    if (ammo.ballisticCoefficientG7) {
      report += `- **BC (G7):** ${ammo.ballisticCoefficientG7}\n`;
    }
  } else {
    report += `Unknown ammunition\n`;
  }
  report += `\n`;

  // Environmental conditions
  report += `## Environmental Conditions\n\n`;
  if (environment) {
    report += `| Parameter | Value |\n`;
    report += `|-----------|-------|\n`;
    report += `| Temperature | ${environment.temperature}°F |\n`;
    report += `| Humidity | ${environment.humidity}% |\n`;
    report += `| Pressure | ${environment.pressure} inHg |\n`;
    report += `| Altitude | ${environment.altitude} ft |\n`;
    report += `| Wind Speed | ${environment.windSpeed} mph |\n`;
    report += `| Wind Direction | ${environment.windDirection}° |\n`;
    if (environment.densityAltitude !== undefined) {
      report += `| Density Altitude | ${environment.densityAltitude} ft |\n`;
    }
  } else {
    report += `No environmental data recorded.\n`;
  }
  report += `\n`;

  // Notes section
  if (session.notes) {
    report += `## Notes\n\n`;
    report += `${session.notes}\n\n`;
  }

  // Footer
  report += `---\n\n`;
  report += `*Generated by Mobile DOPE on ${new Date().toLocaleString()}*\n`;

  return report;
}

/**
 * Export range session report as Markdown
 */
export async function exportSessionReportMarkdown(
  session: RangeSession,
  rifle: RifleProfile | null,
  ammo: AmmoProfile | null,
  environment: EnvironmentSnapshot | null
): Promise<ExportResult> {
  try {
    const sessionName = session.sessionName || `session_${session.id}`;
    const filename = `range_session_${sessionName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.md`;
    const file = new File(Paths.document, filename);

    const markdownContent = generateSessionReportMarkdown(session, rifle, ammo, environment);
    await file.write(markdownContent);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/markdown',
        dialogTitle: 'Export Session Report',
        UTI: 'net.daringfireball.markdown',
      });
    }

    return { success: true, uri: file.uri };
  } catch (error) {
    console.error('Error exporting session report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Export range session report as JSON
 */
export async function exportSessionReportJSON(
  session: RangeSession,
  rifle: RifleProfile | null,
  ammo: AmmoProfile | null,
  environment: EnvironmentSnapshot | null
): Promise<ExportResult> {
  try {
    const sessionName = session.sessionName || `session_${session.id}`;
    const filename = `range_session_${sessionName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
    const file = new File(Paths.document, filename);

    const data = {
      exportDate: new Date().toISOString(),
      exportVersion: '1.0',
      type: 'range_session_report',
      session: session.toJSON(),
      rifle: rifle ? rifle.toJSON() : null,
      ammo: ammo ? ammo.toJSON() : null,
      environment: environment ? environment.toJSON() : null,
    };

    await file.write(JSON.stringify(data, null, 2));

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Session Report',
        UTI: 'public.json',
      });
    }

    return { success: true, uri: file.uri };
  } catch (error) {
    console.error('Error exporting session report JSON:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
