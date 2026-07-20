import { AmmoProfile, AmmoProfileData } from '../../models/AmmoProfile';
import { AmmoProfileRow } from '../../types/database.types';
import databaseService from './DatabaseService';

export class AmmoProfileRepository {
  /**
   * Create a new ammo profile
   */
  async create(data: AmmoProfileData): Promise<AmmoProfile> {
    const profile = new AmmoProfile(data);
    const db = databaseService.getDatabase();

    const result = await db.runAsync(
      `INSERT INTO ammo_profiles (
        name, manufacturer, caliber, bullet_weight, bullet_type,
        ballistic_coefficient_g1, ballistic_coefficient_g7, muzzle_velocity,
        powder_type, powder_weight, lot_number, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        profile.name,
        profile.manufacturer,
        profile.caliber,
        profile.bulletWeight,
        profile.bulletType,
        profile.ballisticCoefficientG1,
        profile.ballisticCoefficientG7,
        profile.muzzleVelocity,
        profile.powderType || null,
        profile.powderWeight || null,
        profile.lotNumber || null,
        profile.notes || null,
      ]
    );

    profile.id = result.lastInsertRowId;
    return profile;
  }

  /**
   * Get an ammo profile by ID
   */
  async getById(id: number): Promise<AmmoProfile | null> {
    const db = databaseService.getDatabase();

    const row = await db.getFirstAsync<AmmoProfileRow>('SELECT * FROM ammo_profiles WHERE id = ?', [
      id,
    ]);

    return row ? AmmoProfile.fromRow(row) : null;
  }

  /**
   * Get all ammo profiles for a specific caliber
   */
  async getByCaliber(caliber: string): Promise<AmmoProfile[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<AmmoProfileRow>(
      'SELECT * FROM ammo_profiles WHERE caliber = ? ORDER BY name ASC',
      [caliber]
    );

    return rows.map((row) => AmmoProfile.fromRow(row));
  }

  /**
   * Get all ammo profiles
   */
  async getAll(): Promise<AmmoProfile[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<AmmoProfileRow>(
      'SELECT * FROM ammo_profiles ORDER BY caliber, name ASC'
    );

    return rows.map((row) => AmmoProfile.fromRow(row));
  }

  /**
   * Update an ammo profile
   */
  async update(id: number, data: Partial<AmmoProfileData>): Promise<AmmoProfile | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const updated = new AmmoProfile({ ...existing.toJSON(), ...data, id });
    const db = databaseService.getDatabase();

    await db.runAsync(
      `UPDATE ammo_profiles SET
        name = ?, manufacturer = ?, caliber = ?, bullet_weight = ?,
        bullet_type = ?, ballistic_coefficient_g1 = ?, ballistic_coefficient_g7 = ?,
        muzzle_velocity = ?, powder_type = ?, powder_weight = ?,
        lot_number = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?`,
      [
        updated.name,
        updated.manufacturer,
        updated.caliber,
        updated.bulletWeight,
        updated.bulletType,
        updated.ballisticCoefficientG1,
        updated.ballisticCoefficientG7,
        updated.muzzleVelocity,
        updated.powderType || null,
        updated.powderWeight || null,
        updated.lotNumber || null,
        updated.notes || null,
        id,
      ]
    );

    return this.getById(id);
  }

  /**
   * Delete an ammo profile
   */
  async delete(id: number): Promise<boolean> {
    const db = databaseService.getDatabase();

    const result = await db.runAsync('DELETE FROM ammo_profiles WHERE id = ?', [id]);

    return result.changes > 0;
  }

  /**
   * Search ammo profiles by name, manufacturer, or caliber
   */
  async search(query: string): Promise<AmmoProfile[]> {
    const db = databaseService.getDatabase();

    const sql = `SELECT * FROM ammo_profiles
               WHERE (name LIKE ? OR manufacturer LIKE ? OR caliber LIKE ?)
               ORDER BY caliber, name ASC`;
    const params: string[] = [`%${query}%`, `%${query}%`, `%${query}%`];

    const rows = await db.getAllAsync<AmmoProfileRow>(sql, params);

    return rows.map((row) => AmmoProfile.fromRow(row));
  }

  /**
   * Get count of ammo profiles
   */
  async count(): Promise<number> {
    const db = databaseService.getDatabase();

    const sql = 'SELECT COUNT(*) as count FROM ammo_profiles';

    const result = await db.getFirstAsync<{ count: number }>(sql);

    return result?.count || 0;
  }
}

export const ammoProfileRepository = new AmmoProfileRepository();
export default ammoProfileRepository;
