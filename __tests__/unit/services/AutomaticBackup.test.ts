import * as Sharing from 'expo-sharing';

import { runAutomaticBackup } from '../../../src/services/AutomaticBackupService';
import ammoProfileRepository from '../../../src/services/database/AmmoProfileRepository';
import dopeLogRepository from '../../../src/services/database/DOPELogRepository';
import environmentRepository from '../../../src/services/database/EnvironmentRepository';
import rifleProfileRepository from '../../../src/services/database/RifleProfileRepository';
import {
  deleteAutomaticBackups,
  latestAutomaticBackupUri,
  saveAutomaticBackup,
  shareLatestAutomaticBackup,
} from '../../../src/services/ExportService';
import { importFullBackup } from '../../../src/services/ImportService';
import { AUTOMATIC_BACKUPS_KEPT } from '../../../src/utils/backupSchedule';
import { validAmmo, validDopeLog, validEnvironment, validRifle } from '../../helpers/fixtures';
import {
  Directory,
  File,
  Paths,
  readWritten,
  resetFileSystem,
  writtenUris,
} from '../../helpers/mockFileSystem';
import { installTestDatabase, uninstallTestDatabase } from '../../helpers/testDatabase';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../../helpers/testDatabase').openDatabaseAsync(),
}));
jest.mock('expo-file-system', () => require('../../helpers/mockFileSystem'));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
// ExportService imports expo-print at module scope; see ExportImportRoundTrip.test.ts.
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(async () => ({ uri: 'file:///test-cache/print.pdf' })),
}));

/**
 * Automatic backups (#66), tested at the expo-file-system boundary.
 *
 * They go through the same serialiser as the manual full backup, so a file
 * the scheduler wrote restores through the ordinary Import > Full Backup path.
 * What differs is where it goes (a `backups/` folder in the app's documents,
 * not the share sheet), that old ones are pruned, and that it never carries
 * latitude -- see PRIVACY.md.
 */

const BACKUPS = `${Paths.document}/backups`;
const at = (ms: number) => new Date(Date.UTC(2026, 9, 1) + ms);

interface BackupFile {
  type: string;
  exportVersion: string;
  data: { rifles: unknown[]; environments: Record<string, unknown>[]; logs: unknown[] };
  counts: Record<string, number>;
}
const parse = (uri: string) => JSON.parse(readWritten(uri) as string) as BackupFile;

beforeEach(async () => {
  await installTestDatabase();
  resetFileSystem();
  jest.clearAllMocks();
});

afterEach(async () => {
  await uninstallTestDatabase();
});

const seed = async () => {
  const rifleId = (await rifleProfileRepository.create(validRifle({ name: 'Tikka T3x' })))
    .id as number;
  const ammoId = (await ammoProfileRepository.create(validAmmo())).id as number;
  const environmentId = (await environmentRepository.create(validEnvironment({ latitude: 39.74 })))
    .id as number;
  await dopeLogRepository.create(validDopeLog({ rifleId, ammoId, environmentId }));
};

