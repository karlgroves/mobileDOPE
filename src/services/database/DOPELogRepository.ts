import { DOPELog, DOPELogData } from '../../models/DOPELog';
import { DOPELogRow } from '../../types/database.types';
import databaseService from './DatabaseService';

export class DOPELogRepository {
  /**
   * Create a new DOPE log entry
   */
  async create(data: DOPELogData): Promise<DOPELog> {
    const log = new DOPELog(data);
    const db = databaseService.getDatabase();

    const result = await db.runAsync(
      `INSERT INTO dope_logs (
        rifle_id, ammo_id, environment_id, distance, distance_unit,
        elevation_correction, windage_correction, correction_unit,
        target_type, group_size, hit_count, shot_count, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.rifleId,
        log.ammoId,
        log.environmentId,
        log.distance,
        log.distanceUnit,
        log.elevationCorrection,
        log.windageCorrection,
        log.correctionUnit,
        log.targetType,
        log.groupSize || null,
        log.hitCount || null,
        log.shotCount || null,
        log.notes || null,
      ]
    );

    log.id = result.lastInsertRowId;
    return log;
  }

  /**
   * Get a DOPE log by ID
   */
  async getById(id: number): Promise<DOPELog | null> {
    const db = databaseService.getDatabase();

    const row = await db.getFirstAsync<DOPELogRow>('SELECT * FROM dope_logs WHERE id = ?', [id]);

    return row ? DOPELog.fromRow(row) : null;
  }

  /**
   * Get all DOPE logs for a specific rifle
   */
  async getByRifleId(rifleId: number): Promise<DOPELog[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<DOPELogRow>(
      'SELECT * FROM dope_logs WHERE rifle_id = ? ORDER BY timestamp DESC',
      [rifleId]
    );

    return rows.map((row) => DOPELog.fromRow(row));
  }

  /**
   * Get all DOPE logs for a specific ammo profile
   */
  async getByAmmoId(ammoId: number): Promise<DOPELog[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<DOPELogRow>(
      'SELECT * FROM dope_logs WHERE ammo_id = ? ORDER BY timestamp DESC',
      [ammoId]
    );

    return rows.map((row) => DOPELog.fromRow(row));
  }

  /**
   * Get all DOPE logs
   */
  async getAll(limit?: number): Promise<DOPELog[]> {
    const db = databaseService.getDatabase();

    let sql = 'SELECT * FROM dope_logs ORDER BY timestamp DESC';
    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    const rows = await db.getAllAsync<DOPELogRow>(sql);

    return rows.map((row) => DOPELog.fromRow(row));
  }

  /**
   * Get DOPE logs filtered by rifle and ammo
   */
  async getByRifleAndAmmo(rifleId: number, ammoId: number): Promise<DOPELog[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<DOPELogRow>(
      `SELECT * FROM dope_logs
       WHERE rifle_id = ? AND ammo_id = ?
       ORDER BY distance ASC, timestamp DESC`,
      [rifleId, ammoId]
    );

    return rows.map((row) => DOPELog.fromRow(row));
  }

  /**
   * Get DOPE logs for specific distance range
   */
  async getByDistanceRange(
    rifleId: number,
    ammoId: number,
    minDistance: number,
    maxDistance: number
  ): Promise<DOPELog[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<DOPELogRow>(
      `SELECT * FROM dope_logs
       WHERE rifle_id = ? AND ammo_id = ?
       AND distance >= ? AND distance <= ?
       ORDER BY distance ASC, timestamp DESC`,
      [rifleId, ammoId, minDistance, maxDistance]
    );

    return rows.map((row) => DOPELog.fromRow(row));
  }

  /**
   * Update a DOPE log
   */
  async update(id: number, data: Partial<DOPELogData>): Promise<DOPELog | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const updated = new DOPELog({ ...existing.toJSON(), ...data, id });
    const db = databaseService.getDatabase();

    await db.runAsync(
      `UPDATE dope_logs SET
        rifle_id = ?, ammo_id = ?, environment_id = ?, distance = ?,
        distance_unit = ?, elevation_correction = ?, windage_correction = ?,
        correction_unit = ?, target_type = ?, group_size = ?,
        hit_count = ?, shot_count = ?, notes = ?
      WHERE id = ?`,
      [
        updated.rifleId,
        updated.ammoId,
        updated.environmentId,
        updated.distance,
        updated.distanceUnit,
        updated.elevationCorrection,
        updated.windageCorrection,
        updated.correctionUnit,
        updated.targetType,
        updated.groupSize || null,
        updated.hitCount || null,
        updated.shotCount || null,
        updated.notes || null,
        id,
      ]
    );

    return this.getById(id);
  }

  /**
   * Delete a DOPE log
   */
  async delete(id: number): Promise<boolean> {
    const db = databaseService.getDatabase();

    const result = await db.runAsync('DELETE FROM dope_logs WHERE id = ?', [id]);

    return result.changes > 0;
  }

  /**
   * Get count of DOPE logs
   */
  async count(rifleId?: number, ammoId?: number): Promise<number> {
    const db = databaseService.getDatabase();

    let sql = 'SELECT COUNT(*) as count FROM dope_logs';
    const params: number[] = [];
    const conditions: string[] = [];

    if (rifleId) {
      conditions.push('rifle_id = ?');
      params.push(rifleId);
    }

    if (ammoId) {
      conditions.push('ammo_id = ?');
      params.push(ammoId);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await db.getFirstAsync<{ count: number }>(sql, params);

    return result?.count || 0;
  }

  /**
   * Get DOPE logs grouped by distance for ballistic curve generation
   */
  async getDOPECurve(
    rifleId: number,
    ammoId: number
  ): Promise<
    {
      distance: number;
      avgElevation: number;
      avgWindage: number;
      count: number;
    }[]
  > {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<{
      distance: number;
      avgElevation: number;
      avgWindage: number;
      count: number;
    }>(
      `SELECT
        distance,
        AVG(elevation_correction) as avgElevation,
        AVG(windage_correction) as avgWindage,
        COUNT(*) as count
      FROM dope_logs
      WHERE rifle_id = ? AND ammo_id = ?
      GROUP BY distance
      ORDER BY distance ASC`,
      [rifleId, ammoId]
    );

    return rows;
  }
}

export const dopeLogRepository = new DOPELogRepository();
export default dopeLogRepository;
