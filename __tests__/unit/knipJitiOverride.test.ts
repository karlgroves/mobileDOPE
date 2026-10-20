import * as fs from 'fs';
import * as path from 'path';

/**
 * Why `overrides.knip.jiti` exists, and when it may be deleted (#172).
 *
 * knip builds its config loader with `createJiti(process.cwd(), { tsconfigPaths: true })`.
 * Given a *directory*, jiti >= 2.7.0 treats that first argument as a file, so its
 * tsconfig search begins one level up. From a git worktree under
 * `.claude/worktrees/`, searching upward reaches the main checkout's
 * `tsconfig.json`, whose `extends: "expo/tsconfig.base"` cannot resolve while
 * that checkout has no `node_modules` -- and knip dies with
 * `File 'expo/tsconfig.base' not found.` before doing any work. Since
 * `.husky/pre-push` runs `npm run check`, which runs knip, that blocked every
 * push from a worktree.
 *
 * jiti 2.6.1 has no `tsconfigPaths` support at all, so it never performs that
 * search. This repository declares no tsconfig `paths` aliases, so knip loses
 * nothing by using it: with the override in place knip's output is byte-identical.
 *
 * The override is a workaround for someone else's bug, which makes it the kind of
 * thing that outlives its reason silently. These assertions are the reason, made
 * executable: if knip stops passing a bare directory, or stops asking for
 * `tsconfigPaths`, the cause is gone and the override should go with it. A failure
 * here is not a regression -- it is the removal signal.
 */

const ROOT = path.join(__dirname, '../..');

const read = <T>(file: string): T =>
  JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')) as T;

const pkg = read<{ overrides?: Record<string, Record<string, string> | string> }>('package.json');

const KNIP_LOADER = 'node_modules/knip/dist/util/jiti.js';

/**
 * knip's loader source, with runs of whitespace collapsed so the structural
 * checks below do not depend on how the file happens to be formatted.
 *
 * Read from the installed package rather than mocked: the question these tests
 * ask is what the *resolved dependency tree* does, which a fixture cannot answer.
 */
const loaderSource = (): string => {
  const file = path.join(ROOT, KNIP_LOADER);
  if (!fs.existsSync(file)) {
    // Deliberately a failure and not a skip. This file is the only record of why
    // the override exists; a version of it that quietly passes when it cannot
    // see knip would let the override rot unobserved -- the exact failure mode
    // security-thresholds.json calls out for the secret scanner ("a gate that
    // silently skips is not a gate").
    throw new Error(
      `Cannot verify the knip/jiti override: ${KNIP_LOADER} is missing. ` +
        'Run `npm ci` before the test suite.'
    );
  }
  return fs.readFileSync(file, 'utf8').replace(/\s+/g, ' ');
};

describe('the knip/jiti override is still needed', () => {
  it('pins knip to the jiti 2.6 line, which has no tsconfig search', () => {
    const knip = pkg.overrides?.knip;

    expect(typeof knip).toBe('object');
    // `~2.6.1` rather than an exact pin: a 2.6.x patch -- including a security
    // one -- should reach knip, and `~` cannot resolve to 2.7.0, which is the
    // only thing being excluded.
    expect((knip as Record<string, string>).jiti).toBe('~2.6.1');
  });

  it('resolves a 2.6.x jiti for knip', () => {
    const resolved = require.resolve('jiti/package.json', {
      paths: [path.join(ROOT, 'node_modules/knip')],
    });
    const { version } = JSON.parse(fs.readFileSync(resolved, 'utf8')) as { version: string };

    expect(version.startsWith('2.6.')).toBe(true);
  });

  it('still asks jiti for tsconfig paths, which is what triggers the search', () => {
    // When this stops being true, jiti performs no tsconfig lookup regardless of
    // version, and the override has nothing left to prevent. Delete it and this file.
    expect(loaderSource()).toContain('tsconfigPaths: true');
  });

  it('still hands jiti a bare directory, which is what makes the search start a level up', () => {
    // The actual defect: a directory passed where jiti expects a file. If knip
    // switches to a file path or a file:// URL, jiti >= 2.7.0 searches from the
    // right place and the override can go.
    expect(loaderSource()).toContain('createJiti(process.cwd()');
  });
});
