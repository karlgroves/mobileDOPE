#!/usr/bin/env node
/**
 * Secret scanning, via trufflehog.
 *
 * Replaces gitleaks, which this repo was wired to but which is not the tool used
 * here. See issue #78.
 *
 * Two modes, because the hooks want different things:
 *
 *   --staged    what is about to be committed. Materialises the staged blobs into
 *               a temp directory and scans that, so the scan sees exactly the
 *               content git would record -- not the working tree, which may hold
 *               unstaged edits, and not the diff, which loses file context the
 *               detectors use.
 *   --history   the whole repository history. What a push would publish.
 *
 * ## Two things this script exists to get right
 *
 * **1. Executability, not presence.** The gitleaks wiring gated on
 * `command -v gitleaks`, which only asks whether a file exists and carries the
 * executable bit. On this machine it did: an ELF x86-64 Linux binary sitting in
 * /usr/local/bin on an arm64 Mac. Every hook took the "installed" branch, ran it,
 * got exit 126, and blocked the commit with an error naming the wrong cause.
 * `scripts/bootstrap.sh` made the same assumption and so declined to reinstall it.
 * This asks the binary to actually run.
 *
 * **2. No results filter.** trufflehog's `--results` flag takes `verified` and
 * `unknown`, and `unknown` does NOT mean "unverified" -- it means verification
 * failed with an error. `--results=verified,unknown` therefore EXCLUDES ordinary
 * unverified findings, while reading as though it includes them. Measured against
 * a throwaway RSA private key:
 *
 *   --only-verified                 missed it, exit 0
 *   --results=verified,unknown      missed it, exit 0
 *   (no filter)                     found it, exit 183
 *
 * A pre-commit gate has to catch the key whether or not trufflehog can phone the
 * issuing service to confirm it is live -- offline, or for a detector with no
 * verifier, "unverified" is the normal case. So: no filter. The cost is that
 * false positives block, which is the right way round for this gate; add a path
 * exclusion deliberately if one is ever warranted.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** trufflehog exits 183 when `--fail` is set and it found something. */
const FINDINGS_EXIT = 183;

const mode = process.argv.includes('--staged') ? 'staged' : 'history';

/**
 * True only if trufflehog is present AND can execute on this machine.
 *
 * `command -v` cannot tell the difference; running it can. See the header.
 */
const trufflehogRuns = () => {
  const probe = spawnSync('trufflehog', ['--version'], { stdio: 'ignore' });
  return probe.error === undefined && probe.status === 0;
};

if (!trufflehogRuns()) {
  const skipped = process.env.SKIP_SECRET_SCAN === '1';
  if (skipped) {
    console.error('⚠  SECRET SCAN SKIPPED — trufflehog cannot run and SKIP_SECRET_SCAN=1.');
    console.error('⚠  Nothing checked this change for credentials.');
    process.exit(0);
  }
  console.error('✖ trufflehog is not installed, or cannot execute on this machine,');
  console.error('  so this change cannot be scanned for secrets.');
  console.error('');
  console.error('  Install it:      ./scripts/bootstrap.sh');
  console.error('  Check it runs:   trufflehog --version');
  console.error('  Or, knowingly:   SKIP_SECRET_SCAN=1 git commit ...');
  process.exit(1);
}

/**
 * Writes every staged blob into a temp directory, preserving paths.
 *
 * Reads the blobs out of the index (`git show :path`) rather than off disk, so
 * partially-staged files are scanned as staged rather than as they look in the
 * working tree. Returns null when nothing is staged.
 */
const materialiseStaged = () => {
  const names = execFileSync(
    'git',
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    }
  )
    .split('\0')
    .filter(Boolean);

  if (names.length === 0) return null;

  const dir = mkdtempSync(path.join(os.tmpdir(), 'mobiledope-secretscan-'));
  for (const name of names) {
    let blob;
    try {
      blob = execFileSync('git', ['show', `:${name}`], {
        cwd: repoRoot,
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch {
      // Unreadable from the index (a submodule, say). Nothing to scan.
      continue;
    }
    const target = path.join(dir, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, blob);
  }
  return dir;
};

/** Runs trufflehog and returns its exit status, streaming output through. */
const scan = (args) =>
  spawnSync('trufflehog', [...args, '--fail', '--no-update'], {
    cwd: repoRoot,
    stdio: 'inherit',
  }).status;

let status;
let scratch = null;

try {
  if (mode === 'staged') {
    scratch = materialiseStaged();
    if (scratch === null) {
      console.log('ℹ nothing staged — secret scan skipped');
      process.exit(0);
    }
    status = scan(['filesystem', scratch]);
  } else {
    status = scan(['git', `file://${repoRoot}`]);
  }
} finally {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
}

if (status === FINDINGS_EXIT) {
  console.error('');
  console.error('✖ Secret scan found credentials in the content above.');
  console.error('  Remove them and rewrite the history that carries them — a secret that');
  console.error('  reached a commit must be rotated whether or not the commit is pushed.');
  process.exit(1);
}

if (status !== 0) {
  console.error(`✖ trufflehog exited ${status} (not a findings exit). Treating as a failure.`);
  process.exit(1);
}

console.log(`✓ secret scan clean (${mode})`);
