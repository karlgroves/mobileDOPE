import { TargetImage, TargetImageData } from '../../models/TargetImage';
import { TargetImageRow } from '../../types/database.types';
import databaseService from './DatabaseService';

export class TargetImageRepository {
  /**
   * Create a new target image
   */
  async create(data: TargetImageData): Promise<TargetImage> {
    const targetImage = new TargetImage(data);
    const db = databaseService.getDatabase();
    const row = targetImage.toRow();

    const result = await db.runAsync(
      `INSERT INTO target_images (
        dope_log_id, range_session_id, image_uri, target_type, poi_markers, group_size
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        row.dope_log_id || null,
        row.range_session_id || null,
        row.image_uri,
        row.target_type,
        row.poi_markers,
        row.group_size || null,
      ]
    );

    targetImage.id = result.lastInsertRowId;
    return targetImage;
  }

  /**
   * Get a target image by ID
   */
  async getById(id: number): Promise<TargetImage | null> {
    const db = databaseService.getDatabase();

    const row = await db.getFirstAsync<TargetImageRow>('SELECT * FROM target_images WHERE id = ?', [
      id,
    ]);

    return row ? TargetImage.fromRow(row) : null;
  }

  /**
   * Get all target images for a specific DOPE log
   */
  async getByDopeLogId(dopeLogId: number): Promise<TargetImage[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<TargetImageRow>(
      'SELECT * FROM target_images WHERE dope_log_id = ? ORDER BY created_at DESC',
      [dopeLogId]
    );

    return rows.map((row) => TargetImage.fromRow(row));
  }

  /**
   * Get all target images for a specific range session
   */
  async getByRangeSessionId(rangeSessionId: number): Promise<TargetImage[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<TargetImageRow>(
      'SELECT * FROM target_images WHERE range_session_id = ? ORDER BY created_at DESC',
      [rangeSessionId]
    );

    return rows.map((row) => TargetImage.fromRow(row));
  }

  /**
   * Get all target images
   */
  async getAll(): Promise<TargetImage[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<TargetImageRow>(
      'SELECT * FROM target_images ORDER BY created_at DESC'
    );

    return rows.map((row) => TargetImage.fromRow(row));
  }

  /**
   * Update a target image
   */
  async update(id: number, data: Partial<TargetImageData>): Promise<TargetImage | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const updated = new TargetImage({ ...existing.toJSON(), ...data, id });
    const row = updated.toRow();
    const db = databaseService.getDatabase();

    await db.runAsync(
      `UPDATE target_images SET
        dope_log_id = ?, range_session_id = ?, image_uri = ?,
        target_type = ?, poi_markers = ?, group_size = ?
      WHERE id = ?`,
      [
        row.dope_log_id || null,
        row.range_session_id || null,
        row.image_uri,
        row.target_type,
        row.poi_markers,
        row.group_size || null,
        id,
      ]
    );

    return this.getById(id);
  }

  /**
   * Update POI markers for a target image
   */
  async updatePoiMarkers(
    id: number,
    poiMarkers: TargetImageData['poiMarkers']
  ): Promise<TargetImage | null> {
    return this.update(id, { poiMarkers });
  }

  /**
   * Update group size for a target image
   */
  async updateGroupSize(id: number, groupSize: number): Promise<TargetImage | null> {
    return this.update(id, { groupSize });
  }

  /**
   * Delete a target image
   */
  async delete(id: number): Promise<boolean> {
    const db = databaseService.getDatabase();

    const result = await db.runAsync('DELETE FROM target_images WHERE id = ?', [id]);

    return result.changes > 0;
  }

  /**
   * Delete all target images for a DOPE log
   */
  async deleteByDopeLogId(dopeLogId: number): Promise<number> {
    const db = databaseService.getDatabase();

    const result = await db.runAsync('DELETE FROM target_images WHERE dope_log_id = ?', [
      dopeLogId,
    ]);

    return result.changes;
  }

  /**
   * Delete all target images for a range session
   */
  async deleteByRangeSessionId(rangeSessionId: number): Promise<number> {
    const db = databaseService.getDatabase();

    const result = await db.runAsync('DELETE FROM target_images WHERE range_session_id = ?', [
      rangeSessionId,
    ]);

    return result.changes;
  }

  /**
   * Get count of target images
   */
  async count(): Promise<number> {
    const db = databaseService.getDatabase();

    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM target_images'
    );

    return result?.count || 0;
  }

  /**
   * Get count of target images for a DOPE log
   */
  async countByDopeLog(dopeLogId: number): Promise<number> {
    const db = databaseService.getDatabase();

    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM target_images WHERE dope_log_id = ?',
      [dopeLogId]
    );

    return result?.count || 0;
  }

  /**
   * Get target images by target type
   */
  async getByTargetType(targetType: string): Promise<TargetImage[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<TargetImageRow>(
      'SELECT * FROM target_images WHERE target_type = ? ORDER BY created_at DESC',
      [targetType]
    );

    return rows.map((row) => TargetImage.fromRow(row));
  }

  /**
   * Get target images with group size data
   */
  async getWithGroupSize(): Promise<TargetImage[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<TargetImageRow>(
      'SELECT * FROM target_images WHERE group_size IS NOT NULL ORDER BY created_at DESC'
    );

    return rows.map((row) => TargetImage.fromRow(row));
  }

  /**
   * Get average group size for a DOPE log
   */
  async getAverageGroupSizeByDopeLog(dopeLogId: number): Promise<number | null> {
    const db = databaseService.getDatabase();

    const result = await db.getFirstAsync<{ avg_size: number | null }>(
      'SELECT AVG(group_size) as avg_size FROM target_images WHERE dope_log_id = ? AND group_size IS NOT NULL',
      [dopeLogId]
    );

    return result?.avg_size || null;
  }
}

export const targetImageRepository = new TargetImageRepository();
export default targetImageRepository;
