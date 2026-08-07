import * as Sharing from 'expo-sharing';

import ammoProfileRepository from '../../../src/services/database/AmmoProfileRepository';
import dopeLogRepository from '../../../src/services/database/DOPELogRepository';
import environmentRepository from '../../../src/services/database/EnvironmentRepository';
import rifleProfileRepository from '../../../src/services/database/RifleProfileRepository';
import { exportFullBackup } from '../../../src/services/ExportService';
import { importFullBackup } from '../../../src/services/ImportService';
import { validAmmo, validDopeLog, validEnvironment, validRifle } from '../../helpers/fixtures';
import { readWritten, resetFileSystem } from '../../helpers/mockFileSystem';
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
// expo-print ships ESM, which the ts-jest/node `unit` project cannot parse. ExportService
// imports it at module scope for the PDF exporters, so it has to be mocked even though the
// tests here only exercise the JSON path.
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(async () => ({ uri: 'file:///test-cache/print.pdf' })),
}));

/**
 * Shape of the file `exportFullBackup` writes. `@total-typescript/ts-reset` narrows
 * `JSON.parse` to `unknown`, so parsed backups need an explicit cast.
 */
interface BackupFile {
  exportDate: string;
  exportVersion: string;
  type: string;
  data: { rifles: unknown[]; ammos: unknown[]; environments: unknown[]; logs: unknown[] };
  counts: { rifles: number; ammos: number; environments: number; logs: number };
}

const parseBackup = (raw: string): BackupFile => JSON.parse(raw) as BackupFile;

/** Points ImportService's picker + fetch at a uri already in the mock file system. */
const stageImportFile = async (uri: string): Promise<void> => {
  const DocumentPicker = await import('expo-document-picker');
  (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri }],
  });
  global.fetch = jest.fn(async () => ({
    text: async () => readWritten(uri) as string,
  })) as unknown as typeof fetch;
};

/** Everything currently in the database, for before/after comparison. */
const snapshotDatabase = async () => ({
  rifles: (await rifleProfileRepository.getAll()).map((r) => r.name),
  ammos: (await ammoProfileRepository.getAll()).map((a) => a.name),
  logs: (await dopeLogRepository.getAll()).map((l) => l.distance),
});

