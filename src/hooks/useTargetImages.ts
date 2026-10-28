import { useEffect, useState } from 'react';

import { targetImageRepository } from '../services/database';

import type { TargetImage } from '../models/TargetImage';

/**
 * The targets marked for a DOPE log, newest first (#63).
 *
 * Read straight from the repository: targets are only ever shown for one log at
 * a time, so there is no list worth holding in a store. `reloadKey` is bumped by
 * the caller to read again -- DOPE Log Details does it each time it comes back
 * into view, so a target saved on the marking screen is there on return.
 *
 * A failed read shows no target rather than taking the log down with it.
 */
export const useTargetImages = (logId: number, reloadKey: number): TargetImage[] => {
  const [targets, setTargets] = useState<{ id: number; list: TargetImage[] }>();

  useEffect(() => {
    let current = true;
    targetImageRepository
      .getByDopeLogId(logId)
      .then((list) => {
        if (current) setTargets({ id: logId, list });
      })
      .catch((error) => {
        console.error('Failed to load targets for log', logId, error);
        if (current) setTargets({ id: logId, list: [] });
      });
    return () => {
      current = false;
    };
  }, [logId, reloadKey]);

  // Keyed by log, so a new id never shows the previous log's target.
  return targets?.id === logId ? targets.list : [];
};
