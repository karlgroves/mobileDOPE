import { ShotString, ShotStringData } from '../../models/ShotString';
import { ShotStringRow } from '../../types/database.types';
import databaseService from './DatabaseService';

export interface ShotStringStatistics {
  count: number;
  averageVelocity: number;
  extremeSpread: number; // ES
  standardDeviation: number; // SD
  minVelocity: number;
  maxVelocity: number;
}

export class ShotStringRepository {
  /**
   * Create a new shot string entry
   */
  async create(data: ShotStringData): Promise<ShotString> {
    const shotString = new ShotString(data);
    const db = databaseService.getDatabase();

    const result = await db.runAsync(
      `INSERT INTO shot_strings (
        ammo_id, session_date, shot_number, velocity, temperature, notes
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        shotString.ammoId,
        shotString.sessionDate,
        shotString.shotNumber,
        shotString.velocity,
        shotString.temperature,
        shotString.notes || null,
      ]
    );

    shotString.id = result.lastInsertRowId;
    return shotString;
  }

  /**
   * Get a shot string entry by ID
   */
  async getById(id: number): Promise<ShotString | null> {
    const db = databaseService.getDatabase();

    const row = await db.getFirstAsync<ShotStringRow>('SELECT * FROM shot_strings WHERE id = ?', [
      id,
    ]);

    return row ? ShotString.fromRow(row) : null;
  }

  /**
   * Get all shot strings for a specific ammo profile
   */
  async getByAmmoId(ammoId: number): Promise<ShotString[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<ShotStringRow>(
      'SELECT * FROM shot_strings WHERE ammo_id = ? ORDER BY session_date DESC, shot_number ASC',
      [ammoId]
    );

    return rows.map((row) => ShotString.fromRow(row));
  }

  /**
   * Get all shot strings for a specific session date and ammo
   */
  async getBySession(ammoId: number, sessionDate: string): Promise<ShotString[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<ShotStringRow>(
      'SELECT * FROM shot_strings WHERE ammo_id = ? AND session_date = ? ORDER BY shot_number ASC',
      [ammoId, sessionDate]
    );

    return rows.map((row) => ShotString.fromRow(row));
  }

  /**
   * Get all shot strings
   */
  async getAll(): Promise<ShotString[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<ShotStringRow>(
      'SELECT * FROM shot_strings ORDER BY session_date DESC, shot_number ASC'
    );

    return rows.map((row) => ShotString.fromRow(row));
  }

  /**
   * Update a shot string entry
   */
  async update(id: number, data: Partial<ShotStringData>): Promise<ShotString | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const updated = new ShotString({ ...existing.toJSON(), ...data, id });
    const db = databaseService.getDatabase();

    await db.runAsync(
      `UPDATE shot_strings SET
        ammo_id = ?, session_date = ?, shot_number = ?,
        velocity = ?, temperature = ?, notes = ?
      WHERE id = ?`,
      [
        updated.ammoId,
        updated.sessionDate,
        updated.shotNumber,
        updated.velocity,
        updated.temperature,
        updated.notes || null,
        id,
      ]
    );

    return this.getById(id);
  }

  /**
   * Delete a shot string entry
   */
  async delete(id: number): Promise<boolean> {
    const db = databaseService.getDatabase();

    const result = await db.runAsync('DELETE FROM shot_strings WHERE id = ?', [id]);

    return result.changes > 0;
  }

  /**
   * Delete all shot strings for a session
   */
  async deleteBySession(ammoId: number, sessionDate: string): Promise<number> {
    const db = databaseService.getDatabase();

    const result = await db.runAsync(
      'DELETE FROM shot_strings WHERE ammo_id = ? AND session_date = ?',
      [ammoId, sessionDate]
    );

    return result.changes;
  }

  /**
   * Get count of shot strings
   */
  async count(): Promise<number> {
    const db = databaseService.getDatabase();

    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM shot_strings'
    );

    return result?.count || 0;
  }

  /**
   * Get count of shot strings for a specific ammo
   */
  async countByAmmo(ammoId: number): Promise<number> {
    const db = databaseService.getDatabase();

    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM shot_strings WHERE ammo_id = ?',
      [ammoId]
    );

    return result?.count || 0;
  }

  /**
   * Calculate statistics for a shot string session
   */
  async getSessionStatistics(
    ammoId: number,
    sessionDate: string
  ): Promise<ShotStringStatistics | null> {
    const shotStrings = await this.getBySession(ammoId, sessionDate);

    if (shotStrings.length === 0) {
      return null;
    }

    const velocities = shotStrings.map((s) => s.velocity);
    const count = velocities.length;
    const sum = velocities.reduce((a, b) => a + b, 0);
    const averageVelocity = sum / count;
    const minVelocity = Math.min(...velocities);
    const maxVelocity = Math.max(...velocities);
    const extremeSpread = maxVelocity - minVelocity;

    // Calculate standard deviation
    const squaredDiffs = velocities.map((v) => Math.pow(v - averageVelocity, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / count;
    const standardDeviation = Math.sqrt(avgSquaredDiff);

    return {
      count,
      averageVelocity: Math.round(averageVelocity * 10) / 10,
      extremeSpread: Math.round(extremeSpread * 10) / 10,
      standardDeviation: Math.round(standardDeviation * 10) / 10,
      minVelocity,
      maxVelocity,
    };
  }

  /**
   * Get unique session dates for an ammo profile
   */
  async getSessionDates(ammoId: number): Promise<string[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<{ session_date: string }>(
      'SELECT DISTINCT session_date FROM shot_strings WHERE ammo_id = ? ORDER BY session_date DESC',
      [ammoId]
    );

    return rows.map((row) => row.session_date);
  }

  /**
   * Get next shot number for a session
   */
  async getNextShotNumber(ammoId: number, sessionDate: string): Promise<number> {
    const db = databaseService.getDatabase();

    const result = await db.getFirstAsync<{ max_shot: number | null }>(
      'SELECT MAX(shot_number) as max_shot FROM shot_strings WHERE ammo_id = ? AND session_date = ?',
      [ammoId, sessionDate]
    );

    return (result?.max_shot || 0) + 1;
  }
}

export const shotStringRepository = new ShotStringRepository();
export default shotStringRepository;
