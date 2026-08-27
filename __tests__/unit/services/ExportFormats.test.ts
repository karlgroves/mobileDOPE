import * as Sharing from 'expo-sharing';

import { AmmoProfile } from '../../../src/models/AmmoProfile';
import { DOPELog } from '../../../src/models/DOPELog';
import { EnvironmentSnapshot } from '../../../src/models/EnvironmentSnapshot';
import { RangeSession } from '../../../src/models/RangeSession';
import { RifleProfile } from '../../../src/models/RifleProfile';
import {
  exportAllRifleProfilesJSON,
  exportAmmoProfileJSON,
  exportDOPELogsCSV,
  exportDOPELogsJSON,
  exportRifleProfileJSON,
  exportSessionReportJSON,
  exportSessionReportMarkdown,
} from '../../../src/services/ExportService';
import {
  validAmmo,
  validDopeLog,
  validEnvironment,
  validRangeSession,
  validRifle,
} from '../../helpers/fixtures';
import { readWritten, resetFileSystem } from '../../helpers/mockFileSystem';

jest.mock('expo-file-system', () => require('../../helpers/mockFileSystem'));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
// expo-print ships ESM, which the ts-jest/node `unit` project cannot parse.
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(async () => ({ uri: 'file:///test-cache/print.pdf' })),
}));

/**
 * The non-JSON-backup export formats.
 *
 * Export is the only path by which data leaves this device, and until now only the
 * full-backup JSON path was covered -- the CSV and Markdown writers, and the
 * per-profile JSON exporters, were untested. See issue #28 phases 2-4, and the
 * priority note in that thread from the #44 privacy audit.
 */
const read = (uri: string | undefined) => readWritten(uri as string) as string;

/**
 * Split a CSV row on field separators only, ignoring commas inside quoted cells.
 * Naive `split(',')` cannot tell the two apart, which is the whole point of the
 * quoting being tested here. Empty cells are emitted unquoted, so a
 * `split('","')` count does not work either.
 */
const csvFields = (row: string): string[] => {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
};

const rifle = () => new RifleProfile({ ...validRifle({ name: 'Tikka T3x' }), id: 1 });
const ammo = () => new AmmoProfile({ ...validAmmo({ name: '175gr SMK' }), id: 2 });
const log = (overrides = {}) =>
  new DOPELog({
    ...validDopeLog({ rifleId: 1, ammoId: 2, environmentId: 3 }, overrides),
    id: 10,
  });

describe('exportDOPELogsCSV', () => {
  beforeEach(() => {
    resetFileSystem();
    jest.clearAllMocks();
  });

  it('writes a header row and one row per log', () => {
    return exportDOPELogsCSV([log(), log({ distance: 800 })], [rifle()], [ammo()]).then(
      (result) => {
        expect(result.success).toBe(true);

        const lines = read(result.uri).split('\n');
        expect(lines).toHaveLength(3);
        expect(lines[0]).toContain('Distance');
      }
    );
  });

  it('resolves rifle and ammo names rather than emitting bare ids', async () => {
    const result = await exportDOPELogsCSV([log()], [rifle()], [ammo()]);

    const body = read(result.uri).split('\n')[1] as string;
    expect(body).toContain('Tikka T3x');
    expect(body).toContain('175gr SMK');
  });

  it('quotes every cell so a comma in a name cannot shift the columns', async () => {
    const result = await exportDOPELogsCSV([log({ notes: 'windy, gusting' })], [rifle()], [ammo()]);

    const [header, body] = read(result.uri).split('\n') as [string, string];
    expect(body).toContain('"windy, gusting"');

    // The comma inside the note must not add a field: the row has to keep exactly
    // as many fields as the header, and the note must survive intact.
    const fields = csvFields(body);
    expect(fields).toHaveLength(csvFields(header).length);
    expect(fields[fields.length - 1]).toBe('windy, gusting');
    // A naive parser would see more fields -- which is what the quoting prevents.
    expect(body.split(',').length).toBeGreaterThan(fields.length);
  });

  it('escapes embedded quotes by doubling them', async () => {
    const result = await exportDOPELogsCSV([log({ notes: 'called "good"' })], [rifle()], [ammo()]);

    expect(read(result.uri)).toContain('"called ""good"""');
  });

  it('defuses spreadsheet formula injection in free text', async () => {
    // A note beginning `=` or `+` is executed on open by Excel, Numbers and Sheets.
    const result = await exportDOPELogsCSV(
      [log({ notes: '=HYPERLINK("http://evil","click")' })],
      [rifle()],
      [ammo()]
    );

    const csv = read(result.uri);
    expect(csv).toContain('"\'=HYPERLINK');
    expect(csv).not.toContain(',"=HYPERLINK');
  });

  it.each(['=cmd', '+1', '-1', '@SUM'])('prefixes the formula trigger %s', async (note) => {
    const result = await exportDOPELogsCSV([log({ notes: note })], [rifle()], [ammo()]);

    expect(read(result.uri)).toContain(`"'${note}"`);
  });

  it('emits an empty cell for a missing value rather than "undefined"', async () => {
    const result = await exportDOPELogsCSV([log({ notes: undefined })], [rifle()], [ammo()]);

    expect(read(result.uri)).not.toContain('undefined');
  });

  it('writes a header-only file when there are no logs', async () => {
    const result = await exportDOPELogsCSV([], [], []);

    expect(result.success).toBe(true);
    expect(read(result.uri).split('\n')).toHaveLength(1);
  });

  it('offers the file to the share sheet as text/csv', async () => {
    await exportDOPELogsCSV([log()], [rifle()], [ammo()]);

    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringContaining('.csv'),
      expect.objectContaining({ mimeType: 'text/csv' })
    );
  });

  it('still reports success when sharing is unavailable', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);

    const result = await exportDOPELogsCSV([log()], [rifle()], [ammo()]);

    expect(result.success).toBe(true);
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});

