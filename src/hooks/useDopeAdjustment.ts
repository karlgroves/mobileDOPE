import { useMemo } from 'react';

import { useAmmoStore } from '../store/useAmmoStore';
import { useAppStore } from '../store/useAppStore';
import { useDOPEStore } from '../store/useDOPEStore';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { useRifleStore } from '../store/useRifleStore';
import { adjustmentConfidence, applyConfidence } from '../utils/adjustmentConfidence';
import { adjustElevation } from '../utils/dopeAdjustment';
import { rankMatches } from '../utils/dopeMatching';
import { adjustByInterpolation } from '../utils/interpolatedAdjustment';
import { conditionsToMatch, matchesCaption } from '../utils/matchConditions';
import { perLogElevation } from '../utils/perLogElevation';

import { useSnapshotsFor } from './useSnapshotsFor';

import type { DOPELogData } from '../models/DOPELog';
import type { EnvironmentSnapshotData } from '../models/EnvironmentSnapshot';
import type { AdjustmentConfidence, ConfidentAdjustment } from '../utils/adjustmentConfidence';
import type { ElevationAdjustment } from '../utils/dopeAdjustment';
import type { Match, MatchableEnvironment } from '../utils/dopeMatching';
import type { InterpolatedAdjustment } from '../utils/interpolatedAdjustment';
import type { MatchConditions } from '../utils/matchConditions';

/** What to adjust, and for which rifle and load. */
export interface DopeAdjustmentRequest {
  rifleId: number;
  ammoId: number;
  /** The shot being aimed, in yards -- the solver's unit, and the matcher's. */
  distanceYards: number;
  /** The solver's own elevation for it, in `unit`. */
  solverElevation: number;
  unit: 'MIL' | 'MOA';
  /** The "Adjust by my DOPE" switch. Off returns the solver's figure. */
  enabled: boolean;
}

/** Everything a screen needs to show the adjusted figure and explain it. */
export interface DopeAdjustmentResult {
  /** The logs that resemble this shot, ranked (#70). */
  relevantDope: Match<DOPELogData & { environment?: MatchableEnvironment }>[];
  /** Which air the logs were ranked against, and where it came from (#187). */
  matchConditions: MatchConditions;
  /** #168's adjustment, before confidence. Undefined with nothing to rank. */
  dopeAdjusted?: ElevationAdjustment<DOPELogData & { environment?: MatchableEnvironment }>;
  /** #161's confidence in it. */
  confidence?: AdjustmentConfidence;
  /** The adjustment with that confidence applied. */
  confident?: ConfidentAdjustment;
  /**
   * The offset read off the curve between logged distances (#162). Set only
   * when it was applied -- i.e. when the matched adjustment was not, and the
   * interpolated one cleared the confidence threshold.
   */
  interpolated?: InterpolatedAdjustment;
  /** What was added to the solver's figure, when anything was. */
  applied?: AppliedAdjustment;
  /** The confidence behind {@link applied}, else the matched one, for the badge. */
  shownConfidence?: AdjustmentConfidence;
  /** True when the headline should show an adjusted figure rather than the solver's. */
  adjustmentApplies: boolean;
  /** The figure to put in the headline. */
  shownElevation: number;
}

/** The adjustment that reached the headline, however it was arrived at. */
export interface AppliedAdjustment {
  /** Added to the solver's figure, in the working unit. Signed. */
  offset: number;
  /** Where it came from, in the words shown under it. */
  caption: string;
  /** True when it was held past the end of the logged range (#162). */
  extrapolated: boolean;
}

/**
 * The full snapshots the solver predicts each log in: the store's recent ones,
 * with each log's own loaded over the top (#122). Full, not the reduced shape
 * the matcher scores on -- the solver reads humidity too, and
 * `MatchableEnvironment` does not carry it.
 */
const snapshotsById = (
  recent: EnvironmentSnapshotData[],
  loaded: Map<number, EnvironmentSnapshotData> | undefined
): Map<number, EnvironmentSnapshotData> =>
  new Map<number, EnvironmentSnapshotData>([
    ...recent.flatMap((snapshot) =>
      snapshot.id === undefined ? [] : [[snapshot.id, snapshot] as const]
    ),
    ...(loaded ?? []),
  ]);

