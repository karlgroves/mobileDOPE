/**
 * Muzzle-velocity and ballistic-coefficient suggestions for one rifle and load,
 * from its logged DOPE (#64).
 *
 * Joins each log to its environment snapshot, predicts it with the solver under
 * those conditions, and hands the per-distance differences to the suggestion
 * functions in `dopeAnalysis`. Kept separate from that module so it can stay
 * free of the ballistics engine.
 */

import { logDistanceInYards } from './distanceUnits';
import {
  compareLogsToSolver,
  suggestBallisticCoefficient,
  suggestMuzzleVelocity,
} from './dopeAnalysis';
import { elevationTable } from './solverInputs';

import type { DropComparison, InputCorrection } from './dopeAnalysis';
import type { AmmoProfileData } from '../models/AmmoProfile';
import type { DOPELogData } from '../models/DOPELog';
import type { EnvironmentSnapshotData } from '../models/EnvironmentSnapshot';
import type { RifleProfileData } from '../models/RifleProfile';

/** Fewest distinct distances `suggestMuzzleVelocity` will work from. */
export const MIN_DISTANCES_FOR_VELOCITY = 3;
/** Fewest distinct distances, and their span, for `suggestBallisticCoefficient`. */
export const MIN_DISTANCES_FOR_BC = 4;
export const MIN_SPAN_YARDS_FOR_BC = 300;

/** What one load's logged DOPE says about its muzzle velocity and BC. */
export interface InputCorrections {
  /**
   * - `insufficient`: too few distances to say anything
   * - `agrees`: enough data, and it matches the solver closely enough to leave alone
   * - `suggests`: at least one input change is supported
   */
  status: 'insufficient' | 'agrees' | 'suggests';
  comparisons: DropComparison[];
  distanceCount: number;
  spanYards: number;
  /**
   * Logs left out because their environment snapshot is missing. Predicting
   * them in a standard atmosphere would read an unusual day as an input error,
   * so they are counted and reported instead of guessed at.
   */
  withoutConditions: number;
  muzzleVelocity?: InputCorrection;
  /** The coefficient for the drag model the solver is using for this load. */
  ballisticCoefficient?: InputCorrection & { dragModel: 'G1' | 'G7' };
}

export const inputCorrectionsFor = ({
  logs,
  rifle,
  ammo,
  environmentById,
  unit,
}: {
  logs: DOPELogData[];
  rifle: RifleProfileData;
  ammo: AmmoProfileData;
  environmentById: Map<number, EnvironmentSnapshotData>;
  unit: 'MIL' | 'MOA';
}): InputCorrections => {
  const withConditions = logs.filter((log) => environmentById.has(log.environmentId));
  const withoutConditions = logs.length - withConditions.length;

  // One trajectory per snapshot, out to the furthest log shot in it, rather
  // than a full solve per log.
  const furthest = new Map<number, number>();
  for (const log of withConditions) {
    const yards = Math.round(logDistanceInYards(log));
    furthest.set(log.environmentId, Math.max(furthest.get(log.environmentId) ?? 0, yards));
  }
  const tables = new Map(
    [...furthest].map(([id, maxYards]) => [
      id,
      elevationTable(rifle, ammo, environmentById.get(id), maxYards, unit),
    ])
  );

  const comparisons = compareLogsToSolver(
    withConditions,
    (log, yards) => tables.get(log.environmentId)?.(yards),
    unit
  );
  const distances = comparisons.map((c) => c.distance);
  const distanceCount = distances.length;
  const spanYards = distanceCount ? Math.max(...distances) - Math.min(...distances) : 0;

  if (distanceCount < MIN_DISTANCES_FOR_VELOCITY) {
    return { status: 'insufficient', comparisons, distanceCount, spanYards, withoutConditions };
  }

  const muzzleVelocity = suggestMuzzleVelocity(comparisons, ammo.muzzleVelocity, unit);
  const dragModel: 'G1' | 'G7' = ammo.ballisticCoefficientG7 ? 'G7' : 'G1';
  const bc = suggestBallisticCoefficient(
    comparisons,
    dragModel === 'G7' ? ammo.ballisticCoefficientG7 : ammo.ballisticCoefficientG1
  );
  const ballisticCoefficient = bc ? { ...bc, dragModel } : undefined;

  return {
    status: muzzleVelocity || ballisticCoefficient ? 'suggests' : 'agrees',
    comparisons,
    distanceCount,
    spanYards,
    withoutConditions,
    muzzleVelocity,
    ballisticCoefficient,
  };
};
