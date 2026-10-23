import { DOPELogRow } from '../types/database.types';

import { orUndefined } from './orUndefined';

export interface DOPELogData {
  id?: number;
  rifleId: number;
  ammoId: number;
  environmentId: number;
  distance: number;
  distanceUnit: 'yards' | 'meters';
  elevationCorrection: number;
  windageCorrection: number;
  correctionUnit: 'MIL' | 'MOA';
  targetType: 'steel' | 'paper' | 'vital_zone' | 'other';
  groupSize?: number;
  hitCount?: number;
  shotCount?: number;
  /**
   * Barrel state (#164). `undefined` means not recorded -- true of every log
   * written before migration 007, and of any the user left unanswered. `false`
   * is an observed warm bore, which #165 treats quite differently.
   */
  coldBoreShot?: boolean;
  /** 1-based position in the day's string; set automatically in range session mode. */
  shotNumberInSession?: number;
  notes?: string;
  timestamp?: string;
}

export class DOPELog {
  id?: number;
  rifleId: number;
  ammoId: number;
  environmentId: number;
  distance: number;
  distanceUnit: 'yards' | 'meters';
  elevationCorrection: number;
  windageCorrection: number;
  correctionUnit: 'MIL' | 'MOA';
  targetType: 'steel' | 'paper' | 'vital_zone' | 'other';
  groupSize?: number;
  hitCount?: number;
  shotCount?: number;
  /**
   * Barrel state (#164). `undefined` means not recorded -- true of every log
   * written before migration 007, and of any the user left unanswered. `false`
   * is an observed warm bore, which #165 treats quite differently.
   */
  coldBoreShot?: boolean;
  /** 1-based position in the day's string; set automatically in range session mode. */
  shotNumberInSession?: number;
  notes?: string;
  timestamp?: string;

  constructor(data: DOPELogData) {
    this.validate(data);

    this.id = data.id;
    this.rifleId = data.rifleId;
    this.ammoId = data.ammoId;
    this.environmentId = data.environmentId;
    this.distance = data.distance;
    this.distanceUnit = data.distanceUnit;
    this.elevationCorrection = data.elevationCorrection;
    this.windageCorrection = data.windageCorrection;
    this.correctionUnit = data.correctionUnit;
    this.targetType = data.targetType;
    this.groupSize = data.groupSize;
    this.hitCount = data.hitCount;
    this.shotCount = data.shotCount;
    this.coldBoreShot = data.coldBoreShot;
    this.shotNumberInSession = data.shotNumberInSession;
    this.notes = data.notes;
    this.timestamp = data.timestamp;
  }

  private validate(data: DOPELogData): void {
    if (!data.rifleId || data.rifleId <= 0) {
      throw new Error('Valid rifle ID is required');
    }
    if (!data.ammoId || data.ammoId <= 0) {
      throw new Error('Valid ammo ID is required');
    }
    if (!data.environmentId || data.environmentId <= 0) {
      throw new Error('Valid environment ID is required');
    }
    if (data.distance <= 0 || data.distance > 3000) {
      throw new Error('Distance must be between 0 and 3000');
    }
    if (data.distanceUnit !== 'yards' && data.distanceUnit !== 'meters') {
      throw new Error('Distance unit must be yards or meters');
    }
    if (data.correctionUnit !== 'MIL' && data.correctionUnit !== 'MOA') {
      throw new Error('Correction unit must be MIL or MOA');
    }
    const validTargetTypes = ['steel', 'paper', 'vital_zone', 'other'];
    if (!validTargetTypes.includes(data.targetType)) {
      throw new Error('Invalid target type');
    }
    if (data.groupSize !== undefined && data.groupSize < 0) {
      throw new Error('Group size cannot be negative');
    }
    if (data.hitCount !== undefined && data.hitCount < 0) {
      throw new Error('Hit count cannot be negative');
    }
    if (data.shotCount !== undefined && data.shotCount < 0) {
      throw new Error('Shot count cannot be negative');
    }
    if (
      data.hitCount !== undefined &&
      data.shotCount !== undefined &&
      data.hitCount > data.shotCount
    ) {
      throw new Error('Hit count cannot exceed shot count');
    }
    // 1-based whole numbers. Shot 0 does not exist, and a 0 arriving from an
    // import is far more likely to be a default someone wrote than a shot
    // anyone fired. One check rather than two: `validate` is already at the
    // top of this file's complexity budget.
    if (
      data.shotNumberInSession !== undefined &&
      (!Number.isInteger(data.shotNumberInSession) || data.shotNumberInSession < 1)
    ) {
      throw new Error('Shot number in session must be a whole number of 1 or greater');
    }
  }

  /**
   * Convert to database row format
   */
  toRow(): Omit<DOPELogRow, 'id' | 'timestamp'> {
    return {
      rifle_id: this.rifleId,
      ammo_id: this.ammoId,
      environment_id: this.environmentId,
      distance: this.distance,
      distance_unit: this.distanceUnit,
      elevation_correction: this.elevationCorrection,
      windage_correction: this.windageCorrection,
      correction_unit: this.correctionUnit,
      target_type: this.targetType,
      group_size: this.groupSize,
      hit_count: this.hitCount,
      shot_count: this.shotCount,
      // SQLite has no boolean; `undefined` stays undefined so the column keeps
      // its NULL rather than becoming a recorded 0.
      cold_bore_shot: this.coldBoreShot === undefined ? undefined : this.coldBoreShot ? 1 : 0,
      shot_number_in_session: this.shotNumberInSession,
      notes: this.notes,
    };
  }

  /**
   * Create from database row
   */
  static fromRow(row: DOPELogRow): DOPELog {
    return new DOPELog({
      id: row.id,
      rifleId: row.rifle_id,
      ammoId: row.ammo_id,
      environmentId: row.environment_id,
      distance: row.distance,
      distanceUnit: row.distance_unit,
      elevationCorrection: row.elevation_correction,
      windageCorrection: row.windage_correction,
      correctionUnit: row.correction_unit,
      targetType: row.target_type,
      groupSize: orUndefined(row.group_size),
      hitCount: orUndefined(row.hit_count),
      shotCount: orUndefined(row.shot_count),
      coldBoreShot: row.cold_bore_shot == null ? undefined : row.cold_bore_shot === 1,
      shotNumberInSession: orUndefined(row.shot_number_in_session),
      notes: orUndefined(row.notes),
      timestamp: row.timestamp,
    });
  }

  /**
   * Convert to JSON
   */
  toJSON(): DOPELogData {
    return {
      id: this.id,
      rifleId: this.rifleId,
      ammoId: this.ammoId,
      environmentId: this.environmentId,
      distance: this.distance,
      distanceUnit: this.distanceUnit,
      elevationCorrection: this.elevationCorrection,
      windageCorrection: this.windageCorrection,
      correctionUnit: this.correctionUnit,
      targetType: this.targetType,
      groupSize: this.groupSize,
      hitCount: this.hitCount,
      shotCount: this.shotCount,
      coldBoreShot: this.coldBoreShot,
      shotNumberInSession: this.shotNumberInSession,
      notes: this.notes,
      timestamp: this.timestamp,
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json: DOPELogData): DOPELog {
    return new DOPELog(json);
  }
}
