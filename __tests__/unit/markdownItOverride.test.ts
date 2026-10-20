import * as fs from 'fs';
import * as path from 'path';

/**
 * Why `overrides["markdown-it"]` exists, and when it may be deleted.
 *
 * `markdown-it` reaches this repository through exactly one consumer,
 * `markdownlint-cli2`, which uses it to parse Markdown while linting. It is a
 * development dependency: `npm ls markdown-it --omit=dev` is empty, and nothing
 * in `src/` renders Markdown.
 *
 * Two high advisories had to be cleared:
 *
 * - GHSA-r7fv-28h4-cvq7 -- quadratic complexity in smartquotes with unmatched
 *   closing quotes. Affected `>=15.0.0 <15.0.2` (and the whole 14.x line).
 * - GHSA-gfr2-rv44-r23c -- quadratic-time rendering of a single multi-line link
 *   reference definition with default options. Affected `<15.0.3`.
 *
 * The trap is that bumping `markdownlint-cli2` is not sufficient on its own. Its
 * 0.23.3 release moves `markdown-it` from 14.3.0 to 15.0.1, which is inside the
 * 15.x window of both advisories, so the audit gate stays red at a *different*
 * version. 15.0.3 is the first release clear of both, and `markdownlint-cli2`
 * pins `markdown-it` exactly, so nothing short of an override reaches it.
 *
 * The override is therefore a workaround for an upstream pin, which makes it the
 * kind of thing that outlives its reason silently. These assertions are the
 * reason, made executable: when `markdownlint-cli2` pins a `markdown-it` that is
 * already clear of the advisories, the cause is gone and the override should go
 * with it. A failure here is not a regression -- it is the removal signal.
 *
 * Written in the idiom of `knipJitiOverride.test.ts` (#172), which established
 * this practice for `overrides.knip.jiti`.
 */

const ROOT = path.join(__dirname, '../..');

/** The first `markdown-it` release clear of both advisories above. */
const FIRST_PATCHED = [15, 0, 3] as const;

const read = <T>(file: string): T =>
  JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')) as T;

const pkg = read<{ overrides?: Record<string, Record<string, string> | string> }>('package.json');

/**
 * Compare two dotted numeric versions.
 *
 * @param a - Left version, e.g. `15.0.1`.
 * @param b - Right version as a numeric tuple.
 * @returns Negative when `a` precedes `b`, 0 when equal, positive when after.
 */
const compare = (a: string, b: readonly number[]): number => {
  const left = a.split('.').map(Number);
  for (let i = 0; i < b.length; i += 1) {
    const diff = (left[i] ?? 0) - b[i];
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
};

/**
 * A package's installed manifest.
 *
 * Read from `node_modules` rather than mocked: the question these tests ask is
 * what the *resolved dependency tree* does, which a fixture cannot answer.
 * A missing package is a failure and not a skip -- this file is the only record
 * of why the override exists, and a version of it that quietly passes when it
 * cannot see the tree would let the override rot unobserved.
 */
const manifest = (name: string): { version: string; dependencies?: Record<string, string> } => {
  const file = path.join(ROOT, 'node_modules', name, 'package.json');
  if (!fs.existsSync(file)) {
    throw new Error(
      `${name} is not installed, so this guard cannot check whether the ` +
        'markdown-it override is still needed. Install dependencies and re-run; ' +
        'do not delete this file to make it quiet.'
    );
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as {
    version: string;
    dependencies?: Record<string, string>;
  };
};

describe('the markdown-it override is still needed', () => {
  it('pins markdown-it to the first release clear of both advisories', () => {
    // `~15.0.3` rather than `^` or an exact pin, for the reason #172 gives for
    // `~2.6.1`: a later 15.0.x patch -- including a security one -- should still
    // reach the linter, which matters in a repository that keeps a formal waiver
    // register. `^` is the wrong choice in the other direction: markdownlint-cli2
    // pins markdown-it *exactly*, so it is not tested against 15.1.0, and `~`
    // cannot resolve there.
    expect(pkg.overrides?.['markdown-it']).toBe('~15.0.3');
  });

  it('resolves a markdown-it at or above the patched version', () => {
    // The override having an effect is a separate question from it being declared.
    expect(compare(manifest('markdown-it').version, FIRST_PATCHED)).toBeGreaterThanOrEqual(0);
  });

  it('is still reached only through markdownlint-cli2', () => {
    // The override is written top-level, so it would silently apply to any future
    // consumer too. While there is exactly one, its blast radius is knowable;
    // if a second appears, this reasoning needs revisiting rather than inheriting.
    const dependency = manifest('markdownlint-cli2').dependencies?.['markdown-it'];

    expect(dependency).toBeDefined();
  });

  it('is still pinned by markdownlint-cli2 to a version inside the advisories', () => {
    // The actual cause: markdownlint-cli2 pins markdown-it exactly, and that pin
    // is below 15.0.3. When it reaches 15.0.3 or later on its own, the override
    // no longer changes anything -- delete it and this file.
    const pinned = manifest('markdownlint-cli2').dependencies?.['markdown-it'] ?? '';

    expect(pinned).toMatch(/^\d+\.\d+\.\d+$/);
    expect(compare(pinned, FIRST_PATCHED)).toBeLessThan(0);
  });
});