/**
 * The solver's elevation, adjusted by the shooter's own relevant DOPE.
 *
 * Lifted out of `BallisticSolutionResults` unchanged so that range session mode
 * (#166) can show the same recommendation from the same code, rather than from
 * a second copy of the ranking, the per-snapshot predictions and the gate --
 * two copies being how the third one comes to disagree with the other two.
 *
 * The steps, each owned by its own module:
 *
 * 1. **Rank** the logs for this rifle and load against today's air
 *    (`rankMatches`, #70). Logs carry an `environmentId` rather than the
 *    conditions, so each candidate's own snapshot is loaded by id and joined
 *    over the store's recent ones (#122). The air to rank against is what the
 *    shooter set, else a snapshot under a day old (#187).
 * 2. **Adjust** by what those logs say the solver gets wrong, each offset
 *    measured against the solver *in that log's own air* (#168), which is why
 *    no separate density-altitude term is needed.
 * 3. **Gate** on confidence (#161), which scales the undamped offset and drops
 *    it below the threshold.
 *
 * `perLogElevation` builds one trajectory per snapshot rather than a full solve
 * per log; with at most `DEFAULT_MATCH_LIMIT` matches that is a handful of
 * solves, not the 60 that cost 660 ms on the DOPE curve (#124).
 */
