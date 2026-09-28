import { renderHook, waitFor } from '@testing-library/react-native';

import { useSnapshotsFor } from '../../src/hooks/useSnapshotsFor';
import { environmentRepository } from '../../src/services/database';
import { validDopeLog } from '../helpers/fixtures';

import type { DOPELogData } from '../../src/models/DOPELog';

/**
 * Loading the snapshots a set of logs was shot in (#122, #124).
 */

const logFor = (environmentId: number, id: number) =>
  validDopeLog({ rifleId: 1, ammoId: 1, environmentId }, { id });

describe('useSnapshotsFor', () => {
  beforeEach(() => {
    jest
      .spyOn(environmentRepository, 'getById')
      .mockImplementation(async (id) => ({ id }) as never);
  });

  it('does not reload when the logs change but the snapshots they need do not', async () => {
    // Saving a new log from the solution screen hands the hook a new array.
    // Reloading then would drop the ranking back to store-only data meanwhile.
    const { result, rerender } = renderHook(
      ({ logs }: { logs: DOPELogData[] }) => useSnapshotsFor(logs),
      {
        initialProps: { logs: [logFor(1, 1), logFor(2, 2)] },
      }
    );
    await waitFor(() => expect(result.current?.size).toBe(2));
    const calls = (environmentRepository.getById as jest.Mock).mock.calls.length;

    rerender({ logs: [logFor(1, 1), logFor(2, 2), logFor(2, 3)] });

    expect(result.current?.size).toBe(2);
    expect((environmentRepository.getById as jest.Mock).mock.calls.length).toBe(calls);
  });

  it('loads a snapshot a new log needs', async () => {
    const { result, rerender } = renderHook(
      ({ logs }: { logs: DOPELogData[] }) => useSnapshotsFor(logs),
      {
        initialProps: { logs: [logFor(1, 1)] },
      }
    );
    await waitFor(() => expect(result.current?.size).toBe(1));

    rerender({ logs: [logFor(1, 1), logFor(7, 2)] });

    await waitFor(() => expect(result.current?.has(7)).toBe(true));
  });
});
