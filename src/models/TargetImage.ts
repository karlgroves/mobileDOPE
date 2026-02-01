import { TargetImageRow } from '../types/database.types';

export interface POIMarker {
  x: number;
  y: number;
  shotNumber?: number;
}

export interface TargetImageData {
  id?: number;
  dopeLogId?: number;
  rangeSessionId?: number;
  imageUri: string;
  targetType: string;
  poiMarkers: POIMarker[];
  groupSize?: number; // inches
  createdAt?: string;
}

export class TargetImage {
  id?: number;
  dopeLogId?: number;
  rangeSessionId?: number;
  imageUri: string;
  targetType: string;
  poiMarkers: POIMarker[];
  groupSize?: number;
  createdAt?: string;

  constructor(data: TargetImageData) {
    this.validate(data);

    this.id = data.id;
    this.dopeLogId = data.dopeLogId;
    this.rangeSessionId = data.rangeSessionId;
    this.imageUri = data.imageUri;
    this.targetType = data.targetType;
    this.poiMarkers = data.poiMarkers;
    this.groupSize = data.groupSize;
    this.createdAt = data.createdAt;
  }

  private validate(data: TargetImageData): void {
    if (!data.imageUri || data.imageUri.trim().length === 0) {
      throw new Error('Image URI is required');
    }
    if (!data.targetType || data.targetType.trim().length === 0) {
      throw new Error('Target type is required');
    }
    if (!data.dopeLogId && !data.rangeSessionId) {
      throw new Error('Either DOPE Log ID or Range Session ID is required');
    }
    if (data.groupSize !== undefined && data.groupSize < 0) {
      throw new Error('Group size cannot be negative');
    }
    if (!Array.isArray(data.poiMarkers)) {
      throw new Error('POI markers must be an array');
    }
    for (const marker of data.poiMarkers) {
      if (marker.x === undefined || marker.y === undefined) {
        throw new Error('POI marker must have x and y coordinates');
      }
    }
  }

  /**
   * Convert to database row format
   */
  toRow(): Omit<TargetImageRow, 'id' | 'created_at'> {
    return {
      dope_log_id: this.dopeLogId,
      range_session_id: this.rangeSessionId,
      image_uri: this.imageUri,
      target_type: this.targetType,
      poi_markers: JSON.stringify(this.poiMarkers),
      group_size: this.groupSize,
    };
  }

  /**
   * Create from database row
   */
  static fromRow(row: TargetImageRow): TargetImage {
    return new TargetImage({
      id: row.id,
      dopeLogId: row.dope_log_id,
      rangeSessionId: row.range_session_id,
      imageUri: row.image_uri,
      targetType: row.target_type,
      poiMarkers: JSON.parse(row.poi_markers),
      groupSize: row.group_size,
      createdAt: row.created_at,
    });
  }

  /**
   * Convert to JSON
   */
  toJSON(): TargetImageData {
    return {
      id: this.id,
      dopeLogId: this.dopeLogId,
      rangeSessionId: this.rangeSessionId,
      imageUri: this.imageUri,
      targetType: this.targetType,
      poiMarkers: this.poiMarkers,
      groupSize: this.groupSize,
      createdAt: this.createdAt,
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json: TargetImageData): TargetImage {
    return new TargetImage(json);
  }
}