describe('profile and log JSON exporters', () => {
  beforeEach(() => {
    resetFileSystem();
    jest.clearAllMocks();
  });

  it('exportRifleProfileJSON writes the profile', async () => {
    const result = await exportRifleProfileJSON(rifle());

    expect(result.success).toBe(true);
    expect(read(result.uri)).toContain('Tikka T3x');
  });

  it('exportAmmoProfileJSON writes the profile', async () => {
    const result = await exportAmmoProfileJSON(ammo());

    expect(result.success).toBe(true);
    expect(read(result.uri)).toContain('175gr SMK');
  });

  it('exportAllRifleProfilesJSON writes every profile', async () => {
    const second = new RifleProfile({ ...validRifle({ name: 'Bergara B14' }), id: 2 });

    const result = await exportAllRifleProfilesJSON([rifle(), second]);

    const written = read(result.uri);
    expect(written).toContain('Tikka T3x');
    expect(written).toContain('Bergara B14');
  });

  it('exportDOPELogsJSON writes valid JSON', async () => {
    const result = await exportDOPELogsJSON([log()]);

    expect(() => JSON.parse(read(result.uri))).not.toThrow();
  });

  it('handles an empty collection without failing', async () => {
    const result = await exportAllRifleProfilesJSON([]);

    expect(result.success).toBe(true);
  });
});

describe('session report exporters', () => {
  const ids = { rifleId: 1, ammoId: 2, environmentId: 3 };
  const session = () =>
    new RangeSession({ ...validRangeSession(ids, { sessionName: 'Spring Match' }), id: 5 });
  const environment = () => new EnvironmentSnapshot({ ...validEnvironment(), id: 3 });

  beforeEach(() => {
    resetFileSystem();
    jest.clearAllMocks();
  });

  it('writes a Markdown report naming the session, rifle and ammo', async () => {
    const result = await exportSessionReportMarkdown(session(), rifle(), ammo(), environment());

    expect(result.success).toBe(true);
    const md = read(result.uri);
    expect(md).toContain('Spring Match');
    expect(md).toContain('Tikka T3x');
    expect(md).toContain('175gr SMK');
  });

  it('sanitises the session name into the filename', async () => {
    const named = new RangeSession({
      ...validRangeSession(ids, { sessionName: 'Spring/Match #1' }),
      id: 5,
    });

    const result = await exportSessionReportMarkdown(named, rifle(), ammo(), environment());

    expect(result.uri).not.toContain('/Match');
    expect(result.uri).toMatch(/range_session_Spring_Match__1_\d+\.md$/);
  });

  it('renders a report when rifle, ammo and environment are all absent', async () => {
    // The session screen allows starting without a full setup, so the exporter has
    // to tolerate nulls rather than emitting "undefined" into the document.
    const result = await exportSessionReportMarkdown(session(), null, null, null);

    expect(result.success).toBe(true);
    expect(read(result.uri)).not.toContain('undefined');
  });

  it('writes a JSON report that parses', async () => {
    const result = await exportSessionReportJSON(session(), rifle(), ammo(), environment());

    expect(result.success).toBe(true);
    expect(() => JSON.parse(read(result.uri))).not.toThrow();
  });

  it('offers the Markdown report as text/markdown', async () => {
    await exportSessionReportMarkdown(session(), rifle(), ammo(), environment());

    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringContaining('.md'),
      expect.objectContaining({ mimeType: 'text/markdown' })
    );
  });
});
