import { AmmoProfileRow } from '../types/database.types';

export interface AmmoProfileData {
  id?: number;
  name: string;
  manufacturer: string;
  caliber: string;
  bulletWeight: number;
  bulletType: string;
  ballisticCoefficientG1: number;
  ballisticCoefficientG7: number;
  muzzleVelocity: number;
  powderType?: string;
  powderWeight?: number;
  lotNumber?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class AmmoProfile {
  id?: number;
  name: string;
  manufacturer: string;
  caliber: string;
  bulletWeight: number;
  bulletType: string;
  ballisticCoefficientG1: number;
  ballisticCoefficientG7: number;
  muzzleVelocity: number;
  powderType?: string;
  powderWeight?: number;
  lotNumber?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;

  constructor(data: AmmoProfileData) {
    this.validate(data);

    this.id = data.id;
    this.name = data.name;
    this.manufacturer = data.manufacturer;
    this.caliber = data.caliber;
    this.bulletWeight = data.bulletWeight;
    this.bulletType = data.bulletType;
    this.ballisticCoefficientG1 = data.ballisticCoefficientG1;
    this.ballisticCoefficientG7 = data.ballisticCoefficientG7;
    this.muzzleVelocity = data.muzzleVelocity;
    this.powderType = data.powderType;
    this.powderWeight = data.powderWeight;
    this.lotNumber = data.lotNumber;
    this.notes = data.notes;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  private validate(data: AmmoProfileData): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Ammo name is required');
    }
    if (!data.manufacturer || data.manufacturer.trim().length === 0) {
      throw new Error('Manufacturer is required');
    }
    if (!data.caliber || data.caliber.trim().length === 0) {
      throw new Error('Caliber is required');
    }
    if (data.bulletWeight <= 0 || data.bulletWeight > 1000) {
      throw new Error('Bullet weight must be between 0 and 1000 grains');
    }
    if (!data.bulletType || data.bulletType.trim().length === 0) {
      throw new Error('Bullet type is required');
    }
    if (data.ballisticCoefficientG1 < 0 || data.ballisticCoefficientG1 > 1) {
      throw new Error('G1 ballistic coefficient must be between 0 and 1');
    }
    if (data.ballisticCoefficientG7 < 0 || data.ballisticCoefficientG7 > 1) {
      throw new Error('G7 ballistic coefficient must be between 0 and 1');
    }
    if (data.muzzleVelocity <= 0 || data.muzzleVelocity > 5000) {
      throw new Error('Muzzle velocity must be between 0 and 5000 fps');
    }
    if (data.powderWeight !== undefined && data.powderWeight < 0) {
      throw new Error('Powder weight cannot be negative');
    }
  }

  /**
   * Convert to database row format
   */
  toRow(): Omit<AmmoProfileRow, 'id' | 'created_at' | 'updated_at'> {
    return {
      name: this.name,
      manufacturer: this.manufacturer,
      caliber: this.caliber,
      bullet_weight: this.bulletWeight,
      bullet_type: this.bulletType,
      ballistic_coefficient_g1: this.ballisticCoefficientG1,
      ballistic_coefficient_g7: this.ballisticCoefficientG7,
      muzzle_velocity: this.muzzleVelocity,
      powder_type: this.powderType,
      powder_weight: this.powderWeight,
      lot_number: this.lotNumber,
      notes: this.notes,
    };
  }

  /**
   * Create from database row
   */
  static fromRow(row: AmmoProfileRow): AmmoProfile {
    return new AmmoProfile({
      id: row.id,
      name: row.name,
      manufacturer: row.manufacturer,
      caliber: row.caliber,
      bulletWeight: row.bullet_weight,
      bulletType: row.bullet_type,
      ballisticCoefficientG1: row.ballistic_coefficient_g1,
      ballisticCoefficientG7: row.ballistic_coefficient_g7,
      muzzleVelocity: row.muzzle_velocity,
      powderType: row.powder_type,
      powderWeight: row.powder_weight,
      lotNumber: row.lot_number,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  /**
   * Convert to JSON
   */
  toJSON(): AmmoProfileData {
    return {
      id: this.id,
      name: this.name,
      manufacturer: this.manufacturer,
      caliber: this.caliber,
      bulletWeight: this.bulletWeight,
      bulletType: this.bulletType,
      ballisticCoefficientG1: this.ballisticCoefficientG1,
      ballisticCoefficientG7: this.ballisticCoefficientG7,
      muzzleVelocity: this.muzzleVelocity,
      powderType: this.powderType,
      powderWeight: this.powderWeight,
      lotNumber: this.lotNumber,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json: AmmoProfileData): AmmoProfile {
    return new AmmoProfile(json);
  }
}