export const useDopeAdjustment = ({
  rifleId,
  ammoId,
  distanceYards,
  solverElevation,
  unit,
  enabled,
}: DopeAdjustmentRequest): DopeAdjustmentResult => {
  const { getRifleById } = useRifleStore();
  const { getAmmoById } = useAmmoStore();
  const { current: currentEnv, snapshots } = useEnvironmentStore();
  const { dopeLogs } = useDOPEStore();
  /**
   * The matcher's window and the confidence gate, as the shooter set them
   * (#167). Read here rather than copied into `dopeMatching` or
   * `adjustmentConfidence`: both already take the figures as parameters, and a
   * pure module that reaches into a store stops being testable without one.
   */
  const { dopeDistanceDeltaYards, dopeConfidenceThreshold } = useAppStore(
    (state) => state.settings
  );

  const rifle = getRifleById(rifleId);
  const ammo = getAmmoById(ammoId);

  const candidateLogs = useMemo(
    () => dopeLogs.filter((log) => log.rifleId === rifleId && log.ammoId === ammoId),
    [dopeLogs, rifleId, ammoId]
  );
  const loadedSnapshots = useSnapshotsFor(candidateLogs);

  const matchConditions = useMemo(
    () => conditionsToMatch(currentEnv, snapshots),
    [currentEnv, snapshots]
  );
  const matchEnvironment = matchConditions.environment;

  const relevantDope = useMemo(() => {
    if (dopeLogs.length === 0) return [];

    const environmentById = new Map<number | undefined, MatchableEnvironment>([
      ...snapshots.map((snapshot) => [snapshot.id, snapshot] as const),
      ...(loadedSnapshots ?? []),
    ]);

    const matchable: (DOPELogData & { environment?: MatchableEnvironment })[] = dopeLogs.map(
      (log) => ({
        ...log,
        environment: environmentById.get(log.environmentId),
      })
    );

    return rankMatches(
      matchable,
      {
        rifleId,
        ammoId,
        distance: distanceYards,
        environment: matchEnvironment,
      },
      {
        delta: dopeDistanceDeltaYards,
        // Half the window the shooter actually set, not half the shipped one
        // (#167). `DEFAULT_SIGMA_YARDS` is defined as half
        // `DEFAULT_DISTANCE_DELTA` so a log at the edge of the window scores
        // exp(-2) -- a weak match rather than a direct hit. That relationship
        // is the point of the figure, and it holds at every window width only
        // if sigma moves with the window. Left fixed, widening the window to
        // 100 yards admits logs that are then scored as though the window were
        // still 50, so the setting finds more logs and ignores all of them.
        sigmaYards: dopeDistanceDeltaYards / 2,
      }
    );
  }, [
    dopeLogs,
    snapshots,
    loadedSnapshots,
    rifleId,
    ammoId,
    distanceYards,
    matchEnvironment,
    dopeDistanceDeltaYards,
  ]);

  const dopeAdjusted = useMemo(() => {
    if (!rifle || !ammo || relevantDope.length === 0) return undefined;

    const predict = perLogElevation(
      relevantDope.map(({ log }) => log),
      rifle,
      ammo,
      snapshotsById(snapshots, loadedSnapshots),
      unit
    );

    return adjustElevation(relevantDope, predict, solverElevation, unit);
  }, [relevantDope, snapshots, loadedSnapshots, rifle, ammo, solverElevation, unit]);

  // Reads `rawOffset` rather than #168's already-damped `offset`: `trust` and
  // #161's `evidence` factor measure the same thing, and applying both would
  // charge thin evidence twice. See the top of `adjustmentConfidence.ts`.
  const confidence = useMemo(
    () =>
      dopeAdjusted === undefined
        ? undefined
        : adjustmentConfidence(
            dopeAdjusted,
            distanceYards,
            unit,
            // Same reasoning as `sigmaYards` above: proximity's default is half
            // the shipped window, so it has to follow a window the shooter
            // widened or it marks down every log the wider window admitted.
            dopeDistanceDeltaYards / 2
          ),
    [dopeAdjusted, distanceYards, unit, dopeDistanceDeltaYards]
  );

  const confident = useMemo(
    () =>
      dopeAdjusted === undefined || confidence === undefined
        ? undefined
        : applyConfidence(dopeAdjusted, confidence, dopeConfidenceThreshold),
    [dopeAdjusted, confidence, dopeConfidenceThreshold]
  );

  const matchedApplies = confident !== undefined && !confident.solverOnly;

  /**
   * The fallback when nothing near this distance was usable (#162): the offset
   * interpolated across every logged distance for this rifle and load.
   *
   * Only tried when the matched adjustment was not applied. A log actually shot
   * near this distance in similar air is better evidence than a line between
   * two that were not, so interpolation never overrides a match that cleared
   * the threshold. And only *surfaced* when it clears the threshold itself:
   * below it the screen says what it said before, rather than reporting a
   * second, weaker reason for showing the solver.
   */
  const interpolated = useMemo(() => {
    // Nothing shows it while the switch is off, so nothing is solved for it.
    if (!enabled || matchedApplies || !rifle || !ammo || candidateLogs.length === 0) {
      return undefined;
    }
    // Not until every candidate's own snapshot has loaded. Before then only the
    // logs whose snapshot happens to be in the store can be predicted, so the
    // bracket could be drawn from different logs and the headline would jump
    // when the rest arrived.
    if (loadedSnapshots === undefined) return undefined;

    // Lazily, one trajectory per snapshot, and only for the snapshots of the
    // logs either side of today's distance (#124) -- see `adjustByInterpolation`.
    const predict = perLogElevation(
      candidateLogs,
      rifle,
      ammo,
      snapshotsById(snapshots, loadedSnapshots),
      unit
    );
    const result = adjustByInterpolation(
      candidateLogs,
      predict,
      distanceYards,
      solverElevation,
      unit,
      dopeConfidenceThreshold
    );
    return result === undefined || result.solverOnly ? undefined : result;
  }, [
    enabled,
    matchedApplies,
    rifle,
    ammo,
    candidateLogs,
    snapshots,
    loadedSnapshots,
    distanceYards,
    solverElevation,
    unit,
    dopeConfidenceThreshold,
  ]);

  let applied: AppliedAdjustment | undefined;
  if (enabled && matchedApplies && dopeAdjusted !== undefined) {
    applied = {
      offset: confident.offset,
      // Says what the logs were compared with, and claims a similarity only
      // when one was actually judged (#187).
      caption: matchesCaption(dopeAdjusted.contributions.length, matchConditions.source),
      extrapolated: false,
    };
  } else if (enabled && interpolated !== undefined) {
    applied = {
      offset: interpolated.offset,
      caption: interpolated.caption,
      extrapolated: interpolated.extrapolated,
    };
  }

  return {
    relevantDope,
    matchConditions,
    dopeAdjusted,
    confidence,
    confident,
    interpolated,
    applied,
    shownConfidence: interpolated?.confidence ?? confidence,
    adjustmentApplies: applied !== undefined,
    shownElevation: applied === undefined ? solverElevation : solverElevation + applied.offset,
  };
};
