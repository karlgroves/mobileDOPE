import { useMemo } from 'react';

import { useAmmoStore } from '../store/useAmmoStore';
import { useAppStore } from '../store/useAppStore';
import { useDOPEStore } from '../store/useDOPEStore';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { useRifleStore } from '../store/useRifleStore';
import { logDistanceInYards } from '../utils/distanceUnits';
import { rankMatches } from '../utils/dopeMatching';
import { conditionsToMatch } from '../utils/matchConditions';
import { predictWindagePerMph } from '../utils/solverInputs';
import { adjustWindage } from '../utils/windageAdjustment';
import { calculateCrosswindComponent } from '../utils/windTable';

import { useSnapshotsFor } from './useSnapshotsFor';

import type { DOPELogData } from '../models/DOPELog';
import type { EnvironmentSnapshotData } from '../models/EnvironmentSnapshot';
import type { MatchableEnvironment } from '../utils/dopeMatching';

/** Which rifle and load, and the distances a table has rows for. */
export interface WindageOffsetsRequest {
  rifleId: number;
  ammoId: number;
  /** Distances in yards, in the solver's unit. */
  distances: readonly number[];
  unit: 'MIL' | 'MOA';
}

/** What the shooter's logs say the solver gets wrong, per distance. */
export interface WindageOffsets {
  /**
   * Damped offset per mph of crosswind, keyed by distance in yards.
   *
   * Absent for a distance with nothing usable to rank, so the caller shows the
   * solver's own figure there rather than an adjusted-looking one.
   */
  offsetPerMph: Map<number, number>;
  /** How many logs contributed, keyed by distance. */
  logsAt: Map<number, number>;
  /** True until every candidate log's own snapshot has been read back. */
  loading: boolean;
  /** True when at least one distance has an offset to apply. */
  anyOffset: boolean;
}

/** A crosswind of 1 mph, so `adjustWindage`'s offset comes out per mph. */
const UNIT_CROSSWIND = 1;

/**
 * The windage offset per mph of crosswind, at each distance in a wind table
 * (#163).
 *
 * The calculator needs one offset, for the one shot in front of the shooter.
 * A wind table needs one per row, because the offset is not distance-invariant:
 * a scope that tracks 2% slow, or a BC that is slightly optimistic, is wrong by
 * more at 900 yards than at 200.
 *
 * ## Why ten rankings are affordable
 *
 * The expensive part is the solver, and it runs **once per log**, not once per
 * row: each log's windage-per-mph is computed at its own distance and cached,
 * then reused by every row's ranking. `rankMatches` and `adjustWindage` are pure
 * arithmetic over a handful of logs, so the ten rows cost ten passes over the
 * same cached numbers. Doing it the other way round -- a solve per row per log
 * -- is #124's 660 ms again.
 *
 * The per-mph figure is legitimate because the solver's windage is linear in
 * crosswind; `solverInputs.test.ts` asserts that across 1-20 mph.
 */
export const useWindageOffsets = ({
  rifleId,
  ammoId,
  distances,
  unit,
}: WindageOffsetsRequest): WindageOffsets => {
  const { getRifleById } = useRifleStore();
  const { getAmmoById } = useAmmoStore();
  const { current: currentEnv, snapshots } = useEnvironmentStore();
  const { dopeLogs } = useDOPEStore();
  const dopeDistanceDeltaYards = useAppStore((state) => state.settings.dopeDistanceDeltaYards);

  const rifle = getRifleById(rifleId);
  const ammo = getAmmoById(ammoId);

  const candidateLogs = useMemo(
    () => dopeLogs.filter((log) => log.rifleId === rifleId && log.ammoId === ammoId),
    [dopeLogs, rifleId, ammoId]
  );
  const loadedSnapshots = useSnapshotsFor(candidateLogs);

  const matchEnvironment = useMemo(
    () => conditionsToMatch(currentEnv, snapshots).environment,
    [currentEnv, snapshots]
  );

  const key = useMemo(() => distances.join(','), [distances]);

  const result = useMemo<Omit<WindageOffsets, 'loading'>>(() => {
    const offsetPerMph = new Map<number, number>();
    const logsAt = new Map<number, number>();
    const empty = { offsetPerMph, logsAt, anyOffset: false };

    if (!rifle || !ammo || candidateLogs.length === 0) return empty;
    // Predicting a log in the standard atmosphere because its own air has not
    // arrived would read a hot day as a windage error.
    if (loadedSnapshots === undefined) return empty;

    const environmentById = new Map<number, EnvironmentSnapshotData>([
      ...snapshots.flatMap((snapshot) =>
        snapshot.id === undefined ? [] : [[snapshot.id, snapshot] as const]
      ),
      ...loadedSnapshots,
    ]);

    // One solve per log, at that log's own distance, cached across every row.
    // Keyed by id, so a log without one is solved each time rather than sharing
    // another unsaved log's cached figure.
    const perMphCache = new Map<number, number | undefined>();
    const perMphFor = (log: DOPELogData, yards: number): number | undefined => {
      if (log.id !== undefined && perMphCache.has(log.id)) return perMphCache.get(log.id);
      const env = environmentById.get(log.environmentId);
      const value =
        env === undefined ? undefined : predictWindagePerMph(rifle, ammo, yards, env, unit);
      if (log.id !== undefined) perMphCache.set(log.id, value);
      return value;
    };

    const crosswindFor = (log: DOPELogData): number | undefined => {
      const env = environmentById.get(log.environmentId);
      return env === undefined
        ? undefined
        : calculateCrosswindComponent(env.windSpeed, env.windDirection);
    };

    const matchable: (DOPELogData & { environment?: MatchableEnvironment })[] = candidateLogs.map(
      (log) => ({ ...log, environment: environmentById.get(log.environmentId) })
    );

    for (const yards of distances) {
      // The shooter's matching window, with sigma following it, exactly as
      // `useDopeAdjustment` ranks (#167). Left at the shipped window, the table
      // would disagree with the calculator about which logs count.
      const matches = rankMatches(
        matchable,
        {
          rifleId,
          ammoId,
          distance: yards,
          environment: matchEnvironment,
        },
        { delta: dopeDistanceDeltaYards, sigmaYards: dopeDistanceDeltaYards / 2 }
      );
      if (matches.length === 0) continue;

      // A unit crosswind and a zero solver figure, so `offset` comes back as the
      // damped per-mph offset and nothing here re-implements the damping.
      const adjustment = adjustWindage(
        matches,
        (log) => perMphFor(log, logDistanceInYards(log)),
        crosswindFor,
        UNIT_CROSSWIND,
        0,
        unit
      );
      if (adjustment.reason !== undefined) continue;

      offsetPerMph.set(yards, adjustment.offset);
      logsAt.set(yards, adjustment.contributions.length);
    }

    return { offsetPerMph, logsAt, anyOffset: offsetPerMph.size > 0 };
    // `key` stands in for `distances`, whose identity changes on every render
    // when the caller passes a literal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rifle,
    ammo,
    candidateLogs,
    loadedSnapshots,
    snapshots,
    matchEnvironment,
    rifleId,
    ammoId,
    key,
    unit,
    dopeDistanceDeltaYards,
  ]);

  return { ...result, loading: candidateLogs.length > 0 && loadedSnapshots === undefined };
};
