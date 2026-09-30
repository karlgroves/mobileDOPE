import { useEffect, useState } from 'react';

import { dopeLogRepository } from '../services/database';
import { useDOPEStore } from '../store/useDOPEStore';

import type { DOPELog } from '../models/DOPELog';

export type DopeLogStatus = 'loading' | 'found' | 'missing';

/**
 * One DOPE log by id, whether or not the store has loaded it yet (#141).
 *
 * The navigator restores the last screens on launch, and they render before
 * DOPE Logs has finished loading the store. Reading the store alone, DOPE Log
 * Details alerted "DOPE log not found" and DOPE Log Edit built its form from
 * defaults. This takes the log from the store when it is there, and otherwise
 * reads it by id and adds it to the store. Callers wait while it is loading and
 * treat only `missing` as gone.
 *
 * What it read is also kept here, keyed by id: a filtered `loadDopeLogs(rifleId)`
 * replaces the whole store, and that must not turn a log on screen into "not
 * found".
 */
export const useDopeLog = (
  logId: number | undefined
): { log: DOPELog | undefined; status: DopeLogStatus } => {
  const fromStore = useDOPEStore((s) => (logId === undefined ? undefined : s.getDopeById(logId)));
  // null: read, and there is no such log. Keyed so a new id never shows the old log.
  const [read, setRead] = useState<{ id: number; log: DOPELog | null } | undefined>();
  const readForThisId = read && read.id === logId ? read : undefined;

  useEffect(() => {
    if (logId === undefined || fromStore || readForThisId) return;
    let current = true;
    dopeLogRepository
      .getById(logId)
      .then((log) => {
        if (log) useDOPEStore.getState().addDopeLogToStore(log);
        if (current) setRead({ id: logId, log });
      })
      .catch((error) => {
        console.error('Failed to load DOPE log', logId, error);
        if (current) setRead({ id: logId, log: null });
      });
    return () => {
      current = false;
    };
  }, [logId, fromStore, readForThisId]);

  if (logId === undefined) return { log: undefined, status: 'missing' };
  const log = fromStore ?? readForThisId?.log ?? undefined;
  if (log) return { log, status: 'found' };
  return { log: undefined, status: readForThisId ? 'missing' : 'loading' };
};
