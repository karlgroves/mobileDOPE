import { EnvironmentSnapshotRow } from '../types/database.types';
import { coarsenLatitude } from '../utils/geoPrecision';

export interface EnvironmentSnapshotData {
  id?: number;
  temperature: number;
  humidity: number;
  pressure: number;
  altitude: number;
  densityAltitude?: number;
  windSpeed: number;
  windDirection: number;
  /** Degrees. Coarsened to one decimal place on construction -- see `geoPrecision`. */
  latitude?: number;
  timestamp?: string;
}

export class EnvironmentSnapshot {
  id?: number;
  temperature: number;
  humidity: number;
  pressure: number;
  altitude: number;
  densityAltitude: number;
  windSpeed: number;
  windDirection: number;
  /** Degrees, at one decimal place. Never full GPS precision. */
  latitude?: number;
  timestamp?: string;

  constructor(data: EnvironmentSnapshotData) {
    this.validate(data);

    this.id = data.id;
    this.temperature = data.temperature;
    this.humidity = data.humidity;
    this.pressure = data.pressure;
    this.altitude = data.altitude;
    this.densityAltitude = data.densityAltitude || this.calculateDensityAltitude(data);
    this.windSpeed = data.windSpeed;
    this.windDirection = data.windDirection;
    // Coarsened here rather than at the call site so no write path -- repository,
    // import, factory -- can persist a full-precision coordinate.
    // `== null` covers both undefined and the NULL a cleared or never-set column
    // returns. Coarsening NULL would yield 0 -- a fabricated coordinate on the
    // equator, which is worse than storing nothing.
    this.latitude = data.latitude == null ? undefined : coarsenLatitude(data.latitude);
    this.timestamp = data.timestamp;
  }

  private validate(data: EnvironmentSnapshotData): void {
    if (data.temperature < -50 || data.temperature > 150) {
      throw new Error('Temperature must be between -50 and 150 °F');
    }
    if (data.humidity < 0 || data.humidity > 100) {
      throw new Error('Humidity must be between 0 and 100%');
    }
    if (data.pressure < 20 || data.pressure > 35) {
      throw new Error('Pressure must be between 20 and 35 inHg');
    }
    if (data.altitude < -1000 || data.altitude > 30000) {
      throw new Error('Altitude must be between -1000 and 30000 feet');
    }
    if (data.windSpeed < 0 || data.windSpeed > 100) {
      throw new Error('Wind speed must be between 0 and 100 mph');
    }
    if (data.windDirection < 0 || data.windDirection >= 360) {
      throw new Error('Wind direction must be between 0 and 359 degrees');
    }
    if (data.latitude !== undefined && (data.latitude < -90 || data.latitude > 90)) {
      throw new Error('Latitude must be between -90 and 90 degrees');
    }
  }

  /**
   * Calculate density altitude
   * Formula: DA = PA + (120 * (OAT - ISA))
   * Where: PA = Pressure Altitude, OAT = Outside Air Temp, ISA = Standard Temp
   */
  private calculateDensityAltitude(data: EnvironmentSnapshotData): number {
    const standardPressure = 29.92; // inHg at sea level
    const pressureAltitude = data.altitude + 1000 * (standardPressure - data.pressure);
    const standardTemp = 59 - 0.00356 * data.altitude; // ISA temp at altitude
    const tempDifference = data.temperature - standardTemp;
    const densityAltitude = pressureAltitude + 120 * tempDifference;
    return Math.round(densityAltitude);
  }

  /**
   * Convert to database row format
   */
  toRow(): Omit<EnvironmentSnapshotRow, 'id' | 'timestamp'> {
    return {
      temperature: this.temperature,
      humidity: this.humidity,
      pressure: this.pressure,
      altitude: this.altitude,
      density_altitude: this.densityAltitude,
      wind_speed: this.windSpeed,
      wind_direction: this.windDirection,
      latitude: this.latitude,
    };
  }

  /**
   * Create from database row
   */
  static fromRow(row: EnvironmentSnapshotRow): EnvironmentSnapshot {
    return new EnvironmentSnapshot({
      id: row.id,
      temperature: row.temperature,
      humidity: row.humidity,
      pressure: row.pressure,
      altitude: row.altitude,
      densityAltitude: row.density_altitude,
      windSpeed: row.wind_speed,
      windDirection: row.wind_direction,
      latitude: row.latitude,
      timestamp: row.timestamp,
    });
  }

  /**
   * Convert to JSON
   */
  toJSON(): EnvironmentSnapshotData {
    return {
      id: this.id,
      temperature: this.temperature,
      humidity: this.humidity,
      pressure: this.pressure,
      altitude: this.altitude,
      densityAltitude: this.densityAltitude,
      windSpeed: this.windSpeed,
      windDirection: this.windDirection,
      latitude: this.latitude,
      timestamp: this.timestamp,
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json: EnvironmentSnapshotData): EnvironmentSnapshot {
    return new EnvironmentSnapshot(json);
  }
}
