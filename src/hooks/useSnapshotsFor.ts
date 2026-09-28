import { useEffect, useMemo, useState } from 'react';

import { environmentRepository } from '../services/database';

import type { DOPELogData } from '../models/DOPELog';
import type { EnvironmentSnapshotData } from '../models/EnvironmentSnapshot';

/**
 * The environment snapshot each log was shot in, keyed by id.
 *
 * The environment store holds only recent snapshots -- the Dashboard loads
 * one -- so a log's conditions are fetched here rather than looked up there.
 * Without them every log would be predicted in the standard atmosphere, and a
 * cold or high day would read as a muzzle-velocity error. Used by the DOPE
 * curve's suggestions (#64) and the relevant-DOPE ranking (#122).
 */
export const useSnapshotsFor = (
  logs: DOPELogData[]
): Map<number, EnvironmentSnapshotData> | undefined => {
  // Undefined until loaded: before then every log would look unconditioned.
  const [byId, setById] = useState<Map<number, EnvironmentSnapshotData>>();
  const ids = useMemo(
    () => [...new Set(logs.map((log) => log.environmentId))].sort((a, b) => a - b),
    [logs]
  );
  useEffect(() => {
    let cancelled = false;
    setById(undefined);
    Promise.all(ids.map((id) => environmentRepository.getById(id)))
      .then((snapshots) => {
        if (cancelled) return;
        const loaded = new Map<number, EnvironmentSnapshotData>();
        snapshots.forEach((snapshot) => {
          if (snapshot?.id !== undefined) loaded.set(snapshot.id, snapshot);
        });
        setById(loaded);
      })
      .catch((error) => {
        // Nothing loaded: the card reports every log as unconditioned rather
        // than guessing at a standard day.
        console.error('Failed to load environment snapshots:', error);
        if (!cancelled) setById(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);
  return byId;
};
