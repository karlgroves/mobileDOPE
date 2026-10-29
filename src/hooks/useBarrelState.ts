import { useMemo } from 'react';

import { useAmmoStore } from '../store/useAmmoStore';
import { useDOPEStore } from '../store/useDOPEStore';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { useRifleStore } from '../store/useRifleStore';
import {
  analyseBarrelState,
  describeColdBoreShift,
  describeHeatShift,
  predictHeatShift,
} from '../utils/barrelStateAnalysis';
import { logDistanceInYards } from '../utils/distanceUnits';
import { elevationIn } from '../utils/dopeAdjustment';
import { perLogElevation } from '../utils/perLogElevation';

import { useSnapshotsFor } from './useSnapshotsFor';

import type { DOPELogData } from '../models/DOPELog';
import type { EnvironmentSnapshotData } from '../models/EnvironmentSnapshot';
import type { BarrelStateAnalysis, BarrelStateSample } from '../utils/barrelStateAnalysis';

/** Which rifle and load to analyse, and the shot about to be taken. */
export interface BarrelStateRequest {
  rifleId: number;
  ammoId: number;
  /** 1-based position of the next shot, for the heat-shift prediction. */
  shotNumber: number;
  unit: 'MIL' | 'MOA';
}

/** The barrel-state figures, and the words for them. */
export interface BarrelStateResult {
  /** Both halves, each `undefined` below its own minimum. */
  analysis: BarrelStateAnalysis;
  /** "Expected cold-bore shift: 0.15 MIL low", when there is enough data. */
  coldBoreCaption?: string;
  /** "Barrel heating: ...", when the slope is significant. */
  heatShiftCaption?: string;
  /**
   * What applying the cold-bore bias would add to the dialled figure. Signed,
   * in `unit`. Undefined when there is no bias to apply.
   *
   * A positive bias means cold shots landed low, so the correction *adds*
   * elevation -- the same sign as the bias itself.
   */
  coldBoreCorrection?: number;
  /** What applying the heat shift would add at `shotNumber`. */
  heatShiftCorrection?: number;
  /** True until every candidate log's own snapshot has been read back. */
  loading: boolean;
}

/**
 * A log contributes to barrel-state analysis only if it recorded barrel state.
 *
 * `coldBoreBias` reads the cold set from `coldBoreShot === true` and the warm
 * set from a shot *position* of 2-5; `heatShift` reads positioned shots. A log
 * with neither an explicit cold-bore flag nor a shot number is therefore in
 * none of those sets, and filtering it out changes no result.
 *
 * It changes the cost, which is why it is here: `perLogElevation` builds one
 * trajectory per distinct snapshot, and running it over a whole history to
 * answer a question only the post-migration-007 logs can speak to is #124's
 * 660 ms by another road. Barrel state was recorded from #176 onwards, so in
 * practice this is a handful of logs.
 */
const recordsBarrelState = (log: DOPELogData): boolean =>
  log.coldBoreShot === true || log.shotNumberInSession !== undefined;

/**
 * Cold-bore bias and heat shift for a rifle and load, from the shooter's logs
 * (#165).
 *
 * Every figure is derived from each log's **offset against the solver in that
 * log's own conditions** (#168), never from the raw dialled elevation --
 * `analyseBarrelState`'s own docblock explains why, and it is the reason shots
 * taken at 300 and 900 yards can be averaged together at all.
 *
 * The analysis itself lives in `src/utils/barrelStateAnalysis.ts` and is pure;
 * this is the part that knows about stores, snapshots and the solver. #183
 * merged the pure half with no caller at all, which is what this closes.
 */
export const useBarrelState = ({
  rifleId,
  ammoId,
  shotNumber,
  unit,
}: BarrelStateRequest): BarrelStateResult => {
  const { getRifleById } = useRifleStore();
  const { getAmmoById } = useAmmoStore();
  const { snapshots } = useEnvironmentStore();
  const { dopeLogs } = useDOPEStore();

  const rifle = getRifleById(rifleId);
  const ammo = getAmmoById(ammoId);

  const candidateLogs = useMemo(
    () =>
      dopeLogs.filter(
        (log) => log.rifleId === rifleId && log.ammoId === ammoId && recordsBarrelState(log)
      ),
    [dopeLogs, rifleId, ammoId]
  );

  const loadedSnapshots = useSnapshotsFor(candidateLogs);

  const analysis = useMemo<BarrelStateAnalysis>(() => {
    const nothing: BarrelStateAnalysis = { coldBore: undefined, heatShift: undefined };
    if (!rifle || !ammo || candidateLogs.length === 0) return nothing;
    // Not until every candidate's snapshot has loaded: predicting a log in the
    // standard atmosphere because its own air has not arrived yet would read a
    // cold or high day as a cold-bore bias.
    if (loadedSnapshots === undefined) return nothing;

    const environmentById = new Map<number, EnvironmentSnapshotData>([
      ...snapshots.flatMap((snapshot) =>
        snapshot.id === undefined ? [] : [[snapshot.id, snapshot] as const]
      ),
      ...loadedSnapshots,
    ]);

    const predict = perLogElevation(candidateLogs, rifle, ammo, environmentById, unit);

    const samples: BarrelStateSample[] = [];
    for (const log of candidateLogs) {
      const predicted = predict(log, logDistanceInYards(log));
      // A log whose conditions are missing has an unknowable offset, not a zero
      // one. Dropped rather than counted as agreeing with the solver.
      if (predicted === undefined || !Number.isFinite(predicted)) continue;
      samples.push({
        offset: elevationIn(log, unit) - predicted,
        coldBoreShot: log.coldBoreShot,
        shotNumberInSession: log.shotNumberInSession,
      });
    }

    return analyseBarrelState(samples);
  }, [rifle, ammo, candidateLogs, loadedSnapshots, snapshots, unit]);

  const heatShiftCaption =
    analysis.heatShift === undefined
      ? undefined
      : describeHeatShift(analysis.heatShift, shotNumber, unit);

  return {
    analysis,
    coldBoreCaption:
      analysis.coldBore === undefined ? undefined : describeColdBoreShift(analysis.coldBore, unit),
    heatShiftCaption,
    coldBoreCorrection: analysis.coldBore?.bias,
    // Only offered when the slope was worth mentioning: a correction the
    // shooter was never told about is not a correction they chose.
    heatShiftCorrection:
      analysis.heatShift === undefined || heatShiftCaption === undefined
        ? undefined
        : predictHeatShift(analysis.heatShift, shotNumber),
    loading: candidateLogs.length > 0 && loadedSnapshots === undefined,
  };
};