describe('saveAutomaticBackup', () => {
  it('writes a full backup into backups/ without opening the share sheet', async () => {
    const result = await saveAutomaticBackup([], [], [], [], at(0));

    expect(result).toEqual({
      success: true,
      uri: `${BACKUPS}/mobiledope_auto_${at(0).getTime()}.json`,
    });
    expect(new Directory(Paths.document, 'backups').exists).toBe(true);
    expect(parse(result.uri as string)).toMatchObject({
      type: 'full_backup',
      exportVersion: '1.1',
    });
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('leaves latitude out, whatever is stored', async () => {
    await seed();
    const result = await saveAutomaticBackup(
      [],
      [],
      [],
      await environmentRepository.getAll(),
      at(0)
    );

    const [environment] = parse(result.uri as string).data.environments;
    expect(environment).toBeDefined();
    expect(environment).not.toHaveProperty('latitude');
    // The ballistic readings and the id DOPE logs restore against survive.
    expect(environment).toHaveProperty('id');
    expect(environment).toHaveProperty('temperature');
  });

  it(`keeps only the newest ${AUTOMATIC_BACKUPS_KEPT}, and nothing it did not write`, async () => {
    const stranger = new File(new Directory(Paths.document, 'backups'), 'mobiledope_backup_1.json');
    await stranger.write('{}');

    for (let day = 0; day < AUTOMATIC_BACKUPS_KEPT + 2; day++) {
      await saveAutomaticBackup([], [], [], [], at(day * 86_400_000));
    }

    const automatic = writtenUris().filter((uri) => uri.includes('mobiledope_auto_'));
    expect(automatic).toHaveLength(AUTOMATIC_BACKUPS_KEPT);
    // The two oldest went.
    expect(automatic).not.toContain(`${BACKUPS}/mobiledope_auto_${at(0).getTime()}.json`);
    expect(automatic).not.toContain(`${BACKUPS}/mobiledope_auto_${at(86_400_000).getTime()}.json`);
    expect(readWritten(stranger.uri)).toBe('{}');
  });
});

describe('saveAutomaticBackup after the clock has been set back', () => {
  it('keeps the backup it just wrote, and shares that one as the latest', async () => {
    const DAY = 86_400_000;
    for (let day = 1; day <= AUTOMATIC_BACKUPS_KEPT; day++) {
      await saveAutomaticBackup([], [], [], [], at(30 * DAY + day * DAY));
    }
    const rifle = await rifleProfileRepository.create(validRifle({ name: 'After set-back' }));

    const result = await saveAutomaticBackup([rifle], [], [], [], at(0));

    expect(result.success).toBe(true);
    expect(writtenUris()).toContain(result.uri);
    expect(latestAutomaticBackupUri()).toBe(result.uri);
    expect(parse(result.uri as string).counts.rifles).toBe(1);
  });
});

describe('deleteAutomaticBackups', () => {
  it('deletes every automatic backup and nothing else', async () => {
    const manual = new File(new Directory(Paths.document, 'backups'), 'mobiledope_backup_1.json');
    await manual.write('{}');
    await saveAutomaticBackup([], [], [], [], at(1_000));
    await saveAutomaticBackup([], [], [], [], at(2_000));

    expect(deleteAutomaticBackups()).toBe(2);

    expect(writtenUris().filter((uri) => uri.includes('mobiledope_auto_'))).toEqual([]);
    expect(latestAutomaticBackupUri()).toBeUndefined();
    expect(readWritten(manual.uri)).toBe('{}');
  });

  it('reports none when no backup folder exists yet', () => {
    expect(deleteAutomaticBackups()).toBe(0);
  });
});

describe('latestAutomaticBackupUri', () => {
  it('is undefined before any automatic backup exists', () => {
    expect(latestAutomaticBackupUri()).toBeUndefined();
  });

  it('finds the newest by its timestamp, not by write order', async () => {
    // Written straight to disk out of order: saveAutomaticBackup itself always
    // stamps its file above the existing ones.
    const backups = new Directory(Paths.document, 'backups');
    backups.create({ idempotent: true });
    for (const ms of [5_000, 10_000, 1_000]) {
      await new File(backups, `mobiledope_auto_${at(ms).getTime()}.json`).write('{}');
    }

    expect(latestAutomaticBackupUri()).toBe(
      `${BACKUPS}/mobiledope_auto_${at(10_000).getTime()}.json`
    );
  });
});

describe('shareLatestAutomaticBackup', () => {
  it('hands the newest file to the share sheet as JSON', async () => {
    await saveAutomaticBackup([], [], [], [], at(0));
    const { uri } = await saveAutomaticBackup([], [], [], [], at(1_000));

    const result = await shareLatestAutomaticBackup();

    expect(result).toEqual({ success: true, uri });
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      uri,
      expect.objectContaining({ mimeType: 'application/json', UTI: 'public.json' })
    );
  });

  it('says so rather than sharing nothing when there is no automatic backup', async () => {
    const result = await shareLatestAutomaticBackup();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no automatic backup/i);
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});

describe('runAutomaticBackup', () => {
  it('backs up every record in the database, not just what a screen has loaded', async () => {
    await seed();
    await seed();

    const result = await runAutomaticBackup(at(0));

    expect(result.success).toBe(true);
    expect(parse(result.uri as string).counts).toEqual({
      rifles: 2,
      ammos: 2,
      environments: 2,
      logs: 2,
    });
  });

  it('writes a file that restores through the ordinary import', async () => {
    await seed();
    const { uri } = await runAutomaticBackup(at(0));
    await uninstallTestDatabase();
    await installTestDatabase();

    const DocumentPicker = await import('expo-document-picker');
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri }],
    });
    global.fetch = jest.fn(async () => ({
      text: async () => readWritten(uri as string) as string,
    })) as unknown as typeof fetch;

    const restored = await importFullBackup();

    expect(restored.success).toBe(true);
    expect((await rifleProfileRepository.getAll()).map((r) => r.name)).toEqual(['Tikka T3x']);
    expect(await dopeLogRepository.getAll()).toHaveLength(1);
    // Restored without the latitude it was never given.
    expect((await environmentRepository.getAll())[0].latitude).toBeUndefined();
  });

  it('reports a failure instead of throwing when the database cannot be read', async () => {
    jest.spyOn(rifleProfileRepository, 'getAll').mockRejectedValueOnce(new Error('disk I/O error'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await runAutomaticBackup(at(0));

    expect(result).toEqual({ success: false, error: 'disk I/O error' });
  });
});
