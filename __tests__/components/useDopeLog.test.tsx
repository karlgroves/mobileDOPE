import { renderHook, waitFor } from '@testing-library/react-native';

import { useDopeLog } from '../../src/hooks/useDopeLog';
import { DOPELog } from '../../src/models/DOPELog';
import { dopeLogRepository } from '../../src/services/database';
import { useDOPEStore } from '../../src/store/useDOPEStore';
import { validDopeLog } from '../helpers/fixtures';

/**
 * One DOPE log by id, whether or not the store has loaded it (#141).
 *
 * The navigator restores the last screens on launch, and they render before
 * DOPE Logs has finished loading the store. DOPE Log Details then alerted
 * "DOPE log not found" (seen on the iOS Simulator), and DOPE Log Edit started
 * its form from defaults and would have saved them over the real log.
 */

const log = (id: number, over: Partial<ReturnType<typeof validDopeLog>> = {}) =>
  new DOPELog({ ...validDopeLog({ rifleId: 1, ammoId: 1, environmentId: 1 }, over), id });

describe('useDopeLog', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    useDOPEStore.setState({ dopeLogs: [] });
  });

  it('uses the store when the log is already there, without a database read', () => {
    useDOPEStore.setState({ dopeLogs: [log(7)] });
    const read = jest.spyOn(dopeLogRepository, 'getById');

    const { result } = renderHook(() => useDopeLog(7));

    expect(result.current.status).toBe('found');
    expect(result.current.log?.id).toBe(7);
    expect(read).not.toHaveBeenCalled();
  });

  it('loads a log the store does not have yet, and adds it to the store', async () => {
    jest.spyOn(dopeLogRepository, 'getById').mockResolvedValue(log(7, { distance: 700 }));

    const { result } = renderHook(() => useDopeLog(7));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.log?.distance).toBe(700);
    expect(useDOPEStore.getState().getDopeById(7)?.distance).toBe(700);
  });

  it('reports a log that does not exist as missing', async () => {
    jest.spyOn(dopeLogRepository, 'getById').mockResolvedValue(null);

    const { result } = renderHook(() => useDopeLog(99));

    await waitFor(() => expect(result.current.status).toBe('missing'));
    expect(result.current.log).toBeUndefined();
  });

  it('reports a failed read as missing rather than loading forever', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(dopeLogRepository, 'getById').mockRejectedValue(new Error('disk'));

    const { result } = renderHook(() => useDopeLog(7));

    await waitFor(() => expect(result.current.status).toBe('missing'));
    error.mockRestore();
  });

  it('keeps a loaded log when a filtered load later replaces the store without it', async () => {
    // loadDopeLogs(rifleId) swaps the whole store for one rifle's logs. That
    // must not turn a log on screen into "not found".
    jest.spyOn(dopeLogRepository, 'getById').mockResolvedValue(log(7));
    const { result } = renderHook(() => useDopeLog(7));
    await waitFor(() => expect(result.current.status).toBe('found'));

    useDOPEStore.setState({ dopeLogs: [log(8)] });

    await waitFor(() => expect(useDOPEStore.getState().getDopeById(7)).toBeUndefined());
    expect(result.current.status).toBe('found');
    expect(result.current.log?.id).toBe(7);
  });

  it('loads the new log when the id changes', async () => {
    jest
      .spyOn(dopeLogRepository, 'getById')
      .mockImplementation(async (id) => log(id, { distance: id * 100 }));
    const { result, rerender } = renderHook(({ id }: { id: number }) => useDopeLog(id), {
      initialProps: { id: 3 },
    });
    await waitFor(() => expect(result.current.log?.distance).toBe(300));

    useDOPEStore.setState({ dopeLogs: [] });
    rerender({ id: 6 });

    expect(result.current.log?.id).not.toBe(3);
    await waitFor(() => expect(result.current.log?.distance).toBe(600));
  });

  it('has nothing to load without an id', () => {
    const read = jest.spyOn(dopeLogRepository, 'getById');

    const { result } = renderHook(() => useDopeLog(undefined));

    expect(result.current.status).toBe('missing');
    expect(read).not.toHaveBeenCalled();
  });
});
