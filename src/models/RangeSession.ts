import { RangeSessionRow } from '../types/database.types';

export interface RangeSessionData {
  id?: number;
  rifleId: number;
  ammoId: number;
  environmentId: number;
  sessionName?: string;
  startTime: string;
  endTime?: string;
  distance: number; // yards
  shotCount: number;
  coldBoreShot: boolean;
  notes?: string;
  createdAt?: string;
}

export class RangeSession {
  id?: number;
  rifleId: number;
  ammoId: number;
  environmentId: number;
  sessionName?: string;
  startTime: string;
  endTime?: string;
  distance: number;
  shotCount: number;
  coldBoreShot: boolean;
  notes?: string;
  createdAt?: string;

  constructor(data: RangeSessionData) {
    this.validate(data);

    this.id = data.id;
    this.rifleId = data.rifleId;
    this.ammoId = data.ammoId;
    this.environmentId = data.environmentId;
    this.sessionName = data.sessionName;
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    this.distance = data.distance;
    this.shotCount = data.shotCount;
    this.coldBoreShot = data.coldBoreShot;
    this.notes = data.notes;
    this.createdAt = data.createdAt;
  }

  private validate(data: RangeSessionData): void {
    if (data.rifleId === undefined || data.rifleId === null) {
      throw new Error('Rifle ID is required');
    }
    if (data.rifleId <= 0) {
      throw new Error('Rifle ID must be a positive number');
    }
    if (data.ammoId === undefined || data.ammoId === null) {
      throw new Error('Ammo ID is required');
    }
    if (data.ammoId <= 0) {
      throw new Error('Ammo ID must be a positive number');
    }
    if (data.environmentId === undefined || data.environmentId === null) {
      throw new Error('Environment ID is required');
    }
    if (data.environmentId <= 0) {
      throw new Error('Environment ID must be a positive number');
    }
    if (!data.startTime || data.startTime.trim().length === 0) {
      throw new Error('Start time is required');
    }
    if (data.distance <= 0 || data.distance > 5000) {
      throw new Error('Distance must be between 0 and 5000 yards');
    }
    if (data.shotCount < 0) {
      throw new Error('Shot count cannot be negative');
    }
  }

  /**
   * Convert to database row format
   */
  toRow(): Omit<RangeSessionRow, 'id' | 'created_at'> {
    return {
      rifle_id: this.rifleId,
      ammo_id: this.ammoId,
      environment_id: this.environmentId,
      session_name: this.sessionName,
      start_time: this.startTime,
      end_time: this.endTime,
      distance: this.distance,
      shot_count: this.shotCount,
      cold_bore_shot: this.coldBoreShot,
      notes: this.notes,
    };
  }

  /**
   * Create from database row
   */
  static fromRow(row: RangeSessionRow): RangeSession {
    return new RangeSession({
      id: row.id,
      rifleId: row.rifle_id,
      ammoId: row.ammo_id,
      environmentId: row.environment_id,
      sessionName: row.session_name,
      startTime: row.start_time,
      endTime: row.end_time,
      distance: row.distance,
      shotCount: row.shot_count,
      coldBoreShot: row.cold_bore_shot,
      notes: row.notes,
      createdAt: row.created_at,
    });
  }

  /**
   * Convert to JSON
   */
  toJSON(): RangeSessionData {
    return {
      id: this.id,
      rifleId: this.rifleId,
      ammoId: this.ammoId,
      environmentId: this.environmentId,
      sessionName: this.sessionName,
      startTime: this.startTime,
      endTime: this.endTime,
      distance: this.distance,
      shotCount: this.shotCount,
      coldBoreShot: this.coldBoreShot,
      notes: this.notes,
      createdAt: this.createdAt,
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json: RangeSessionData): RangeSession {
    return new RangeSession(json);
  }
}
