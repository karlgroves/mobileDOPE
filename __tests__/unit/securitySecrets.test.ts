import { execFileSync, spawnSync } from 'child_process';
import { generateKeyPairSync } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Pins the two properties of the secret-scan gate that are easy to get wrong and
 * invisible when they are (#78).
 *
 * 1. It scans the INDEX, not the working tree. A partially-staged file has to be
 *    scanned as it will be committed, or the gate can be defeated by staging a
 *    secret and then tidying the working copy.
 * 2. It FAILS rather than skips when a staged blob cannot be read. The first
 *    version of this script caught every read error and `continue`d, so an
 *    unreadable file was dropped from the scan and the run still printed
 *    "secret scan clean" -- a gate reporting green without having looked, which
 *    is the defect #78 was about in the first place.
 *
 * These run the real script against a real throwaway repository. Mocking git
 * here would assert only that the script calls the functions it obviously calls;
 * the behaviour worth pinning is what git actually hands back.
 */

const scriptPath = path.resolve(__dirname, '../../scripts/security-secrets.mjs');

/**
 * A real, throwaway RSA private key, generated once per run and never used for
 * anything.
 *
 * It has to be structurally valid: trufflehog's PrivateKey detector parses the
 * key rather than pattern-matching the PEM header and footer. A first attempt put
 * base64 filler between a correct-looking begin/end pair, which reads to a human
 * exactly like a leaked key and is ignored completely by the scanner -- so the
 * test ran its fixture through a gate that had detected nothing and called that a
 * pass.
 *
 * (Writing the header out literally here would also, correctly, trip the
 * `no-secrets` ESLint rule -- which is itself a small demonstration of the point.)
 */
const PRIVATE_KEY = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
}).privateKey.trim();

/** trufflehog is an optional binary; skip rather than fail when it cannot run. */
const trufflehogAvailable = (): boolean => {
  const probe = spawnSync('trufflehog', ['--version'], { stdio: 'ignore' });
  return probe.error === undefined && probe.status === 0;
};

let repo: string;

const git = (...args: string[]): string =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8' });

const runScan = (env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [scriptPath, '--staged'], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'mobiledope-secretscan-test-'));
  git('init', '--quiet');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
});

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe('security-secrets.mjs', () => {
  const maybe = trufflehogAvailable() ? describe : describe.skip;

  it('exits 0 when nothing is staged', () => {
    const result = runScan();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('nothing staged');
  });

  it('refuses to report clean when a staged blob cannot be read', () => {
    // The regression guard for the silent-skip defect. A blob over the read limit
    // used to be dropped from the scan while the run still printed "clean"; it must
    // now fail, and say which file and why.
    fs.writeFileSync(path.join(repo, 'big.ts'), 'export const x = 1;\n'.repeat(200));
    git('add', 'big.ts');

    const result = runScan({ MOBILEDOPE_SECRETSCAN_MAX_BYTES: '64' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Cannot scan staged file for secrets: big.ts');
    expect(result.stderr).toContain('larger than');
    expect(result.stdout).not.toContain('clean');
  });

  maybe('with trufflehog available', () => {
    it('fails on a private key staged for commit', () => {
      fs.writeFileSync(path.join(repo, 'leak.ts'), `export const KEY = \`${PRIVATE_KEY}\`;\n`);
      git('add', 'leak.ts');

      const result = runScan();

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Secret scan found credentials');
    });

    it('passes when the staged content is clean', () => {
      fs.writeFileSync(path.join(repo, 'clean.ts'), 'export const GREETING = "hello";\n');
      git('add', 'clean.ts');

      const result = runScan();

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('secret scan clean');
    });

    it('scans the index, not the working tree', () => {
      // Stage the key, then tidy the working copy. The commit would still carry the
      // key, so the gate must still fail.
      const file = path.join(repo, 'sneaky.ts');
      fs.writeFileSync(file, `export const KEY = \`${PRIVATE_KEY}\`;\n`);
      git('add', 'sneaky.ts');
      fs.writeFileSync(file, 'export const KEY = "redacted";\n');

      const result = runScan();

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Secret scan found credentials');
    });

    it('ignores a secret that is only in the working tree', () => {
      // The mirror of the case above: nothing staged carries the key, so the commit
      // is clean and the gate must not block it.
      const file = path.join(repo, 'draft.ts');
      fs.writeFileSync(file, 'export const KEY = "redacted";\n');
      git('add', 'draft.ts');
      fs.writeFileSync(file, `export const KEY = \`${PRIVATE_KEY}\`;\n`);

      const result = runScan();

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('secret scan clean');
    });
  });
});