describe('Export/Import round trip', () => {
  beforeEach(async () => {
    await installTestDatabase();
    resetFileSystem();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await uninstallTestDatabase();
  });

  /** Seeds one rifle, one ammo, one environment and two DOPE logs. */
  const seed = async () => {
    const rifleId = (await rifleProfileRepository.create(validRifle({ name: 'Tikka T3x' })))
      .id as number;
    const ammoId = (await ammoProfileRepository.create(validAmmo({ name: '175gr SMK' })))
      .id as number;
    const environmentId = (await environmentRepository.create(validEnvironment())).id as number;
    const ids = { rifleId, ammoId, environmentId };
    await dopeLogRepository.create(validDopeLog(ids, { distance: 500 }));
    await dopeLogRepository.create(validDopeLog(ids, { distance: 800 }));
    return ids;
  };

  /** Exports everything currently in the database, environments included. */
  const exportEverything = async () =>
    exportFullBackup(
      await rifleProfileRepository.getAll(),
      await ammoProfileRepository.getAll(),
      await dopeLogRepository.getAll(),
      await environmentRepository.getAll()
    );

  describe('exportFullBackup', () => {
    it('writes a backup file and reports its uri', async () => {
      await seed();

      const result = await exportEverything();

      expect(result.success).toBe(true);
      expect(result.uri).toMatch(/mobiledope_backup_\d+\.json$/);
      expect(readWritten(result.uri as string)).toBeDefined();
    });

    it('records counts that match the payload', async () => {
      await seed();

      const result = await exportEverything();

      const backup = parseBackup(readWritten(result.uri as string) as string);
      expect(backup.type).toBe('full_backup');
      expect(backup.exportVersion).toBe('1.1');
      expect(backup.counts).toEqual({ rifles: 1, ammos: 1, environments: 1, logs: 2 });
      expect(backup.data.rifles).toHaveLength(1);
      expect(backup.data.ammos).toHaveLength(1);
      expect(backup.data.logs).toHaveLength(2);
    });

    it('offers the file to the share sheet when sharing is available', async () => {
      await seed();

      const result = await exportEverything();

      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        result.uri,
        expect.objectContaining({ mimeType: 'application/json' })
      );
    });

    it('still succeeds when sharing is unavailable', async () => {
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
      await seed();

      const result = await exportFullBackup([], [], []);

      expect(result.success).toBe(true);
      expect(Sharing.shareAsync).not.toHaveBeenCalled();
    });

    it('exports an empty backup without error', async () => {
      const result = await exportFullBackup([], [], []);

      const backup = parseBackup(readWritten(result.uri as string) as string);
      expect(backup.counts).toEqual({ rifles: 0, ammos: 0, environments: 0, logs: 0 });
    });

    it('serialises coldBoreShot-style booleans consistently (regression for #38)', async () => {
      await seed();

      const result = await exportEverything();

      // Every exported value must be JSON-native: no 1/0 standing in for a boolean field.
      const raw = readWritten(result.uri as string) as string;
      expect(() => JSON.parse(raw)).not.toThrow();
      expect(raw).not.toMatch(/"coldBoreShot":\s*[01]\b/);
    });
  });

  describe('importFullBackup', () => {
    it('restores rifles and ammo into an empty database', async () => {
      await seed();
      const before = await snapshotDatabase();
      const exported = await exportEverything();

      // Fresh database, same backup file.
      await installTestDatabase();
      expect(await snapshotDatabase()).toEqual({ rifles: [], ammos: [], logs: [] });

      await stageImportFile(exported.uri as string);
      const result = await importFullBackup();

      expect(result.success).toBe(true);

      const after = await snapshotDatabase();
      expect(after.rifles).toEqual(before.rifles);
      expect(after.ammos).toEqual(before.ammos);
    });

    it('does not re-use the ids from the backup file', async () => {
      await seed();
      const exported = await exportEverything();

      // Import into a database that already holds a rifle, so ids cannot line up.
      await installTestDatabase();
      await rifleProfileRepository.create(validRifle({ name: 'Pre-existing' }));

      await stageImportFile(exported.uri as string);
      await importFullBackup();

      const names = (await rifleProfileRepository.getAll()).map((r) => r.name);
      expect(names).toContain('Pre-existing');
      expect(names).toContain('Tikka T3x');
    });

    it('rejects a file that is not a full backup', async () => {
      const uri = `${'file:///test-documents'}/partial.json`;
      const { File } = await import('expo-file-system');
      await new File('file:///test-documents', 'partial.json').write(
        JSON.stringify({ exportVersion: '1.0', type: 'rifle_profiles', data: { rifles: [] } })
      );

      await stageImportFile(uri);
      const result = await importFullBackup();

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Not a full backup/);
    });

    it('rejects a structurally invalid file', async () => {
      const { File } = await import('expo-file-system');
      await new File('file:///test-documents', 'garbage.json').write(
        JSON.stringify({ nope: true })
      );

      await stageImportFile('file:///test-documents/garbage.json');
      const result = await importFullBackup();

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid backup file format/);
    });

    it('rejects a payload carrying a prototype-pollution key', async () => {
      const { File } = await import('expo-file-system');
      // Built as text so the key survives into the parsed object.
      await new File('file:///test-documents', 'polluted.json').write(
        '{"exportVersion":"1.0","type":"full_backup","__proto__":{"polluted":true},"data":{"rifles":[]}}'
      );

      await stageImportFile('file:///test-documents/polluted.json');
      const result = await importFullBackup();

      expect(result.success).toBe(false);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('restores DOPE logs, remapping their foreign keys (#39)', async () => {
      await seed();
      const exported = await exportEverything();

      const backup = parseBackup(readWritten(exported.uri as string) as string);
      // Environments are in the payload now -- without them logs are unrestorable.
      expect(backup.data.environments).toHaveLength(1);

      await installTestDatabase();
      await stageImportFile(exported.uri as string);
      const result = await importFullBackup();

      expect(result.success).toBe(true);
      expect(result.imported).toMatchObject({ rifles: 1, ammos: 1, environments: 1, logs: 2 });
      expect(result.skipped?.logs).toBe(0);

      const logs = await dopeLogRepository.getAll();
      expect(logs.map((l) => l.distance).sort((a, b) => a - b)).toEqual([500, 800]);
    });

    it('preserves the original engagement and capture times', async () => {
      // A restored backup must keep WHEN each shot was taken. Previously create() dropped
      // `timestamp`, so every restored log and snapshot was re-dated to the import moment.
      const rifleId = (await rifleProfileRepository.create(validRifle())).id as number;
      const ammoId = (await ammoProfileRepository.create(validAmmo())).id as number;
      const environmentId = (
        await environmentRepository.create(
          validEnvironment({ timestamp: '2026-04-02T08:15:00.000Z' })
        )
      ).id as number;
      await dopeLogRepository.create(
        validDopeLog(
          { rifleId, ammoId, environmentId },
          { distance: 650, timestamp: '2026-04-02T09:30:00.000Z' }
        )
      );

      const exported = await exportEverything();

      await installTestDatabase();
      await stageImportFile(exported.uri as string);
      await importFullBackup();

      const [restoredLog] = await dopeLogRepository.getAll();
      const [restoredEnvironment] = await environmentRepository.getAll();

      expect(restoredLog.timestamp).toBe('2026-04-02T09:30:00.000Z');
      expect(restoredEnvironment.timestamp).toBe('2026-04-02T08:15:00.000Z');
    });

    it('relinks restored logs to the NEW parent ids, not the ids in the file', async () => {
      await seed();
      const exported = await exportEverything();

      // Pre-populate so the fresh ids cannot coincidentally match the backup's ids.
      await installTestDatabase();
      const decoyRifleId = (await rifleProfileRepository.create(validRifle({ name: 'Decoy' })))
        .id as number;

      await stageImportFile(exported.uri as string);
      await importFullBackup();

      const restoredRifle = (await rifleProfileRepository.getAll()).find(
        (r) => r.name === 'Tikka T3x'
      );
      const logs = await dopeLogRepository.getAll();

      expect(logs).toHaveLength(2);
      // Every log points at the newly created rifle, not the decoy that took the old id.
      for (const log of logs) {
        expect(log.rifleId).toBe(restoredRifle?.id);
        expect(log.rifleId).not.toBe(decoyRifleId);
      }
    });

    it('skips logs whose parents are missing instead of failing silently', async () => {
      const { File } = await import('expo-file-system');
      // A log referencing rifle/ammo/environment ids that are not in the file at all.
      await new File('file:///test-documents', 'orphan.json').write(
        JSON.stringify({
          exportVersion: '1.1',
          type: 'full_backup',
          data: {
            rifles: [],
            ammos: [],
            environments: [],
            logs: [{ id: 1, rifleId: 99, ammoId: 99, environmentId: 99, distance: 400 }],
          },
        })
      );

      await stageImportFile('file:///test-documents/orphan.json');
      const result = await importFullBackup();

      expect(result.success).toBe(true);
      expect(result.imported?.logs).toBe(0);
      expect(result.skipped?.logs).toBe(1);
      expect(result.warnings?.join(' ')).toMatch(/skipped/i);
      expect(await dopeLogRepository.count()).toBe(0);
    });

    it('warns that a legacy 1.0 backup cannot restore its logs', async () => {
      const { File } = await import('expo-file-system');
      await new File('file:///test-documents', 'legacy.json').write(
        JSON.stringify({
          exportVersion: '1.0',
          type: 'full_backup',
          data: {
            rifles: [{ id: 1, ...validRifle() }],
            ammos: [{ id: 1, ...validAmmo() }],
            logs: [{ id: 1, rifleId: 1, ammoId: 1, environmentId: 1, distance: 400 }],
          },
        })
      );

      await stageImportFile('file:///test-documents/legacy.json');
      const result = await importFullBackup();

      // Rifles and ammo still come back; the logs are reported rather than lost in silence.
      expect(result.imported).toMatchObject({ rifles: 1, ammos: 1, logs: 0 });
      expect(result.skipped?.logs).toBe(1);
      expect(result.warnings?.join(' ')).toMatch(/no environment snapshots/i);
    });

    it('counts a rifle that fails validation as skipped, and skips its logs', async () => {
      const { File } = await import('expo-file-system');
      await new File('file:///test-documents', 'bad-rifle.json').write(
        JSON.stringify({
          exportVersion: '1.1',
          type: 'full_backup',
          data: {
            // Missing every required field, so RifleProfile.validate() throws.
            rifles: [{ id: 1, name: '' }],
            ammos: [],
            environments: [{ id: 1, ...validEnvironment() }],
            logs: [{ id: 1, rifleId: 1, ammoId: 1, environmentId: 1, distance: 400 }],
          },
        })
      );

      await stageImportFile('file:///test-documents/bad-rifle.json');
      const result = await importFullBackup();

      expect(result.success).toBe(true);
      expect(result.imported).toMatchObject({ rifles: 0, environments: 1, logs: 0 });
      expect(result.skipped).toMatchObject({ rifles: 1, logs: 1 });
      expect(await rifleProfileRepository.count()).toBe(0);
    });

    it('reports cancellation rather than throwing', async () => {
      const DocumentPicker = await import('expo-document-picker');
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: true });

      const result = await importFullBackup();

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/cancelled/i);
    });
  });
});
