import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';

import { ExportFolderSetting } from '../../src/components/ExportFolderSetting';
import {
  chooseExportFolder,
  clearExportFolder,
  getExportFolderUri,
  isExportFolderAvailable,
} from '../../src/services/exportFolder';
import { renderWithProviders } from '../helpers/renderWithProviders';

/**
 * Settings › Data Management › export folder (#215): Android only, and honest
 * about a folder that can no longer be reached.
 */

jest.mock('../../src/services/exportFolder', () => ({
  ...jest.requireActual('../../src/services/exportFolder'),
  chooseExportFolder: jest.fn(),
  clearExportFolder: jest.fn(async () => undefined),
  getExportFolderUri: jest.fn(),
  isExportFolderAvailable: jest.fn(() => true),
}));

const FOLDER = 'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FDOPE';
const stored = getExportFolderUri as jest.Mock;
const available = isExportFolderAvailable as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
  stored.mockResolvedValue(undefined);
  available.mockReturnValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('is not offered on iOS', () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  const { queryByTestId } = renderWithProviders(<ExportFolderSetting />);

  expect(queryByTestId('choose-export-folder')).toBeNull();
});

it('offers to choose a folder, and then names it', async () => {
  (chooseExportFolder as jest.Mock).mockResolvedValue(FOLDER);
  const { getByText, getByTestId, findByText } = renderWithProviders(<ExportFolderSetting />);

  expect(getByTestId('export-folder-status')).toHaveTextContent(/Choose a folder/);
  fireEvent.press(getByText('Choose Export Folder'));

  expect(await findByText('Change Export Folder')).toBeTruthy();
  expect(getByTestId('export-folder-status')).toHaveTextContent(
    /also saved to Download\/DOPE.*Automatic backups stay in the app's private storage/
  );
});

it('can stop saving to the folder', async () => {
  stored.mockResolvedValue(FOLDER);
  const { findByText, queryByText } = renderWithProviders(<ExportFolderSetting />);

  fireEvent.press(await findByText('Stop Saving to Folder'));

  await waitFor(() => expect(queryByText('Choose Export Folder')).toBeTruthy());
  expect(clearExportFolder).toHaveBeenCalled();
});

it('says when the chosen folder can no longer be reached', async () => {
  stored.mockResolvedValue(FOLDER);
  available.mockReturnValue(false);
  const { getByTestId, findByText } = renderWithProviders(<ExportFolderSetting />);

  await findByText('Change Export Folder');
  expect(getByTestId('export-folder-status')).toHaveTextContent(
    /Download\/DOPE can no longer be reached\. Exports open the share sheet only/
  );
});
