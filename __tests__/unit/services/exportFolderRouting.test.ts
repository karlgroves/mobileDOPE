import * as Sharing from 'expo-sharing';

import { deliverExport } from '../../../src/services/exportFolder';
import {
  exportDOPELogsPDF,
  exportFullBackup,
  saveAutomaticBackup,
  shareLatestAutomaticBackup,
} from '../../../src/services/ExportService';
import { resetFileSystem } from '../../helpers/mockFileSystem';

/**
 * Which files may reach the Android export folder (#215). By the owner's
 * decision of 2026-11-07, only manual exports do: an automatic backup stays in
 * the app's private storage, and Share Latest Backup only shares it, as
 * PRIVACY.md promises.
 */

jest.mock('expo-file-system', () => require('../../helpers/mockFileSystem'));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(async () => ({ uri: 'file:///test-cache/Print/7f3a.pdf' })),
}));
jest.mock('../../../src/services/exportFolder', () => ({
  deliverExport: jest.fn(async () => 'saved'),
}));

const deliver = deliverExport as jest.Mock;

beforeEach(() => {
  resetFileSystem();
  jest.clearAllMocks();
});

it('sends a manual full backup through the export folder', async () => {
  const result = await exportFullBackup([], [], [], []);

  expect(deliver).toHaveBeenCalledWith(
    result.uri,
    expect.objectContaining({ mimeType: 'application/json', dialogTitle: 'Export Full Backup' })
  );
});

it('names a PDF copy after what it holds, not the random print file name', async () => {
  await exportDOPELogsPDF([], [], []);

  expect(deliver).toHaveBeenCalledWith(
    'file:///test-cache/Print/7f3a.pdf',
    expect.objectContaining({ mimeType: 'application/pdf' }),
    expect.stringMatching(/^dope_logs_\d+\.pdf$/)
  );
});

it('never sends an automatic backup to the export folder', async () => {
  await saveAutomaticBackup([], [], [], [], new Date(Date.UTC(2026, 10, 1)));
  const shared = await shareLatestAutomaticBackup();

  expect(shared.success).toBe(true);
  expect(deliver).not.toHaveBeenCalled();
  expect(Sharing.shareAsync).toHaveBeenCalledWith(
    shared.uri,
    expect.objectContaining({ dialogTitle: 'Export Full Backup' })
  );
});
