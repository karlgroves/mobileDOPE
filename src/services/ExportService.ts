/**
 * Export Service
 * Handles data export in various formats (JSON, CSV, PDF)
 */

import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import type { RifleProfile } from '../models/RifleProfile';
import type { AmmoProfile } from '../models/AmmoProfile';
import type { DOPELog } from '../models/DOPELog';
import type { RangeSession } from '../models/RangeSession';
import type { EnvironmentSnapshot } from '../models/EnvironmentSnapshot';
import type { BallisticSolution } from '../types/ballistic.types';

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
 * Generate HTML for DOPE logs PDF report
 */
function generateDOPELogsPDFHtml(
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

  const formatDate = (timestamp?: string): string => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Group logs by rifle for better organization
  const logsByRifle = logs.reduce(
    (acc, log) => {
      const rifleName = getRifleName(log.rifleId);
      if (!acc[rifleName]) {
        acc[rifleName] = [];
      }
      acc[rifleName].push(log);
      return acc;
    },
    {} as Record<string, DOPELog[]>
  );

  const tableRows = Object.entries(logsByRifle)
    .map(([rifleName, rifleLogs]) => {
      const rows = rifleLogs
        .sort((a, b) => (a.distance || 0) - (b.distance || 0))
        .map(
          (log) => `
        <tr>
          <td>${formatDate(log.timestamp)}</td>
          <td>${log.distance || 'N/A'}</td>
          <td class="correction">${log.elevationCorrection?.toFixed(1) || '--'}</td>
          <td class="correction">${log.windageCorrection?.toFixed(1) || '--'}</td>
          <td>${log.correctionUnit || 'MIL'}</td>
          <td>${getAmmoName(log.ammoId)}</td>
          <td>${log.notes || ''}</td>
        </tr>
      `
        )
        .join('');

      return `
        <tr class="rifle-header">
          <td colspan="7">${rifleName} (${rifleLogs.length} logs)</td>
        </tr>
        ${rows}
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 11px;
          line-height: 1.4;
          color: #1a1a1a;
          padding: 20px;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #333;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        .header h1 {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .header .subtitle {
          font-size: 12px;
          color: #666;
        }
        .summary {
          display: flex;
          justify-content: space-around;
          margin-bottom: 20px;
          padding: 10px;
          background-color: #f5f5f5;
          border-radius: 4px;
        }
        .summary-item {
          text-align: center;
        }
        .summary-item .value {
          font-size: 20px;
          font-weight: bold;
          color: #2E7D32;
        }
        .summary-item .label {
          font-size: 10px;
          color: #666;
          text-transform: uppercase;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        th, td {
          padding: 6px 8px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        th {
          background-color: #333;
          color: white;
          font-weight: 600;
          font-size: 10px;
          text-transform: uppercase;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .rifle-header {
          background-color: #2E7D32 !important;
          color: white;
          font-weight: bold;
        }
        .rifle-header td {
          padding: 8px;
          font-size: 12px;
        }
        .correction {
          font-weight: 600;
          font-family: monospace;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 10px;
          color: #999;
          border-top: 1px solid #ddd;
          padding-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>DOPE Logs Report</h1>
        <div class="subtitle">Generated by Mobile DOPE</div>
      </div>

      <div class="summary">
        <div class="summary-item">
          <div class="value">${logs.length}</div>
          <div class="label">Total Logs</div>
        </div>
        <div class="summary-item">
          <div class="value">${Object.keys(logsByRifle).length}</div>
          <div class="label">Rifles</div>
        </div>
        <div class="summary-item">
          <div class="value">${[...new Set(logs.map((l) => l.ammoId))].length}</div>
          <div class="label">Ammo Types</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Distance</th>
            <th>Elevation</th>
            <th>Windage</th>
            <th>Unit</th>
            <th>Ammunition</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <div class="footer">
        Generated on ${new Date().toLocaleString()}
      </div>
    </body>
    </html>
  `;
}

/**
 * Export DOPE logs as PDF report
 */
export async function exportDOPELogsPDF(
  logs: DOPELog[],
  rifles: RifleProfile[],
  ammos: AmmoProfile[]
): Promise<ExportResult> {
  try {
    const html = generateDOPELogsPDFHtml(logs, rifles, ammos);

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Export DOPE Logs PDF',
        UTI: 'com.adobe.pdf',
      });
    }

    return { success: true, uri };
  } catch (error) {
    console.error('Error exporting DOPE logs PDF:', error);
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

/**
 * Generate HTML for range session PDF report
 */
function generateSessionReportPDFHtml(
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

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 12px;
          line-height: 1.5;
          color: #1a1a1a;
          padding: 30px;
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #2E7D32;
          padding-bottom: 20px;
          margin-bottom: 25px;
        }
        .header h1 {
          font-size: 28px;
          font-weight: bold;
          color: #2E7D32;
          margin-bottom: 5px;
        }
        .header .session-name {
          font-size: 18px;
          color: #333;
        }
        .header .date {
          font-size: 14px;
          color: #666;
          margin-top: 5px;
        }
        .summary-grid {
          display: flex;
          justify-content: space-around;
          margin-bottom: 30px;
          padding: 20px;
          background-color: #f8f8f8;
          border-radius: 8px;
        }
        .summary-item {
          text-align: center;
        }
        .summary-item .value {
          font-size: 32px;
          font-weight: bold;
          color: #2E7D32;
        }
        .summary-item .label {
          font-size: 11px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          font-size: 16px;
          font-weight: bold;
          color: #2E7D32;
          border-bottom: 2px solid #e0e0e0;
          padding-bottom: 8px;
          margin-bottom: 15px;
        }
        .two-columns {
          display: flex;
          gap: 30px;
        }
        .column {
          flex: 1;
        }
        .info-row {
          display: flex;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }
        .info-label {
          width: 140px;
          font-weight: 500;
          color: #666;
        }
        .info-value {
          flex: 1;
          color: #1a1a1a;
        }
        .environment-table {
          width: 100%;
          border-collapse: collapse;
        }
        .environment-table th,
        .environment-table td {
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        .environment-table th {
          background-color: #2E7D32;
          color: white;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
        }
        .environment-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .notes-section {
          background-color: #fff9e6;
          border-left: 4px solid #f0ad4e;
          padding: 15px;
          margin-top: 20px;
        }
        .notes-section h3 {
          color: #8a6d3b;
          margin-bottom: 10px;
        }
        .time-details {
          display: flex;
          gap: 40px;
          padding: 15px 0;
        }
        .time-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .time-item .label {
          color: #666;
        }
        .time-item .value {
          font-weight: 600;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 10px;
          color: #999;
          border-top: 1px solid #ddd;
          padding-top: 15px;
        }
        .cold-bore-badge {
          display: inline-block;
          background-color: #ff9800;
          color: white;
          padding: 4px 12px;
          border-radius: 15px;
          font-size: 11px;
          font-weight: 600;
          margin-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Range Session Report</h1>
        ${session.sessionName ? `<div class="session-name">${session.sessionName}</div>` : ''}
        <div class="date">${formatDate(session.startTime)}</div>
        ${session.coldBoreShot ? '<div class="cold-bore-badge">Cold Bore Shot</div>' : ''}
      </div>

      <div class="summary-grid">
        <div class="summary-item">
          <div class="value">${session.shotCount}</div>
          <div class="label">Shots Fired</div>
        </div>
        <div class="summary-item">
          <div class="value">${calculateDuration()}</div>
          <div class="label">Duration</div>
        </div>
        <div class="summary-item">
          <div class="value">${session.distance}</div>
          <div class="label">Distance (yds)</div>
        </div>
      </div>

      <div class="time-details">
        <div class="time-item">
          <span class="label">Started:</span>
          <span class="value">${formatTime(session.startTime)}</span>
        </div>
        ${
          session.endTime
            ? `
        <div class="time-item">
          <span class="label">Ended:</span>
          <span class="value">${formatTime(session.endTime)}</span>
        </div>
        `
            : ''
        }
      </div>

      <div class="two-columns">
        <div class="column">
          <div class="section">
            <div class="section-title">Rifle</div>
            ${
              rifle
                ? `
              <div class="info-row">
                <div class="info-label">Name</div>
                <div class="info-value">${rifle.name}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Caliber</div>
                <div class="info-value">${rifle.caliber}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Zero Distance</div>
                <div class="info-value">${rifle.zeroDistance} yards</div>
              </div>
              ${
                rifle.opticManufacturer || rifle.opticModel
                  ? `
              <div class="info-row">
                <div class="info-label">Optic</div>
                <div class="info-value">${rifle.opticManufacturer || ''} ${rifle.opticModel || ''}</div>
              </div>
              `
                  : ''
              }
            `
                : '<p>Unknown rifle</p>'
            }
          </div>
        </div>

        <div class="column">
          <div class="section">
            <div class="section-title">Ammunition</div>
            ${
              ammo
                ? `
              <div class="info-row">
                <div class="info-label">Name</div>
                <div class="info-value">${ammo.name}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Manufacturer</div>
                <div class="info-value">${ammo.manufacturer}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Bullet Weight</div>
                <div class="info-value">${ammo.bulletWeight} gr</div>
              </div>
              <div class="info-row">
                <div class="info-label">Muzzle Velocity</div>
                <div class="info-value">${ammo.muzzleVelocity} fps</div>
              </div>
              ${
                ammo.ballisticCoefficientG1
                  ? `
              <div class="info-row">
                <div class="info-label">BC (G1)</div>
                <div class="info-value">${ammo.ballisticCoefficientG1}</div>
              </div>
              `
                  : ''
              }
            `
                : '<p>Unknown ammunition</p>'
            }
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Environmental Conditions</div>
        ${
          environment
            ? `
          <table class="environment-table">
            <thead>
              <tr>
                <th>Temperature</th>
                <th>Humidity</th>
                <th>Pressure</th>
                <th>Altitude</th>
                <th>Wind</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${environment.temperature}°F</td>
                <td>${environment.humidity}%</td>
                <td>${environment.pressure} inHg</td>
                <td>${environment.altitude} ft</td>
                <td>${environment.windSpeed} mph @ ${environment.windDirection}°</td>
              </tr>
            </tbody>
          </table>
          ${environment.densityAltitude !== undefined ? `<p style="margin-top: 10px; color: #666;">Density Altitude: ${environment.densityAltitude} ft</p>` : ''}
        `
            : '<p>No environmental data recorded.</p>'
        }
      </div>

      ${
        session.notes
          ? `
      <div class="notes-section">
        <h3>Notes</h3>
        <p>${session.notes}</p>
      </div>
      `
          : ''
      }

      <div class="footer">
        Generated by Mobile DOPE on ${new Date().toLocaleString()}
      </div>
    </body>
    </html>
  `;
}

/**
 * Export range session report as PDF
 */
export async function exportSessionReportPDF(
  session: RangeSession,
  rifle: RifleProfile | null,
  ammo: AmmoProfile | null,
  environment: EnvironmentSnapshot | null
): Promise<ExportResult> {
  try {
    const html = generateSessionReportPDFHtml(session, rifle, ammo, environment);

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Export Session Report PDF',
        UTI: 'com.adobe.pdf',
      });
    }

    return { success: true, uri };
  } catch (error) {
    console.error('Error exporting session report PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate HTML for ballistic solution PDF
 */
function generateBallisticSolutionPDFHtml(
  solution: BallisticSolution,
  rifle: RifleProfile | null,
  ammo: AmmoProfile | null,
  distance: number,
  angularUnit: 'MIL' | 'MOA'
): string {
  const date = new Date().toLocaleString();

  const elevationValue =
    angularUnit === 'MIL' ? solution.elevationMIL.toFixed(2) : solution.elevationMOA.toFixed(2);

  const windageValue =
    angularUnit === 'MIL' ? solution.windageMIL.toFixed(2) : solution.windageMOA.toFixed(2);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Ballistic Solution</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          padding: 24px;
          background: #1a1a1a;
          color: #fff;
        }
        .header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 2px solid #333;
        }
        .title { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
        .subtitle { font-size: 14px; color: #888; }
        .section {
          background: #2a2a2a;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 16px;
        }
        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 16px;
        }
        .config-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #333;
        }
        .config-row:last-child { border-bottom: none; }
        .config-label { color: #888; }
        .config-value { font-weight: 600; }
        .corrections {
          display: flex;
          justify-content: space-around;
          text-align: center;
          padding: 24px 0;
        }
        .correction-item {
          flex: 1;
        }
        .correction-label {
          font-size: 12px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }
        .correction-value {
          font-size: 48px;
          font-weight: 700;
          color: #4A90E2;
        }
        .correction-unit {
          font-size: 16px;
          color: #888;
          margin-top: 4px;
        }
        .divider {
          width: 1px;
          background: #333;
          margin: 0 24px;
        }
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .detail-item {
          padding: 12px;
          background: #333;
          border-radius: 8px;
        }
        .detail-label {
          font-size: 12px;
          color: #888;
          margin-bottom: 4px;
        }
        .detail-value {
          font-size: 18px;
          font-weight: 600;
        }
        .footer {
          text-align: center;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #333;
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">Ballistic Solution</div>
        <div class="subtitle">Generated ${date}</div>
      </div>

      <div class="section">
        <div class="section-title">Configuration</div>
        <div class="config-row">
          <span class="config-label">Rifle</span>
          <span class="config-value">${rifle?.name || 'Unknown'}</span>
        </div>
        <div class="config-row">
          <span class="config-label">Ammunition</span>
          <span class="config-value">${ammo?.name || 'Unknown'}</span>
        </div>
        <div class="config-row">
          <span class="config-label">Distance</span>
          <span class="config-value">${distance} yards</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Required Corrections</div>
        <div class="corrections">
          <div class="correction-item">
            <div class="correction-label">Elevation</div>
            <div class="correction-value">${elevationValue}</div>
            <div class="correction-unit">${angularUnit}</div>
          </div>
          <div class="divider"></div>
          <div class="correction-item">
            <div class="correction-label">Windage</div>
            <div class="correction-value">${windageValue}</div>
            <div class="correction-unit">${angularUnit}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Ballistic Details</div>
        <div class="details-grid">
          <div class="detail-item">
            <div class="detail-label">Drop</div>
            <div class="detail-value">${solution.drop.toFixed(1)} in</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Windage Drift</div>
            <div class="detail-value">${solution.windage.toFixed(1)} in</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Time of Flight</div>
            <div class="detail-value">${solution.timeOfFlight.toFixed(2)} sec</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Velocity at Target</div>
            <div class="detail-value">${solution.velocity.toFixed(0)} fps</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Energy at Target</div>
            <div class="detail-value">${solution.energy.toFixed(0)} ft-lbs</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Max Ordinate</div>
            <div class="detail-value">${solution.maxOrdinate.toFixed(1)} in</div>
          </div>
        </div>
      </div>

      <div class="footer">
        Mobile DOPE App • Ballistic Calculator
      </div>
    </body>
    </html>
  `;
}

/**
 * Export ballistic solution results as PDF
 */
export async function exportBallisticSolutionPDF(
  solution: BallisticSolution,
  rifle: RifleProfile | null,
  ammo: AmmoProfile | null,
  distance: number,
  angularUnit: 'MIL' | 'MOA'
): Promise<ExportResult> {
  try {
    const html = generateBallisticSolutionPDFHtml(solution, rifle, ammo, distance, angularUnit);

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Export Ballistic Solution',
        UTI: 'com.adobe.pdf',
      });
    }

    return { success: true, uri };
  } catch (error) {
    console.error('Error exporting ballistic solution PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
