import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { useAutomaticBackup } from '../../src/hooks/useAutomaticBackup';
import { runAutomaticBackup } from '../../src/services/AutomaticBackupService';
import { useAppStore } from '../../src/store/useAppStore';

import type { BackupSchedule } from '../../src/utils/backupSchedule';

/**
 * When an automatic backup runs (#66).
 *
 * With no background-task module, the triggers are the app becoming ready and
 * the app returning to the foreground. Whether one is actually due is the
 * pure rule in `utils/backupSchedule`; these pin that the hook asks it at the
 * right moments, records the time only on success, and never runs two at once.
 */

jest.mock('../../src/services/AutomaticBackupService', () => ({
  runAutomaticBackup: jest.fn(),
}));

const run = runAutomaticBackup as jest.Mock;
let onAppStateChange: ((state: AppStateStatus) => void) | undefined;
const remove = jest.fn();

const settle = (schedule: BackupSchedule, lastAutomaticBackupAt?: string) =>
  useAppStore.setState((s) => ({
    settings: { ...s.settings, backupSchedule: schedule, lastAutomaticBackupAt },
    updateSettings: async (patch) =>
      useAppStore.setState((t) => ({ settings: { ...t.settings, ...patch } })),
  }));

const foreground = () => act(() => onAppStateChange?.('active'));

beforeEach(() => {
  jest.clearAllMocks();
  run.mockResolvedValue({ success: true, uri: 'file:///backups/x.json' });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    onAppStateChange = handler as (state: AppStateStatus) => void;
    return { remove } as never;
  });
});

it('writes one as soon as the app is ready if one is due, and records when', async () => {
  settle('daily');

  renderHook(() => useAutomaticBackup(true));

  await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(useAppStore.getState().settings.lastAutomaticBackupAt).toBeDefined());
  const recorded = Date.parse(useAppStore.getState().settings.lastAutomaticBackupAt as string);
  expect(Math.abs(recorded - Date.now())).toBeLessThan(5_000);
});

it('waits for the database before doing anything', () => {
  settle('daily');

  renderHook(() => useAutomaticBackup(false));

  expect(run).not.toHaveBeenCalled();
  expect(AppState.addEventListener).not.toHaveBeenCalled();
});

it('does nothing on the manual schedule', async () => {
  settle('manual');

  renderHook(() => useAutomaticBackup(true));
  foreground();

  await act(async () => {});
  expect(run).not.toHaveBeenCalled();
});

it('does not write again until the interval has passed', async () => {
  settle('weekly', new Date(Date.now() - 86_400_000).toISOString());

  renderHook(() => useAutomaticBackup(true));
  foreground();

  await act(async () => {});
  expect(run).not.toHaveBeenCalled();
});

it('checks again whenever the app returns to the foreground', async () => {
  settle('daily', new Date().toISOString());
  renderHook(() => useAutomaticBackup(true));
  await act(async () => {});
  expect(run).not.toHaveBeenCalled();

  // A day later, the phone comes out of the pocket.
  settle('daily', new Date(Date.now() - 25 * 3_600_000).toISOString());
  foreground();

  await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
});

it('ignores going to the background', async () => {
  settle('daily', new Date().toISOString());
  renderHook(() => useAutomaticBackup(true));
  settle('daily');

  act(() => onAppStateChange?.('background'));

  await act(async () => {});
  expect(run).not.toHaveBeenCalled();
});

it('runs straight away when the shooter switches from manual to a schedule', async () => {
  settle('manual');
  renderHook(() => useAutomaticBackup(true));
  await act(async () => {});

  act(() => settle('weekly'));

  await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
});

it('never runs two at once', async () => {
  let finish: (value: unknown) => void = () => {};
  run.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
  settle('daily');

  renderHook(() => useAutomaticBackup(true));
  foreground();
  foreground();

  expect(run).toHaveBeenCalledTimes(1);
  await act(async () => finish({ success: true, uri: 'file:///x.json' }));
});

it('leaves the time unrecorded on failure, so the next foreground retries', async () => {
  run.mockResolvedValue({ success: false, error: 'disk full' });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  settle('daily');

  renderHook(() => useAutomaticBackup(true));

  await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  await act(async () => {});
  expect(useAppStore.getState().settings.lastAutomaticBackupAt).toBeUndefined();

  foreground();
  await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
});

it('logs, rather than leaving unhandled, a failure to record the time', async () => {
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  settle('daily');
  useAppStore.setState({
    updateSettings: async () => {
      throw new Error('storage full');
    },
  });

  renderHook(() => useAutomaticBackup(true));

  await waitFor(() =>
    expect(errors).toHaveBeenCalledWith(
      'Failed to record automatic backup time:',
      expect.objectContaining({ message: 'storage full' })
    )
  );

  // Not left marked as running: the next foreground tries again.
  foreground();
  await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
});

it('stops listening when unmounted', () => {
  settle('manual');
  const { unmount } = renderHook(() => useAutomaticBackup(true));

  unmount();

  expect(remove).toHaveBeenCalled();
});
