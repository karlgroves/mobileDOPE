import { RangeSession, RangeSessionData } from '../../models/RangeSession';
import { RangeSessionRow } from '../../types/database.types';
import databaseService from './DatabaseService';

export class RangeSessionRepository {
  /**
   * Create a new range session
   */
  async create(data: RangeSessionData): Promise<RangeSession> {
    const session = new RangeSession(data);
    const db = databaseService.getDatabase();

    const result = await db.runAsync(
      `INSERT INTO range_sessions (
        rifle_id, ammo_id, environment_id, session_name,
        start_time, end_time, distance, shot_count, cold_bore_shot, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.rifleId,
        session.ammoId,
        session.environmentId,
        session.sessionName || null,
        session.startTime,
        session.endTime || null,
        session.distance,
        session.shotCount,
        session.coldBoreShot ? 1 : 0,
        session.notes || null,
      ]
    );

    session.id = result.lastInsertRowId;
    return session;
  }

  /**
   * Get a range session by ID
   */
  async getById(id: number): Promise<RangeSession | null> {
    const db = databaseService.getDatabase();

    const row = await db.getFirstAsync<RangeSessionRow>(
      'SELECT * FROM range_sessions WHERE id = ?',
      [id]
    );

    return row ? RangeSession.fromRow(row) : null;
  }

  /**
   * Get all range sessions for a specific rifle
   */
  async getByRifleId(rifleId: number): Promise<RangeSession[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<RangeSessionRow>(
      'SELECT * FROM range_sessions WHERE rifle_id = ? ORDER BY start_time DESC',
      [rifleId]
    );

    return rows.map((row) => RangeSession.fromRow(row));
  }

  /**
   * Get all range sessions for a specific ammo
   */
  async getByAmmoId(ammoId: number): Promise<RangeSession[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<RangeSessionRow>(
      'SELECT * FROM range_sessions WHERE ammo_id = ? ORDER BY start_time DESC',
      [ammoId]
    );

    return rows.map((row) => RangeSession.fromRow(row));
  }

  /**
   * Get all range sessions
   */
  async getAll(): Promise<RangeSession[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<RangeSessionRow>(
      'SELECT * FROM range_sessions ORDER BY start_time DESC'
    );

    return rows.map((row) => RangeSession.fromRow(row));
  }

  /**
   * Get active (not ended) range sessions
   */
  async getActive(): Promise<RangeSession[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<RangeSessionRow>(
      'SELECT * FROM range_sessions WHERE end_time IS NULL ORDER BY start_time DESC'
    );

    return rows.map((row) => RangeSession.fromRow(row));
  }

  /**
   * Update a range session
   */
  async update(id: number, data: Partial<RangeSessionData>): Promise<RangeSession | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const updated = new RangeSession({ ...existing.toJSON(), ...data, id });
    const db = databaseService.getDatabase();

    await db.runAsync(
      `UPDATE range_sessions SET
        rifle_id = ?, ammo_id = ?, environment_id = ?, session_name = ?,
        start_time = ?, end_time = ?, distance = ?, shot_count = ?,
        cold_bore_shot = ?, notes = ?
      WHERE id = ?`,
      [
        updated.rifleId,
        updated.ammoId,
        updated.environmentId,
        updated.sessionName || null,
        updated.startTime,
        updated.endTime || null,
        updated.distance,
        updated.shotCount,
        updated.coldBoreShot ? 1 : 0,
        updated.notes || null,
        id,
      ]
    );

    return this.getById(id);
  }

  /**
   * End a range session
   */
  async endSession(id: number, endTime?: string): Promise<RangeSession | null> {
    const session = await this.getById(id);
    if (!session) {
      return null;
    }

    return this.update(id, {
      endTime: endTime || new Date().toISOString(),
    });
  }

  /**
   * Increment shot count for a session
   */
  async incrementShotCount(id: number): Promise<RangeSession | null> {
    const session = await this.getById(id);
    if (!session) {
      return null;
    }

    return this.update(id, {
      shotCount: session.shotCount + 1,
    });
  }

  /**
   * Delete a range session
   */
  async delete(id: number): Promise<boolean> {
    const db = databaseService.getDatabase();

    const result = await db.runAsync('DELETE FROM range_sessions WHERE id = ?', [id]);

    return result.changes > 0;
  }

  /**
   * Get count of range sessions
   */
  async count(): Promise<number> {
    const db = databaseService.getDatabase();

    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM range_sessions'
    );

    return result?.count || 0;
  }

  /**
   * Get count of range sessions for a specific rifle
   */
  async countByRifle(rifleId: number): Promise<number> {
    const db = databaseService.getDatabase();

    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM range_sessions WHERE rifle_id = ?',
      [rifleId]
    );

    return result?.count || 0;
  }

  /**
   * Get sessions within a date range
   */
  async getByDateRange(startDate: string, endDate: string): Promise<RangeSession[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<RangeSessionRow>(
      `SELECT * FROM range_sessions
       WHERE start_time >= ? AND start_time <= ?
       ORDER BY start_time DESC`,
      [startDate, endDate]
    );

    return rows.map((row) => RangeSession.fromRow(row));
  }

  /**
   * Get cold bore sessions
   */
  async getColdBoreSessions(): Promise<RangeSession[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<RangeSessionRow>(
      'SELECT * FROM range_sessions WHERE cold_bore_shot = 1 ORDER BY start_time DESC'
    );

    return rows.map((row) => RangeSession.fromRow(row));
  }

  /**
   * Search sessions by name
   */
  async search(query: string): Promise<RangeSession[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<RangeSessionRow>(
      `SELECT * FROM range_sessions
       WHERE session_name LIKE ? OR notes LIKE ?
       ORDER BY start_time DESC`,
      [`%${query}%`, `%${query}%`]
    );

    return rows.map((row) => RangeSession.fromRow(row));
  }

  /**
   * Get total shot count across all sessions for a rifle
   */
  async getTotalShotCountByRifle(rifleId: number): Promise<number> {
    const db = databaseService.getDatabase();

    const result = await db.getFirstAsync<{ total: number | null }>(
      'SELECT SUM(shot_count) as total FROM range_sessions WHERE rifle_id = ?',
      [rifleId]
    );

    return result?.total || 0;
  }
}

export const rangeSessionRepository = new RangeSessionRepository();
export default rangeSessionRepository;
