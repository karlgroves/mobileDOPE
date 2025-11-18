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
      `INSERT INTO environment_snapshots (
        temperature, humidity, pressure, altitude, density_altitude,
        wind_speed, wind_direction, latitude, longitude
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        snapshot.temperature,
        snapshot.humidity,
        snapshot.pressure,
        snapshot.altitude,
        snapshot.densityAltitude,
        snapshot.windSpeed,
        snapshot.windDirection,
        snapshot.latitude || null,
        snapshot.longitude || null,
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
    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    const rows = await db.getAllAsync<EnvironmentSnapshotRow>(sql);

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
        latitude = ?, longitude = ?
      WHERE id = ?`,
      [
        updated.temperature,
        updated.humidity,
        updated.pressure,
        updated.altitude,
        updated.densityAltitude,
        updated.windSpeed,
        updated.windDirection,
        updated.latitude || null,
        updated.longitude || null,
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

    const result = await db.runAsync(
      `DELETE FROM environment_snapshots
       WHERE timestamp < datetime('now', '-${days} days')
       AND id NOT IN (
         SELECT DISTINCT environment_id FROM dope_logs
         UNION
         SELECT DISTINCT environment_id FROM range_sessions
       )`,
      []
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
   * Get current conditions (most recent snapshot)
   */
  async getCurrent(): Promise<EnvironmentSnapshot | null> {
    const recent = await this.getRecent(1);
    return recent.length > 0 ? recent[0] : null;
  }
}

export const environmentRepository = new EnvironmentRepository();
export default environmentRepository;
