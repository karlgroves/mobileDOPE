/**
 * Custom caliber management (#67).
 *
 * The saved list lives with the app settings; the rifle and ammo profiles that
 * use a caliber live in SQLite and refer to it by name. ADR-004 matches ammo to
 * a rifle by that same name, so this is where the two are kept in step:
 *
 * - A **rename** moves every rifle and ammo profile on the old name to the new
 *   one, in the same transaction as the settings write. A profile left on the
 *   old name would be orphaned -- a caliber the app no longer offers, with no
 *   diameter for the solver and no matching ammo.
 * - A **delete** is refused while anything still uses the caliber, and says
 *   what does. Nothing is ever moved to a different caliber on the shooter's
 *   behalf: which one would be right is not something the app can know.
 *
 * Profiles are matched without regard to case, as `caliberDiameter` is, so a
 * profile the lookup treats as using the caliber is one this treats so too.
 */

import { isSeededCaliber, setCustomCalibers, type CustomCaliber } from '../constants/calibers';
import { useAmmoStore } from '../store/useAmmoStore';
import { useAppStore } from '../store/useAppStore';
import { useRifleStore } from '../store/useRifleStore';
import {
  removeCustomCaliber,
  upsertCustomCaliber,
  validateCustomCaliber,
  type CustomCaliberInput,
  type CustomCaliberValidation,
} from '../utils/customCalibers';

import { databaseService } from './database';

/** How many profiles use a caliber. */
export interface CaliberUsage {
  rifles: number;
  ammos: number;
}

/**
 * The statements for the two tables whose rows name a caliber, keyed by the
 * usage count each feeds. Written out in full rather than built from a table
 * name, so no SQL in this file is assembled from strings.
 */
const STATEMENTS = {
  rifles: {
    count: 'SELECT COUNT(*) AS count FROM rifle_profiles WHERE caliber = ? COLLATE NOCASE',
    rename:
      "UPDATE rifle_profiles SET caliber = ?, updated_at = datetime('now') " +
      'WHERE caliber = ? COLLATE NOCASE',
  },
  ammos: {
    count: 'SELECT COUNT(*) AS count FROM ammo_profiles WHERE caliber = ? COLLATE NOCASE',
    rename:
      "UPDATE ammo_profiles SET caliber = ?, updated_at = datetime('now') " +
      'WHERE caliber = ? COLLATE NOCASE',
  },
} as const;

const KEYS = ['rifles', 'ammos'] as const;

/** Count the rifle and ammo profiles that use `name`. */
export async function getCaliberUsage(name: string): Promise<CaliberUsage> {
  const db = databaseService.getDatabase();
  const usage: CaliberUsage = { rifles: 0, ammos: 0 };
  for (const key of KEYS) {
    const row = await db.getFirstAsync<{ count: number }>(STATEMENTS[key].count, [name]);
    usage[key] = row?.count ?? 0;
  }
  return usage;
}

/** The outcome of {@link saveCustomCaliber}. */
export type SaveCaliberResult =
  | { ok: true; caliber: CustomCaliber; renamed: CaliberUsage }
  | { ok: false; errors: CustomCaliberValidation['errors'] };

/** Put the saved list back after a failed write, in the store and the solver. */
const restoreList = (previous: CustomCaliber[]) => {
  useAppStore.setState((state) => ({
    settings: { ...state.settings, customCalibers: previous },
  }));
  setCustomCalibers(previous);
};

/**
 * Add a custom caliber, or edit the one called `original`.
 *
 * Throws only if the settings cannot be written, after undoing any rename of
 * profiles so they never name a caliber the saved list does not have.
 */
export async function saveCustomCaliber(
  input: CustomCaliberInput,
  original?: string
): Promise<SaveCaliberResult> {
  const { settings, updateSettings } = useAppStore.getState();
  const previous = settings.customCalibers;
  const { caliber, errors } = validateCustomCaliber(input, previous, original);
  if (!caliber) return { ok: false, errors };

  const next = upsertCustomCaliber(previous, original, caliber);
  const renaming = original !== undefined && original !== caliber.name;
  if (!renaming) {
    await updateSettings({ customCalibers: next });
    return { ok: true, caliber, renamed: { rifles: 0, ammos: 0 } };
  }

  let renamed: CaliberUsage;
  try {
    renamed = await databaseService.transaction(async (db) => {
      const changed: CaliberUsage = { rifles: 0, ammos: 0 };
      for (const key of KEYS) {
        const result = await db.runAsync(STATEMENTS[key].rename, [caliber.name, original]);
        changed[key] = result.changes;
      }
      // Inside the transaction, so a failed write rolls the profiles back.
      await updateSettings({ customCalibers: next });
      return changed;
    });
  } catch (error) {
    restoreList(previous);
    throw error;
  }

  if (renamed.rifles > 0) await useRifleStore.getState().loadRifles();
  if (renamed.ammos > 0) await useAmmoStore.getState().loadAmmoProfiles();
  return { ok: true, caliber, renamed };
}

/** The outcome of {@link deleteCustomCaliber}. */
export type DeleteCaliberResult = { deleted: true } | { deleted: false; usage: CaliberUsage };

/**
 * Delete the custom caliber called `name`, unless a profile still uses it.
 * Built-in calibers cannot be deleted.
 */
export async function deleteCustomCaliber(name: string): Promise<DeleteCaliberResult> {
  if (isSeededCaliber(name)) {
    throw new Error(`${name} is built in and cannot be deleted`);
  }
  const usage = await getCaliberUsage(name);
  if (usage.rifles > 0 || usage.ammos > 0) return { deleted: false, usage };

  const { settings, updateSettings } = useAppStore.getState();
  await updateSettings({ customCalibers: removeCustomCaliber(settings.customCalibers, name) });
  return { deleted: true };
}
