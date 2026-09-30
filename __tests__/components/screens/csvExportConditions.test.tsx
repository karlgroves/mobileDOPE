import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert, type AlertButton } from 'react-native';

import { DOPELog } from '../../../src/models/DOPELog';
import { EnvironmentSnapshot } from '../../../src/models/EnvironmentSnapshot';
import { DOPELogList } from '../../../src/screens/DOPELogList';
import { SettingsScreen } from '../../../src/screens/SettingsScreen';
import { environmentRepository } from '../../../src/services/database/EnvironmentRepository';
import { exportDOPELogsCSV } from '../../../src/services/ExportService';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useDOPEStore } from '../../../src/store/useDOPEStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { validDopeLog, validEnvironment } from '../../helpers/fixtures';
import { renderWithProviders } from '../../helpers/renderWithProviders';

/**
 * Both CSV exports hand the writer every environment snapshot (#138).
 *
 * The CSV's condition columns were always written empty. The writer now fills
 * them from each log's snapshot, which it can only do if the screen passes the
 * snapshots in; the environment store is no source for that, as it may hold
 * only the recent ones, or none yet.
 */

jest.mock('../../../src/services/ExportService', () => ({
  ...jest.requireActual('../../../src/services/ExportService'),
  exportDOPELogsCSV: jest.fn(async () => ({ success: true, uri: 'file:///x.csv' })),
}));

const snapshots = [new EnvironmentSnapshot({ ...validEnvironment(), id: 3 })];
const logs = [
  new DOPELog({ ...validDopeLog({ rifleId: 1, ammoId: 2, environmentId: 3 }), id: 10 }),
];

/** Opens the export alert, then presses the named choice in it. */
const choose = async (text: string) => {
  const alert = Alert.alert as jest.Mock;
  const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[];
  await buttons.find((b) => b.text === text)?.onPress?.();
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(environmentRepository, 'getAll').mockResolvedValue(snapshots);
  useDOPEStore.setState({ dopeLogs: logs, loadDopeLogs: jest.fn().mockResolvedValue(undefined) });
  useRifleStore.setState({ rifles: [] });
  useAmmoStore.setState({ ammoProfiles: [] });
});

it('DOPE Logs exports its CSV with every snapshot', async () => {
  const { getByLabelText } = renderWithProviders(
    <DOPELogList navigation={{ navigate: jest.fn() } as never} route={{} as never} />
  );

  fireEvent.press(getByLabelText('Export DOPE logs'));
  await choose('CSV (Spreadsheet)');

  await waitFor(() => expect(exportDOPELogsCSV).toHaveBeenCalledWith(logs, [], [], snapshots));
});

it('Settings exports its CSV with every snapshot', async () => {
  const { getByText } = renderWithProviders(
    <SettingsScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />
  );

  fireEvent.press(getByText('Export All Data'));
  await choose('DOPE Logs (CSV)');

  await waitFor(() => expect(exportDOPELogsCSV).toHaveBeenCalledWith(logs, [], [], snapshots));
});

it('says so, rather than exporting empty conditions, when the snapshots cannot be read', async () => {
  jest.spyOn(environmentRepository, 'getAll').mockRejectedValue(new Error('disk I/O error'));
  const { getByLabelText } = renderWithProviders(
    <DOPELogList navigation={{ navigate: jest.fn() } as never} route={{} as never} />
  );

  fireEvent.press(getByLabelText('Export DOPE logs'));
  await choose('CSV (Spreadsheet)');

  await waitFor(() =>
    expect(Alert.alert).toHaveBeenLastCalledWith('Error', expect.stringMatching(/disk I\/O/))
  );
  expect(exportDOPELogsCSV).not.toHaveBeenCalled();
});
