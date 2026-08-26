import { EnvironmentSnapshot, EnvironmentSnapshotData } from '../../models/EnvironmentSnapshot';
import { EnvironmentSnapshotRow } from '../../types/database.types';

import databaseService from './DatabaseService';

export class EnvironmentRepository {
  /**
   * Create a new environment snapshot
   */
  async create(data: EnvironmentSnapshotData): Promise<EnvironmentSnapshot> {
    const snapshot = new EnvironmentSnapshot(data);
    const db = databaseService.getDatabase();

    const result = await db.runAsync(
      // See DOPELogRepository.create: COALESCE preserves a supplied capture time while
      // keeping the schema default for ordinary creates. Without this, a restored backup
      // stamped every snapshot with the import time, losing when the reading was taken.
      `INSERT INTO environment_snapshots (
        temperature, humidity, pressure, altitude, density_altitude,
        wind_speed, wind_direction, latitude, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`,
      [
        snapshot.temperature,
        snapshot.humidity,
        snapshot.pressure,
        snapshot.altitude,
        snapshot.densityAltitude,
        snapshot.windSpeed,
        snapshot.windDirection,
        snapshot.latitude ?? null,
        snapshot.timestamp ?? null,
      ]
    );

    snapshot.id = result.lastInsertRowId;
    return snapshot;
  }

  /**
   * Get an environment snapshot by ID
   */
  async getById(id: number): Promise<EnvironmentSnapshot | null> {
    const db = databaseService.getDatabase();

    const row = await db.getFirstAsync<EnvironmentSnapshotRow>(
      'SELECT * FROM environment_snapshots WHERE id = ?',
      [id]
    );

    return row ? EnvironmentSnapshot.fromRow(row) : null;
  }

  /**
   * Get all environment snapshots
   */
  async getAll(limit?: number): Promise<EnvironmentSnapshot[]> {
    const db = databaseService.getDatabase();

    let sql = 'SELECT * FROM environment_snapshots ORDER BY timestamp DESC';
    const params: any[] = [];
    if (limit) {
      sql += ' LIMIT ?';
      params.push(Math.max(1, Math.floor(Number(limit))));
    }

    const rows = await db.getAllAsync<EnvironmentSnapshotRow>(sql, params);

    return rows.map((row) => EnvironmentSnapshot.fromRow(row));
  }

  /**
   * Get recent environment snapshots
   */
  async getRecent(count: number = 10): Promise<EnvironmentSnapshot[]> {
    return this.getAll(count);
  }

  /**
   * Update an environment snapshot
   */
  async update(
    id: number,
    data: Partial<EnvironmentSnapshotData>
  ): Promise<EnvironmentSnapshot | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const updated = new EnvironmentSnapshot({ ...existing.toJSON(), ...data, id });
    const db = databaseService.getDatabase();

    await db.runAsync(
      `UPDATE environment_snapshots SET
        temperature = ?, humidity = ?, pressure = ?, altitude = ?,
        density_altitude = ?, wind_speed = ?, wind_direction = ?,
        latitude = ?
      WHERE id = ?`,
      [
        updated.temperature,
        updated.humidity,
        updated.pressure,
        updated.altitude,
        updated.densityAltitude,
        updated.windSpeed,
        updated.windDirection,
        updated.latitude ?? null,
        id,
      ]
    );

    return this.getById(id);
  }

  /**
   * Delete an environment snapshot
   */
  async delete(id: number): Promise<boolean> {
    const db = databaseService.getDatabase();

    const result = await db.runAsync('DELETE FROM environment_snapshots WHERE id = ?', [id]);

    return result.changes > 0;
  }

  /**
   * Delete old environment snapshots (cleanup utility)
   */
  async deleteOlderThan(days: number): Promise<number> {
    const db = databaseService.getDatabase();

    // Compute the cutoff date in JS to avoid string interpolation in SQL
    const cutoff = new Date(
      Date.now() - Math.max(1, Math.floor(Number(days))) * 86400000
    ).toISOString();

    const result = await db.runAsync(
      `DELETE FROM environment_snapshots
       WHERE timestamp < ?
       AND id NOT IN (
         SELECT DISTINCT environment_id FROM dope_logs
         UNION
         SELECT DISTINCT environment_id FROM range_sessions
       )`,
      [cutoff]
    );

    return result.changes;
  }

  /**
   * Get count of environment snapshots
   */
  async count(): Promise<number> {
    const db = databaseService.getDatabase();

    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM environment_snapshots'
    );

    return result?.count || 0;
  }

  /**
   * Null the latitude on every stored snapshot.
   *
   * Backs the "delete stored location data" action in Settings. Deliberately does
   * not delete the snapshots themselves: the temperature, pressure and wind
   * readings are the user's shooting history and are not the sensitive part. Only
   * the coordinate is removed. See issue #44.
   *
   * @returns The number of snapshots that actually held a coordinate.
   */
  async clearStoredCoordinates(): Promise<number> {
    const db = databaseService.getDatabase();

    const result = await db.runAsync(
      'UPDATE environment_snapshots SET latitude = NULL WHERE latitude IS NOT NULL'
    );

    return result.changes;
  }

  /**
   * Get current conditions (most recent snapshot)
   */
  async getCurrent(): Promise<EnvironmentSnapshot | null> {
    const recent = await this.getRecent(1);
    return recent.length > 0 ? recent[0] : null;
  }
}

export const environmentRepository = new EnvironmentRepository();
export default environmentRepository;
