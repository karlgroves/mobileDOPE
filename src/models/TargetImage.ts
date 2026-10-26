import { TargetImageRow } from '../types/database.types';

import { orUndefined } from './orUndefined';

/**
 * A marked point of impact. On a target marked in the app, `x` and `y` are
 * fractions of the image's width and height (0-1), not screen points -- see
 * `src/utils/targetMarking.ts`.
 */
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
  /** The target's real width in inches: the scale the marks are measured at (#63). */
  targetWidthInches?: number;
  /** The image's height divided by its width. */
  aspectRatio?: number;
  createdAt?: string;
}

const positiveOrAbsent = (value: number | undefined): boolean =>
  value === undefined || (Number.isFinite(value) && value > 0);

export class TargetImage {
  id?: number;
  dopeLogId?: number;
  rangeSessionId?: number;
  imageUri: string;
  targetType: string;
  poiMarkers: POIMarker[];
  groupSize?: number;
  targetWidthInches?: number;
  aspectRatio?: number;
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
    this.targetWidthInches = data.targetWidthInches;
    this.aspectRatio = data.aspectRatio;
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
    // A zero, negative or infinite scale would turn every mark into a nonsense
    // number of inches; absent is allowed, and means "not measured" (#63).
    if (!positiveOrAbsent(data.targetWidthInches)) {
      throw new Error('Target width must be a positive number of inches');
    }
    if (!positiveOrAbsent(data.aspectRatio)) {
      throw new Error('Aspect ratio must be a positive number');
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
      target_width_inches: this.targetWidthInches,
      aspect_ratio: this.aspectRatio,
    };
  }

  /**
   * Create from database row
   */
  static fromRow(row: TargetImageRow): TargetImage {
    return new TargetImage({
      id: row.id,
      dopeLogId: orUndefined(row.dope_log_id),
      rangeSessionId: orUndefined(row.range_session_id),
      imageUri: row.image_uri,
      targetType: row.target_type,
      poiMarkers: JSON.parse(row.poi_markers) as POIMarker[],
      groupSize: orUndefined(row.group_size),
      targetWidthInches: orUndefined(row.target_width_inches),
      aspectRatio: orUndefined(row.aspect_ratio),
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
      targetWidthInches: this.targetWidthInches,
      aspectRatio: this.aspectRatio,
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
