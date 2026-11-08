import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import {
  chooseExportFolder,
  clearExportFolder,
  deliverExport,
  exportFolderLabel,
  getExportFolderUri,
  isExportFolderAvailable,
} from '../../../src/services/exportFolder';

/**
 * The Android export folder (#215): a manual export also saves a copy to a
 * folder the user picked through the Storage Access Framework, then the share
 * sheet opens as before. A folder that can no longer be written to is skipped,
 * leaving the export in app storage and the share sheet -- never a failed
 * export. (iOS never stores a folder; ExportFolderSetting is Android-only.)
 */

const FOLDER = 'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FDOPE';
const SOURCE = 'file:///data/user/0/app/files/dope_logs_1.csv';
const SHARE = {
  mimeType: 'text/csv',
  dialogTitle: 'Export DOPE Logs',
  UTI: 'public.comma-separated-values-text',
};

const BYTES = new Uint8Array([1, 2, 3]);
const created: { name: string; mimeType: string; bytes?: Uint8Array }[] = [];
const folderState = { exists: true, createThrows: false };

jest.mock('expo-file-system', () => ({
  Directory: class {
    static pickDirectoryAsync = jest.fn();
    constructor(readonly uri: string) {}
    get exists() {
      return folderState.exists;
    }
    createFile(name: string, mimeType: string) {
      if (folderState.createThrows) throw new Error('no write grant');
      const entry: { name: string; mimeType: string; bytes?: Uint8Array } = { name, mimeType };
      created.push(entry);
      return {
        write: (bytes: Uint8Array) => {
          entry.bytes = bytes;
        },
      };
    }
  },
  File: class {
    constructor(readonly uri: string) {}
    bytes = async () => BYTES;
  },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

const pick = Directory.pickDirectoryAsync as jest.Mock;

beforeEach(async () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  created.length = 0;
  folderState.exists = true;
  folderState.createThrows = false;
  await AsyncStorage.clear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('with a folder chosen', () => {
  beforeEach(async () => {
    pick.mockResolvedValue({ uri: FOLDER });
    await chooseExportFolder();
  });

  it('saves a copy to the folder, then still opens the share sheet', async () => {
    const result = await deliverExport(SOURCE, SHARE);

    expect(result).toBe('saved');
    expect(created).toEqual([{ name: 'dope_logs_1.csv', mimeType: 'text/csv', bytes: BYTES }]);
    expect(Sharing.shareAsync).toHaveBeenCalledWith(SOURCE, SHARE);
  });

  it('uses the given name for the copy, for print output with a random name', async () => {
    await deliverExport('file:///cache/Print/7f3a.pdf', SHARE, 'dope_logs_2.pdf');

    expect(created[0].name).toBe('dope_logs_2.pdf');
  });

  it('falls back to the share sheet alone when the folder is gone', async () => {
    folderState.exists = false;

    expect(await deliverExport(SOURCE, SHARE)).toBe('unavailable');
    expect(created).toEqual([]);
    expect(Sharing.shareAsync).toHaveBeenCalledWith(SOURCE, SHARE);
    expect(isExportFolderAvailable(FOLDER)).toBe(false);
  });

  it('falls back to the share sheet alone when the folder refuses the write', async () => {
    folderState.createThrows = true;

    expect(await deliverExport(SOURCE, SHARE)).toBe('unavailable');
    expect(Sharing.shareAsync).toHaveBeenCalledWith(SOURCE, SHARE);
  });

  it('stops copying once the folder is cleared', async () => {
    await clearExportFolder();

    expect(await getExportFolderUri()).toBeUndefined();
    expect(await deliverExport(SOURCE, SHARE)).toBe('none');
    expect(created).toEqual([]);
  });
});

it('copies nothing until a folder is chosen', async () => {
  expect(await deliverExport(SOURCE, SHARE)).toBe('none');
  expect(created).toEqual([]);
  expect(Sharing.shareAsync).toHaveBeenCalledWith(SOURCE, SHARE);
});

it('keeps the earlier folder when the picker is dismissed', async () => {
  pick.mockResolvedValueOnce({ uri: FOLDER });
  await chooseExportFolder();
  pick.mockRejectedValueOnce(new Error('cancelled'));

  expect(await chooseExportFolder()).toBeUndefined();
  expect(await getExportFolderUri()).toBe(FOLDER);
});

it('does not open a share sheet that is not available, but still saves the copy', async () => {
  pick.mockResolvedValue({ uri: FOLDER });
  await chooseExportFolder();
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);

  expect(await deliverExport(SOURCE, SHARE)).toBe('saved');
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});

describe('exportFolderLabel', () => {
  it('shows the path within the storage volume', () => {
    expect(exportFolderLabel(FOLDER)).toBe('Download/DOPE');
  });

  it('shows the volume when the whole volume was chosen', () => {
    expect(exportFolderLabel('content://x/tree/primary%3A')).toBe('primary:');
  });
});
