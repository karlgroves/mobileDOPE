import { RifleProfileRow } from '../types/database.types';

export interface RifleProfileData {
  id?: number;
  name: string;
  caliber: string;
  barrelLength: number;
  twistRate: string;
  zeroDistance: number;
  opticManufacturer: string;
  opticModel: string;
  reticleType: string;
  clickValueType: 'MIL' | 'MOA';
  clickValue: number;
  scopeHeight: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class RifleProfile {
  id?: number;
  name: string;
  caliber: string;
  barrelLength: number;
  twistRate: string;
  zeroDistance: number;
  opticManufacturer: string;
  opticModel: string;
  reticleType: string;
  clickValueType: 'MIL' | 'MOA';
  clickValue: number;
  scopeHeight: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;

  constructor(data: RifleProfileData) {
    this.validate(data);

    this.id = data.id;
    this.name = data.name;
    this.caliber = data.caliber;
    this.barrelLength = data.barrelLength;
    this.twistRate = data.twistRate;
    this.zeroDistance = data.zeroDistance;
    this.opticManufacturer = data.opticManufacturer;
    this.opticModel = data.opticModel;
    this.reticleType = data.reticleType;
    this.clickValueType = data.clickValueType;
    this.clickValue = data.clickValue;
    this.scopeHeight = data.scopeHeight;
    this.notes = data.notes;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  private validate(data: RifleProfileData): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Rifle name is required');
    }
    if (!data.caliber || data.caliber.trim().length === 0) {
      throw new Error('Caliber is required');
    }
    if (data.barrelLength <= 0 || data.barrelLength > 50) {
      throw new Error('Barrel length must be between 0 and 50 inches');
    }
    if (!data.twistRate || !data.twistRate.match(/^1:\d+$/)) {
      throw new Error('Twist rate must be in format "1:X"');
    }
    if (data.zeroDistance <= 0 || data.zeroDistance > 1000) {
      throw new Error('Zero distance must be between 0 and 1000 yards');
    }
    if (!data.opticManufacturer || data.opticManufacturer.trim().length === 0) {
      throw new Error('Optic manufacturer is required');
    }
    if (!data.opticModel || data.opticModel.trim().length === 0) {
      throw new Error('Optic model is required');
    }
    if (!data.reticleType || data.reticleType.trim().length === 0) {
      throw new Error('Reticle type is required');
    }
    if (data.clickValueType !== 'MIL' && data.clickValueType !== 'MOA') {
      throw new Error('Click value type must be MIL or MOA');
    }
    if (data.clickValue <= 0 || data.clickValue > 1) {
      throw new Error('Click value must be between 0 and 1');
    }
    if (data.scopeHeight <= 0 || data.scopeHeight > 10) {
      throw new Error('Scope height must be between 0 and 10 inches');
    }
  }

  /**
   * Convert to database row format
   */
  toRow(): Omit<RifleProfileRow, 'id' | 'created_at' | 'updated_at'> {
    return {
      name: this.name,
      caliber: this.caliber,
      barrel_length: this.barrelLength,
      twist_rate: this.twistRate,
      zero_distance: this.zeroDistance,
      optic_manufacturer: this.opticManufacturer,
      optic_model: this.opticModel,
      reticle_type: this.reticleType,
      click_value_type: this.clickValueType,
      click_value: this.clickValue,
      scope_height: this.scopeHeight,
      notes: this.notes,
    };
  }

  /**
   * Create from database row
   */
  static fromRow(row: RifleProfileRow): RifleProfile {
    return new RifleProfile({
      id: row.id,
      name: row.name,
      caliber: row.caliber,
      barrelLength: row.barrel_length,
      twistRate: row.twist_rate,
      zeroDistance: row.zero_distance,
      opticManufacturer: row.optic_manufacturer,
      opticModel: row.optic_model,
      reticleType: row.reticle_type,
      clickValueType: row.click_value_type,
      clickValue: row.click_value,
      scopeHeight: row.scope_height,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  /**
   * Convert to JSON
   */
  toJSON(): RifleProfileData {
    return {
      id: this.id,
      name: this.name,
      caliber: this.caliber,
      barrelLength: this.barrelLength,
      twistRate: this.twistRate,
      zeroDistance: this.zeroDistance,
      opticManufacturer: this.opticManufacturer,
      opticModel: this.opticModel,
      reticleType: this.reticleType,
      clickValueType: this.clickValueType,
      clickValue: this.clickValue,
      scopeHeight: this.scopeHeight,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json: RifleProfileData): RifleProfile {
    return new RifleProfile(json);
  }
}
