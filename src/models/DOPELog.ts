import { DOPELogRow } from '../types/database.types';

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
      groupSize: row.group_size,
      hitCount: row.hit_count,
      shotCount: row.shot_count,
      notes: row.notes,
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
