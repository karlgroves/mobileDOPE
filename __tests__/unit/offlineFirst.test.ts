import fs from 'fs';
import path from 'path';

import { isLocalFileUri } from '../../src/services/importGuards';

/**
 * The app does not talk to the network (#68, "test offline mode functionality").
 *
 * `PRIVACY.md` and `CLAUDE.md` both state it plainly: *"The app has no network
 * layer: there is no `fetch` to any remote host anywhere in `src/`."* That is a
 * promise made to users about where their shooting data goes, and nothing
 * enforced it. It was true because everyone had been careful, which is not the
 * same as it staying true.
 *
 * Two halves, because neither is sufficient alone:
 *
 * 1. A **static** sweep of `src/`, which catches a new call site being added.
 * 2. A **behavioural** check on the one call site that does exist, which catches
 *    that same call site being handed a remote URI at runtime.
 *
 * The static half alone would pass while the app fetched from anywhere the
 * document picker pointed it; the behavioural half alone would pass while
 * somebody added a second, unrelated network call.
 */

const srcDir = path.resolve(__dirname, '../../src');

/** Every .ts/.tsx source under a directory, as [relative path, contents]. */
const sourcesUnder = (dir: string, base = dir): [string, string][] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourcesUnder(full, base);
    if (!/\.tsx?$/.test(entry.name)) return [];
    return [[path.relative(base, full), fs.readFileSync(full, 'utf8')] as [string, string]];
  });

/** Strips comments, so a URL in prose is not mistaken for a call. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the app has no network layer', () => {
  const sources = sourcesUnder(srcDir);

  it('reads enough files to be meaningful', () => {
    // Guards the guard. A sweep that silently walked an empty directory would
    // pass every assertion below and prove nothing.
    expect(sources.length).toBeGreaterThan(40);
  });

  it('imports no HTTP client', () => {
    const offenders = sources.filter(([, source]) =>
      /from\s+['"](axios|superagent|node-fetch|got|ky|undici)['"]/.test(withoutComments(source))
    );

    expect(offenders.map(([file]) => file)).toEqual([]);
  });

  it('opens no socket', () => {
    const offenders = sources.filter(([, source]) =>
      /\bnew\s+(WebSocket|XMLHttpRequest|EventSource)\b/.test(withoutComments(source))
    );

    expect(offenders.map(([file]) => file)).toEqual([]);
  });

  it('has exactly one fetch call site, and it is the file importer', () => {
    // Pinned by name rather than counted. A count would let someone remove this
    // one and add a different one without the test noticing.
    const offenders = sources.filter(([, source]) =>
      /(?<![.\w])fetch\s*\(/.test(withoutComments(source))
    );

    expect(offenders.map(([file]) => file)).toEqual([path.join('services', 'ImportService.ts')]);
  });

  it('hard-codes no remote host', () => {
    const offenders = sources
      .map(([file, source]) => [file, withoutComments(source)] as [string, string])
      .filter(([, source]) => /['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/.test(source));

    expect(offenders.map(([file]) => file)).toEqual([]);
  });
});

describe('isLocalFileUri', () => {
  /**
   * The behavioural half. The importer fetches whatever URI the document picker
   * hands it; on device that is a local cache path, because the picker is asked
   * to copy the file there. Nothing checked.
   */

  it('accepts the schemes a document picker actually returns', () => {
    expect(isLocalFileUri('file:///var/mobile/Containers/Data/tmp/backup.json')).toBe(true);
    expect(isLocalFileUri('content://com.android.providers.downloads/document/42')).toBe(true);
  });

  it('accepts a bare path, which is what the mock file system uses', () => {
    expect(isLocalFileUri('/test-cache/backup.json')).toBe(true);
  });

  it('accepts a bare path that happens to contain a colon', () => {
    // The reverse of the mistake below. A colon in a file name does not make a
    // scheme, and refusing this would refuse a genuinely local file.
    expect(isLocalFileUri('/var/mobile/tmp/notes: draft.json')).toBe(true);
    expect(isLocalFileUri('./relative/a:b.json')).toBe(true);
  });

  it('rejects anything that would leave the device', () => {
    expect(isLocalFileUri('http://example.com/backup.json')).toBe(false);
    expect(isLocalFileUri('https://example.com/backup.json')).toBe(false);
    expect(isLocalFileUri('ftp://example.com/backup.json')).toBe(false);
    expect(isLocalFileUri('ws://example.com')).toBe(false);
  });

  it('is not fooled by a remote URI dressed up as a local one', () => {
    // The mistakes a substring check would make. Each of these is a real host.
    expect(isLocalFileUri('http://file.example.com/backup.json')).toBe(false);
    expect(isLocalFileUri('https://example.com/file://backup.json')).toBe(false);
    expect(isLocalFileUri('https://example.com/?x=content://')).toBe(false);
  });

  it('is not fooled by case or leading whitespace', () => {
    expect(isLocalFileUri('  HTTPS://example.com/x.json')).toBe(false);
    expect(isLocalFileUri('FILE:///tmp/backup.json')).toBe(true);
  });

  it('rejects a missing or empty uri rather than treating it as local', () => {
    expect(isLocalFileUri(undefined)).toBe(false);
    expect(isLocalFileUri('')).toBe(false);
    expect(isLocalFileUri('   ')).toBe(false);
  });

  it('rejects a data: uri', () => {
    // Does not leave the device, but it is not a file the picker produced, and
    // an unbounded data: uri is a memory-exhaustion primitive of its own.
    expect(isLocalFileUri('data:application/json;base64,e30=')).toBe(false);
  });
});
