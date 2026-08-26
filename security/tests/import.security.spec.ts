import * as DocumentPicker from 'expo-document-picker';

import { installTestDatabase, uninstallTestDatabase } from '../../__tests__/helpers/testDatabase';
import { importFullBackup } from '../../src/services/ImportService';

jest.mock('expo-sqlite', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  openDatabaseAsync: () => require('../../__tests__/helpers/testDatabase').openDatabaseAsync(),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

/**
 * Adversarial tests for the only untrusted input this app accepts.
 *
 * Everything else in Mobile DOPE is either entered by the user through a validated
 * form or produced by the app itself. `ImportService` reads a JSON file chosen from
 * a document picker -- the user selects it, but nothing guarantees the app wrote it.
 * That makes it the whole external attack surface, so it gets its own suite rather
 * than being covered incidentally by the round-trip tests.
 *
 * These assert on hostile input, not on the happy path. See issue #45 item 8 and
 * security/docs/security-exceptions.md.
 */

/** Stand in for the document picker returning a file with this exact content. */
const givenImportFile = (content: string): void => {
  (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///import.json' }],
  });
  global.fetch = jest.fn(async () => ({ text: async () => content })) as unknown as typeof fetch;
};

const wellFormedBackup = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    exportDate: '2026-08-01T00:00:00.000Z',
    exportVersion: '1.1',
    type: 'full_backup',
    data: { rifles: [], ammos: [], environments: [], logs: [] },
    ...overrides,
  });

describe('import: oversized input', () => {
  beforeEach(async () => {
    await installTestDatabase();
    jest.clearAllMocks();
  });
  afterEach(async () => {
    await uninstallTestDatabase();
  });

  it('rejects a file beyond the size limit without parsing it', async () => {
    // 30 MB of valid JSON. The point is that it is refused on length, before
    // JSON.parse gets a chance to allocate a structure from it.
    const huge = `{"padding":"${'a'.repeat(30_000_000)}"}`;
    givenImportFile(huge);

    const result = await importFullBackup();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too large/i);
  });

  it('accepts a file just under the limit', async () => {
    const padding = 'a'.repeat(1_000_000);
    givenImportFile(wellFormedBackup({ padding }));

    const result = await importFullBackup();

    // It may still fail for another reason; it must not fail on size.
    expect(result.error ?? '').not.toMatch(/too large/i);
  });
});

describe('import: hostile structure', () => {
  beforeEach(async () => {
    await installTestDatabase();
    jest.clearAllMocks();
  });
  afterEach(async () => {
    await uninstallTestDatabase();
  });

  it('rejects deeply nested JSON rather than overflowing the stack', async () => {
    // JSON.parse tolerates this; the recursive walks downstream of it do not.
    const depth = 5000;
    const nested = '['.repeat(depth) + ']'.repeat(depth);
    givenImportFile(`{"type":"full_backup","data":${nested}}`);

    const result = await importFullBackup();

    expect(result.success).toBe(false);
    // Must be a refusal, not a crash.
    expect(typeof result.error).toBe('string');
  });

  it('rejects malformed JSON with a message rather than throwing', async () => {
    givenImportFile('{ "type": "full_backup", ');

    const result = await importFullBackup();

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects a JSON scalar where an object is expected', async () => {
    givenImportFile('"just a string"');

    const result = await importFullBackup();

    expect(result.success).toBe(false);
  });

  it('rejects an empty file', async () => {
    givenImportFile('');

    const result = await importFullBackup();

    expect(result.success).toBe(false);
  });

  it('rejects a file that is valid JSON but not a backup', async () => {
    givenImportFile(JSON.stringify({ hello: 'world' }));

    const result = await importFullBackup();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/format|backup/i);
  });
});

describe('import: prototype pollution', () => {
  beforeEach(async () => {
    await installTestDatabase();
    jest.clearAllMocks();
  });
  afterEach(async () => {
    await uninstallTestDatabase();
    // Undo anything a failed assertion might have left on the prototype.
    delete (Object.prototype as unknown as Record<string, unknown>).polluted;
  });

  it('does not write through __proto__ in a record', async () => {
    givenImportFile(
      wellFormedBackup({
        data: {
          rifles: [
            // Built with a computed key: an inline `__proto__:` literal is
            // interpreted by the parser rather than becoming an own property, so
            // it would not actually test what this claims to.
            { name: 'Tikka T3x', caliber: '.308 Win', ['__proto__']: { polluted: 'yes' } },
          ],
          ammos: [],
          environments: [],
          logs: [],
        },
      })
    );

    await importFullBackup();

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((Object.prototype as unknown as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('does not write through a constructor.prototype key', async () => {
    givenImportFile(
      wellFormedBackup({
        data: {
          rifles: [{ name: 'Tikka T3x', constructor: { prototype: { polluted: 'yes' } } }],
          ammos: [],
          environments: [],
          logs: [],
        },
      })
    );

    await importFullBackup();

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('drops fields outside the allowlist instead of mass-assigning them', async () => {
    // `id` is deliberately not in RIFLE_ALLOWED_FIELDS: an imported record must not
    // be able to choose its own primary key and overwrite an existing row.
    givenImportFile(
      wellFormedBackup({
        data: {
          rifles: [
            {
              name: 'Tikka T3x',
              caliber: '.308 Win',
              barrelLength: 24,
              twistRate: 8,
              zeroDistance: 100,
              clickValueType: 'MIL',
              clickValue: 0.1,
              scopeHeight: 1.5,
              id: 9999,
              isAdmin: true,
            },
          ],
          ammos: [],
          environments: [],
          logs: [],
        },
      })
    );

    const result = await importFullBackup();

    if (result.success) {
      const rifleRepository = (await import('../../src/services/database/RifleProfileRepository'))
        .default;
      const rifles = await rifleRepository.getAll();
      // The row exists, but with a database-assigned id, not the one in the file.
      expect(rifles.every((rifle) => rifle.id !== 9999)).toBe(true);
      expect(rifles.every((r) => !('isAdmin' in (r as unknown as object)))).toBe(true);
    }
  });
});

describe('import: error messages do not leak internals', () => {
  beforeEach(async () => {
    await installTestDatabase();
    jest.clearAllMocks();
  });
  afterEach(async () => {
    await uninstallTestDatabase();
  });

  it.each([
    ['malformed JSON', '{ "type": '],
    ['a scalar', '42'],
    ['an empty file', ''],
    ['a non-backup object', '{"hello":"world"}'],
  ])('surfaces no stack trace or filesystem path for %s', async (_label, content) => {
    givenImportFile(content);

    const result = await importFullBackup();
    const message = result.error ?? '';

    expect(message).not.toMatch(/\bat\s+\w+\s+\(/); // stack frame
    expect(message).not.toMatch(/\/Users\/|\/home\/|[A-Z]:\\\\/); // absolute path
    expect(message).not.toMatch(/node_modules/);
    expect(message).not.toMatch(/\.ts:\d+/);
  });
});
