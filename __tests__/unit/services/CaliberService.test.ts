import { caliberDiameter, setCustomCalibers } from '../../../src/constants/calibers';
import {
  deleteCustomCaliber,
  getCaliberUsage,
  saveCustomCaliber,
} from '../../../src/services/CaliberService';
import ammoProfileRepository from '../../../src/services/database/AmmoProfileRepository';
import databaseService from '../../../src/services/database/DatabaseService';
import rifleProfileRepository from '../../../src/services/database/RifleProfileRepository';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useAppStore } from '../../../src/store/useAppStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { validAmmo, validRifle } from '../../helpers/fixtures';
import { installTestDatabase, uninstallTestDatabase } from '../../helpers/testDatabase';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../../helpers/testDatabase').openDatabaseAsync(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

/**
 * Managing custom calibers against real profiles (#67).
 *
 * Rifles and ammo refer to a caliber by its name, and ADR-004 matches ammo to
 * a rifle by that name too. So the two operations that could break those
 * references are defined here and tested against a real database:
 *
 * - **Rename** carries every rifle and ammo profile using the old name to the
 *   new one, in one transaction. Leaving them on the old name would make it a
 *   caliber the app no longer knows -- no diameter, no picker entry -- which
 *   is the orphaning the issue warns against.
 * - **Delete** is refused while anything still uses the caliber, and reports
 *   what does. It never rewrites a profile to some other caliber.
 */

const wildcat = { name: '6.5 Wildcat', diameter: 0.264 };
const settings = () => useAppStore.getState().settings;
const caliberOf = async (kind: 'rifle' | 'ammo', id: number) =>
  kind === 'rifle'
    ? (await rifleProfileRepository.getById(id))?.caliber
    : (await ammoProfileRepository.getById(id))?.caliber;

beforeEach(async () => {
  await installTestDatabase();
  await useAppStore.getState().resetSettings();
  useRifleStore.setState({ rifles: [] });
  useAmmoStore.setState({ ammoProfiles: [] });
});

afterEach(async () => {
  setCustomCalibers([]);
  await uninstallTestDatabase();
});

const seedUsing = async (caliber: string) => {
  const rifle = await rifleProfileRepository.create(validRifle({ name: 'Wildcat rifle', caliber }));
  const ammo = await ammoProfileRepository.create(validAmmo({ name: 'Wildcat load', caliber }));
  const other = await rifleProfileRepository.create(
    validRifle({ name: 'Other', caliber: '.308 Winchester' })
  );
  return { rifleId: rifle.id as number, ammoId: ammo.id as number, otherId: other.id as number };
};

