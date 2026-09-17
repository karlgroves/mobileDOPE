import fs from 'fs';
import path from 'path';

/**
 * Every solver call site crosses the distance boundary (#106).
 *
 * The unit tests next door prove the conversion is correct. This proves it is
 * *used*, which is the half that was actually broken: `convertDistance` existed
 * and was correct for the whole life of the bug, and nothing called it.
 *
 * A static sweep, for the same reason the offline-first test uses one: it
 * catches the next call site, not just today's. A behavioural test on the
 * calculator would say nothing about the card generator, and a new screen with
 * a distance input would be added without either noticing.
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

const sources = sourcesUnder(srcDir);

/** Files that call the solver. */
const solverCallers = sources.filter(([, source]) =>
  /\bcalculate(BallisticSolution|Trajectory)\s*\(/.test(source)
);

describe('the solver is only ever handed yards', () => {
  it('finds the call sites, so a broken sweep cannot pass vacuously', () => {
    expect(sources.length).toBeGreaterThan(40);
    expect(solverCallers.length).toBeGreaterThan(2);
  });

  it('gives every screen with a distance unit a way to convert', () => {
    // The precise defect. A screen that offers the user a yards/meters choice
    // and then calls the solver must convert; otherwise the toggle changes the
    // label and nothing else, which is what shipped.
    const offenders = sources
      .filter(([file]) => file.startsWith('screens'))
      .filter(([, source]) => /\bdistanceUnit\b/.test(source))
      .filter(([, source]) => /\bcalculate(BallisticSolution|Trajectory)\s*\(/.test(source))
      .filter(([, source]) => !/\btoSolverYards\s*\(/.test(source))
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });

  /**
   * Modules that mention a distance unit without converting, and why that is
   * correct for them.
   *
   * An allowlist rather than a looser rule, for the reason `NOT_LINKABLE` is one
   * in the linking config: an entry here is a decision someone made, and a
   * missing entry is a bug. A rule relaxed until it stopped complaining would
   * have stopped catching the next `DashboardScreen`.
   */
  const DISPLAY_ONLY: Record<string, string> = {
    'utils/dopeCardComparison.ts':
      'Takes distanceUnit purely as a column label. Its rows arrive already solved, so it never computes with a distance.',
  };

  it('routes every log distance used in a calculation through the converter', () => {
    // A stored log holds its distance in its own unit. Any module computing
    // with `log.distance` directly is reading metres as yards.
    const offenders = sources
      .filter(([file]) => file.startsWith('utils'))
      .filter(([, source]) => /\bdistanceUnit\b/.test(source))
      .filter(([, source]) => !/logDistanceInYards/.test(source))
      .map(([file]) => file)
      .filter((file) => DISPLAY_ONLY[file] === undefined);

    expect(offenders).toEqual([]);
  });

  it('explains every exclusion, and excludes only what it still needs to', () => {
    // A stale entry is as bad as a missing one: it silently exempts a module
    // that has since grown a calculation.
    for (const [file, reason] of Object.entries(DISPLAY_ONLY)) {
      expect(sources.map(([f]) => f)).toContain(file);
      expect(reason.length).toBeGreaterThan(30);
    }

    const unnecessary = Object.keys(DISPLAY_ONLY).filter((file) => {
      const source = sources.find(([f]) => f === file)?.[1] ?? '';
      return /logDistanceInYards/.test(source) || !/\bdistanceUnit\b/.test(source);
    });

    expect(unnecessary).toEqual([]);
  });

  it('has exactly one implementation of the log-distance rule', () => {
    // Two correct copies is how the third one comes to be wrong. This bug and
    // the caliber one (#67) were both duplication before they were arithmetic.
    const implementations = sources.filter(([, source]) =>
      /distanceUnit\s*===\s*'meters'\s*\?\s*metersToYards/.test(source)
    );

    expect(implementations.map(([file]) => file)).toEqual([]);
  });
});
