import { ShotStringRow } from '../types/database.types';

export interface ShotStringData {
  id?: number;
  ammoId: number;
  sessionDate: string;
  shotNumber: number;
  velocity: number; // fps
  temperature: number; // Fahrenheit
  notes?: string;
  createdAt?: string;
}

export class ShotString {
  id?: number;
  ammoId: number;
  sessionDate: string;
  shotNumber: number;
  velocity: number;
  temperature: number;
  notes?: string;
  createdAt?: string;

  constructor(data: ShotStringData) {
    this.validate(data);

    this.id = data.id;
    this.ammoId = data.ammoId;
    this.sessionDate = data.sessionDate;
    this.shotNumber = data.shotNumber;
    this.velocity = data.velocity;
    this.temperature = data.temperature;
    this.notes = data.notes;
    this.createdAt = data.createdAt;
  }

  private validate(data: ShotStringData): void {
    if (data.ammoId === undefined || data.ammoId === null) {
      throw new Error('Ammo ID is required');
    }
    if (data.ammoId <= 0) {
      throw new Error('Ammo ID must be a positive number');
    }
    if (!data.sessionDate || data.sessionDate.trim().length === 0) {
      throw new Error('Session date is required');
    }
    if (data.shotNumber <= 0) {
      throw new Error('Shot number must be a positive integer');
    }
    if (data.velocity <= 0 || data.velocity > 5000) {
      throw new Error('Velocity must be between 0 and 5000 fps');
    }
    if (data.temperature < -60 || data.temperature > 140) {
      throw new Error('Temperature must be between -60 and 140 Fahrenheit');
    }
  }

  /**
   * Convert to database row format
   */
  toRow(): Omit<ShotStringRow, 'id' | 'created_at'> {
    return {
      ammo_id: this.ammoId,
      session_date: this.sessionDate,
      shot_number: this.shotNumber,
      velocity: this.velocity,
      temperature: this.temperature,
      notes: this.notes,
    };
  }

  /**
   * Create from database row
   */
  static fromRow(row: ShotStringRow): ShotString {
    return new ShotString({
      id: row.id,
      ammoId: row.ammo_id,
      sessionDate: row.session_date,
      shotNumber: row.shot_number,
      velocity: row.velocity,
      temperature: row.temperature,
      notes: row.notes,
      createdAt: row.created_at,
    });
  }

  /**
   * Convert to JSON
   */
  toJSON(): ShotStringData {
    return {
      id: this.id,
      ammoId: this.ammoId,
      sessionDate: this.sessionDate,
      shotNumber: this.shotNumber,
      velocity: this.velocity,
      temperature: this.temperature,
      notes: this.notes,
      createdAt: this.createdAt,
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json: ShotStringData): ShotString {
    return new ShotString(json);
  }
}
