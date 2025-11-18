import { RifleProfile, RifleProfileData } from '../../models/RifleProfile';
import { RifleProfileRow } from '../../types/database.types';
import databaseService from './DatabaseService';

export class RifleProfileRepository {
  /**
   * Create a new rifle profile
   */
  async create(data: RifleProfileData): Promise<RifleProfile> {
    const profile = new RifleProfile(data);
    const db = databaseService.getDatabase();

    const result = await db.runAsync(
      `INSERT INTO rifle_profiles (
        name, caliber, barrel_length, twist_rate, zero_distance,
        optic_manufacturer, optic_model, reticle_type,
        click_value_type, click_value, scope_height, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        profile.name,
        profile.caliber,
        profile.barrelLength,
        profile.twistRate,
        profile.zeroDistance,
        profile.opticManufacturer,
        profile.opticModel,
        profile.reticleType,
        profile.clickValueType,
        profile.clickValue,
        profile.scopeHeight,
        profile.notes || null,
      ]
    );

    profile.id = result.lastInsertRowId;
    return profile;
  }

  /**
   * Get a rifle profile by ID
   */
  async getById(id: number): Promise<RifleProfile | null> {
    const db = databaseService.getDatabase();

    const row = await db.getFirstAsync<RifleProfileRow>(
      'SELECT * FROM rifle_profiles WHERE id = ?',
      [id]
    );

    return row ? RifleProfile.fromRow(row) : null;
  }

  /**
   * Get all rifle profiles
   */
  async getAll(): Promise<RifleProfile[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<RifleProfileRow>(
      'SELECT * FROM rifle_profiles ORDER BY name ASC'
    );

    return rows.map((row) => RifleProfile.fromRow(row));
  }

  /**
   * Update a rifle profile
   */
  async update(id: number, data: Partial<RifleProfileData>): Promise<RifleProfile | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const updated = new RifleProfile({ ...existing.toJSON(), ...data, id });
    const db = databaseService.getDatabase();

    await db.runAsync(
      `UPDATE rifle_profiles SET
        name = ?, caliber = ?, barrel_length = ?, twist_rate = ?,
        zero_distance = ?, optic_manufacturer = ?, optic_model = ?,
        reticle_type = ?, click_value_type = ?, click_value = ?,
        scope_height = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?`,
      [
        updated.name,
        updated.caliber,
        updated.barrelLength,
        updated.twistRate,
        updated.zeroDistance,
        updated.opticManufacturer,
        updated.opticModel,
        updated.reticleType,
        updated.clickValueType,
        updated.clickValue,
        updated.scopeHeight,
        updated.notes || null,
        id,
      ]
    );

    return this.getById(id);
  }

  /**
   * Delete a rifle profile (and cascading deletes ammo profiles and DOPE logs)
   */
  async delete(id: number): Promise<boolean> {
    const db = databaseService.getDatabase();

    const result = await db.runAsync('DELETE FROM rifle_profiles WHERE id = ?', [id]);

    return result.changes > 0;
  }

  /**
   * Search rifle profiles by name or caliber
   */
  async search(query: string): Promise<RifleProfile[]> {
    const db = databaseService.getDatabase();

    const rows = await db.getAllAsync<RifleProfileRow>(
      `SELECT * FROM rifle_profiles
       WHERE name LIKE ? OR caliber LIKE ?
       ORDER BY name ASC`,
      [`%${query}%`, `%${query}%`]
    );

    return rows.map((row) => RifleProfile.fromRow(row));
  }

  /**
   * Get count of rifle profiles
   */
  async count(): Promise<number> {
    const db = databaseService.getDatabase();

    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM rifle_profiles'
    );

    return result?.count || 0;
  }
}

export const rifleProfileRepository = new RifleProfileRepository();
export default rifleProfileRepository;
