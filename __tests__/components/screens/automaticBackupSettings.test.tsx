import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { SettingsScreen } from '../../../src/screens/SettingsScreen';
import {
  deleteAutomaticBackups,
  shareLatestAutomaticBackup,
} from '../../../src/services/ExportService';
import { useAppStore } from '../../../src/store/useAppStore';
import { formatDateTime } from '../../../src/utils/formatting';
import { renderWithProviders } from '../../helpers/renderWithProviders';

import type { BackupSchedule } from '../../../src/utils/backupSchedule';

/**
 * The Automatic Backup card in Settings (#66): choose the schedule, see when
 * the last one ran, and share the newest file through the usual share sheet.
 */

jest.mock('../../../src/services/ExportService', () => ({
  ...jest.requireActual('../../../src/services/ExportService'),
  shareLatestAutomaticBackup: jest.fn(),
  deleteAutomaticBackups: jest.fn(),
}));

const share = shareLatestAutomaticBackup as jest.Mock;
const deleteAll = deleteAutomaticBackups as jest.Mock;

type AlertButton = { text: string; onPress?: () => Promise<void> | void };
/** Press the named button of the most recent Alert.alert call. */
const pressAlertButton = async (text: string) => {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const buttons = calls[calls.length - 1][2] as AlertButton[];
  await buttons.find((b) => b.text === text)?.onPress?.();
};

const settle = (backupSchedule: BackupSchedule, lastAutomaticBackupAt?: string) =>
  useAppStore.setState((s) => ({
    settings: { ...s.settings, backupSchedule, lastAutomaticBackupAt },
    updateSettings: async (patch) =>
      useAppStore.setState((t) => ({ settings: { ...t.settings, ...patch } })),
  }));

const renderSettings = () =>
  renderWithProviders(
    <SettingsScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

it('says no automatic backup has run, and offers nothing to share, by default', () => {
  settle('manual');
  const { getByText, getByLabelText } = renderSettings();

  expect(getByText('No automatic backup yet')).toBeTruthy();
  expect(getByLabelText('Share latest automatic backup')).toBeDisabled();
});

it('saves the schedule the shooter picks', async () => {
  settle('manual');
  const { getByText } = renderSettings();

  fireEvent.press(getByText('Weekly'));

  await waitFor(() => expect(useAppStore.getState().settings.backupSchedule).toBe('weekly'));
});

it('shows when the last automatic backup ran', () => {
  const at = '2026-10-20T08:15:00.000Z';
  settle('daily', at);
  const { getByText } = renderSettings();

  expect(getByText(`Last automatic backup: ${formatDateTime(new Date(at))}`)).toBeTruthy();
});

it('shares the newest backup', async () => {
  share.mockResolvedValue({ success: true, uri: 'file:///backups/x.json' });
  settle('daily', new Date().toISOString());
  const { getByLabelText } = renderSettings();

  fireEvent.press(getByLabelText('Share latest automatic backup'));

  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('says why when the newest backup cannot be shared', async () => {
  share.mockResolvedValue({ success: false, error: 'No automatic backup has been saved yet.' });
  settle('daily', new Date().toISOString());
  const { getByLabelText } = renderSettings();

  fireEvent.press(getByLabelText('Share latest automatic backup'));

  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'No automatic backup has been saved yet.')
  );
});

it('mentions the return-to-foreground trigger, not only start-up', () => {
  settle('manual');
  const { getByText } = renderSettings();

  expect(getByText(/when the app opens or comes back to the foreground/)).toBeTruthy();
});

it('deletes automatic backups only after confirmation, and clears the last-run time', async () => {
  deleteAll.mockReturnValue(3);
  settle('daily', new Date().toISOString());
  const { getByText } = renderSettings();

  fireEvent.press(getByText('Delete Automatic Backups'));
  expect(deleteAll).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith(
    'Delete Automatic Backups',
    expect.stringContaining('cannot be undone'),
    expect.any(Array)
  );

  await pressAlertButton('Delete');

  expect(deleteAll).toHaveBeenCalledTimes(1);
  expect(useAppStore.getState().settings.lastAutomaticBackupAt).toBeUndefined();
  expect(Alert.alert).toHaveBeenLastCalledWith(
    'Automatic Backups Deleted',
    'Deleted 3 automatic backups.'
  );
});

it('says a schedule that is still on will save a new backup, and is silent on Manual', () => {
  settle('weekly', new Date().toISOString());
  const { getByText, unmount } = renderSettings();
  fireEvent.press(getByText('Delete Automatic Backups'));
  expect((Alert.alert as jest.Mock).mock.calls.at(-1)?.[1]).toMatch(/Your schedule stays on/);
  unmount();

  settle('manual', new Date().toISOString());
  const manual = renderSettings();
  fireEvent.press(manual.getByText('Delete Automatic Backups'));
  expect((Alert.alert as jest.Mock).mock.calls.at(-1)?.[1]).not.toMatch(/schedule stays on/);
});

it('deletes nothing when the confirmation is cancelled', async () => {
  settle('daily', new Date().toISOString());
  const { getByText } = renderSettings();

  fireEvent.press(getByText('Delete Automatic Backups'));
  await pressAlertButton('Cancel');

  expect(deleteAll).not.toHaveBeenCalled();
});