describe('saveCustomCaliber', () => {
  it('adds a caliber to the saved list and to the solver', async () => {
    const result = await saveCustomCaliber({ name: ' 6.5 Wildcat ', diameter: 0.264 });

    expect(result).toEqual({ ok: true, caliber: wildcat, renamed: { rifles: 0, ammos: 0 } });
    expect(settings().customCalibers).toEqual([wildcat]);
    expect(caliberDiameter('6.5 Wildcat')).toBe(0.264);
  });

  it('returns the reasons and saves nothing when the caliber is not valid', async () => {
    const result = await saveCustomCaliber({ name: '6.5 Creedmoor', diameter: 6.5 });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors).toEqual({
      name: expect.stringMatching(/built in/i),
      diameter: expect.stringMatching(/inches/),
    });
    expect(settings().customCalibers).toEqual([]);
  });

  it('carries every profile using the old name to the new one on rename', async () => {
    await saveCustomCaliber(wildcat);
    const { rifleId, ammoId, otherId } = await seedUsing('6.5 Wildcat');

    const result = await saveCustomCaliber({ name: '6.5 Kestrel', diameter: 0.264 }, '6.5 Wildcat');

    expect(result).toEqual({
      ok: true,
      caliber: { name: '6.5 Kestrel', diameter: 0.264 },
      renamed: { rifles: 1, ammos: 1 },
    });
    expect(await caliberOf('rifle', rifleId)).toBe('6.5 Kestrel');
    expect(await caliberOf('ammo', ammoId)).toBe('6.5 Kestrel');
    expect(await caliberOf('rifle', otherId)).toBe('.308 Winchester');
    expect(settings().customCalibers).toEqual([{ name: '6.5 Kestrel', diameter: 0.264 }]);
    // The old name no longer resolves; the new one does.
    expect(caliberDiameter('6.5 Wildcat')).toBeUndefined();
    expect(caliberDiameter('6.5 Kestrel')).toBe(0.264);
    // The lists on screen show the new name without a restart.
    expect(
      useRifleStore
        .getState()
        .rifles.map((r) => r.caliber)
        .sort()
    ).toEqual(['.308 Winchester', '6.5 Kestrel']);
    expect(useAmmoStore.getState().ammoProfiles.map((a) => a.caliber)).toEqual(['6.5 Kestrel']);
  });

  it('matches profiles whatever the case, as the diameter lookup does', async () => {
    await saveCustomCaliber(wildcat);
    const { rifleId } = await seedUsing('6.5 wildcat');

    await saveCustomCaliber({ name: '6.5 Kestrel', diameter: 0.264 }, '6.5 Wildcat');

    expect(await caliberOf('rifle', rifleId)).toBe('6.5 Kestrel');
  });

  it('touches no profile when only the diameter changes', async () => {
    await saveCustomCaliber(wildcat);
    await seedUsing('6.5 Wildcat');

    const result = await saveCustomCaliber(
      { name: '6.5 Wildcat', diameter: 0.2645 },
      '6.5 Wildcat'
    );

    expect(result).toMatchObject({ ok: true, renamed: { rifles: 0, ammos: 0 } });
    expect(caliberDiameter('6.5 Wildcat')).toBe(0.2645);
  });

  it('puts the profiles back if the new list cannot be saved', async () => {
    // Otherwise the profiles would name a caliber the saved list does not have.
    await saveCustomCaliber(wildcat);
    const { rifleId } = await seedUsing('6.5 Wildcat');
    const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage');
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      saveCustomCaliber({ name: '6.5 Kestrel', diameter: 0.264 }, '6.5 Wildcat')
    ).rejects.toThrow('disk full');

    expect(await caliberOf('rifle', rifleId)).toBe('6.5 Wildcat');
    expect(settings().customCalibers).toEqual([wildcat]);
    expect(caliberDiameter('6.5 Wildcat')).toBe(0.264);
  });

  it('re-saves the previous list if the transaction fails after the settings were written', async () => {
    // The settings write succeeds inside the transaction and the COMMIT then
    // fails: the profiles roll back, so storage must go back to the old list
    // too, or the next launch loads a caliber no profile is on.
    await saveCustomCaliber(wildcat);
    const { rifleId } = await seedUsing('6.5 Wildcat');
    const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage');
    const db = databaseService.getDatabase();
    const exec = db.execAsync.bind(db);
    jest.spyOn(db, 'execAsync').mockImplementation(async (sql: string) => {
      if (sql === 'COMMIT;') throw new Error('database is locked');
      return exec(sql);
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      saveCustomCaliber({ name: '6.5 Kestrel', diameter: 0.264 }, '6.5 Wildcat')
    ).rejects.toThrow('database is locked');

    expect(await caliberOf('rifle', rifleId)).toBe('6.5 Wildcat');
    const stored = JSON.parse(
      (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)?.[1] as string
    ) as { customCalibers: unknown };
    expect(stored.customCalibers).toEqual([wildcat]);
  });
});

describe('getCaliberUsage', () => {
  it('counts the rifles and ammo that use a caliber', async () => {
    await seedUsing('6.5 Wildcat');
    await ammoProfileRepository.create(validAmmo({ name: 'Second load', caliber: '6.5 Wildcat' }));

    expect(await getCaliberUsage('6.5 Wildcat')).toEqual({ rifles: 1, ammos: 2 });
    expect(await getCaliberUsage('Nothing')).toEqual({ rifles: 0, ammos: 0 });
  });
});

describe('deleteCustomCaliber', () => {
  it('removes an unused caliber from the list and the solver', async () => {
    await saveCustomCaliber(wildcat);

    expect(await deleteCustomCaliber('6.5 Wildcat')).toEqual({ deleted: true });
    expect(settings().customCalibers).toEqual([]);
    expect(caliberDiameter('6.5 Wildcat')).toBeUndefined();
  });

  it('refuses while a profile uses it, says what does, and changes nothing', async () => {
    await saveCustomCaliber(wildcat);
    const { rifleId, ammoId } = await seedUsing('6.5 Wildcat');

    expect(await deleteCustomCaliber('6.5 Wildcat')).toEqual({
      deleted: false,
      usage: { rifles: 1, ammos: 1 },
    });
    expect(settings().customCalibers).toEqual([wildcat]);
    expect(await caliberOf('rifle', rifleId)).toBe('6.5 Wildcat');
    expect(await caliberOf('ammo', ammoId)).toBe('6.5 Wildcat');
  });

  it('never deletes a built-in caliber', async () => {
    await seedUsing('.308 Winchester');
    await expect(deleteCustomCaliber('6.5 Creedmoor')).rejects.toThrow(/built in/i);
  });
});
