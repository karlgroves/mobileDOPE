import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const jestConfig = require('../../jest.config.js') as {
  collectCoverageFrom: string[];
  coverageThreshold: Record<string, Record<string, number>>;
  projects: { displayName: string; coveragePathIgnorePatterns: string[] }[];
};

/**
 * Guards the per-directory coverage design.
 *
 * `jest.config.js` gates each directory separately and leaves `global` at zero,
 * on the stated grounds that every source file belongs to some named group so
 * nothing lands in `global`. That is true today and nothing enforced it: adding
 * `src/widgets/` at 0% coverage passed the gate silently, because `global` is
 * exactly the floor that gates nothing.
 *
 * These assertions are what makes "nothing is unclassified" a property rather
 * than a snapshot. See issue #28.
 */
const repoRoot = path.resolve(__dirname, '../..');

/** Every source file `collectCoverageFrom` actually instruments. */
const instrumentedFiles = (): string[] => {
  const walk = (dir: string): string[] =>
    fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true }).flatMap((entry) => {
      const relative = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(relative);
      if (!/\.tsx?$/.test(entry.name)) return [];
      // Mirrors every negation in collectCoverageFrom, including the un-dotted
      // `types.ts` form added for #54.
      if (
        entry.name.endsWith('.d.ts') ||
        entry.name.endsWith('.types.ts') ||
        entry.name === 'types.ts'
      ) {
        return [];
      }
      if (relative.includes('__tests__')) return [];
      return [relative];
    });

  return walk('src').sort();
};

const pathGroups = (): string[] =>
  Object.keys(jestConfig.coverageThreshold)
    .filter((key) => key !== 'global')
    .sort();

describe('coverage threshold groups', () => {
  it('declares a global entry', () => {
    expect(jestConfig.coverageThreshold.global).toBeDefined();
  });

  it('gates every instrumented file under a named directory group', () => {
    // The property the design rests on. A file matching no group falls into
    // `global`, which is set to zero -- i.e. it is not gated at all.
    const groups = pathGroups();
    const unmatched = instrumentedFiles().filter(
      (file) => !groups.some((group) => `./${file}`.startsWith(group))
    );

    expect(unmatched).toEqual([]);
  });

  it('finds files to check, so a broken walk cannot pass vacuously', () => {
    expect(instrumentedFiles().length).toBeGreaterThan(50);
    expect(pathGroups().length).toBeGreaterThan(5);
  });

  it('declares a floor for every top-level directory that contributes code', () => {
    // The same property as above, rolled up by directory so a failure names the
    // directory to add rather than a list of files.
    //
    // Directories with no instrumented files are skipped deliberately: `src/types/`
    // holds only `*.types.ts`, which `collectCoverageFrom` excludes, so it cannot
    // be ungated. The file-level assertion above catches the moment that changes.
    const contributing = new Set(
      instrumentedFiles().map((file) => `./${file.split(path.sep).slice(0, 2).join('/')}/`)
    );

    const groups = pathGroups();
    const ungated = [...contributing].filter(
      (dir) => !groups.some((group) => group.startsWith(dir))
    );

    expect(ungated.sort()).toEqual([]);
  });

  it('instruments every source file in exactly one jest project', () => {
    // The #54 regression guard, and the reason `coveragePathIgnorePatterns` exists on
    // both projects.
    //
    // `collectCoverageFrom` is a root-level option, so without these patterns BOTH
    // projects instrument every file under `src/` -- `unit` through ts-jest,
    // `components` through jest-expo's babel pipeline. Jest merges the two entries for
    // the same file but keeps only the first one's `inputSourceMap`, and which arrives
    // first depends on which project's test result finishes first. `src/store/` swung
    // between 93.39% and 87.17% statements on identical code as a result.
    //
    // A file owned by two projects brings the flake back; a file owned by none silently
    // stops being measured. Both are failures here.
    const owners = (file: string): string[] =>
      jestConfig.projects
        .filter(
          (project) =>
            !project.coveragePathIgnorePatterns.some((pattern) =>
              new RegExp(pattern.replace('<rootDir>', repoRoot)).test(path.join(repoRoot, file))
            )
        )
        .map((project) => project.displayName);

    const wrong = instrumentedFiles()
      .map((file) => ({ file, owners: owners(file) }))
      .filter((entry) => entry.owners.length !== 1);

    expect(wrong).toEqual([]);
  });

  it('excludes type-only modules from coverage collection', () => {
    // `src/navigation/types.ts` is 21 type and interface declarations and no runtime
    // statements, so it compiles to an empty module: one transformer emits a coverage
    // entry for it and the other emits none, and it flickered in and out of the report.
    // It has nothing to cover, and `!src/**/*.types.ts` does not match it -- there is no
    // dot before `types` -- so the un-dotted form is excluded too (#54).
    const patterns = jestConfig.collectCoverageFrom;
    expect(patterns).toContain('!src/**/*.types.ts');
    expect(patterns).toContain('!src/**/types.ts');
  });

  it('collects no file that has no runtime statements', () => {
    // The general form of the rule above: an instrumented file with no runtime
    // declarations is a type module that should have been excluded.
    const typeOnly = instrumentedFiles().filter((file) => {
      const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
      const runtime = /^\s*(export\s+)?(const|let|var|function|class|enum)\s/m.test(source);
      // Barrel files re-export rather than declare: `export * from './x'` and
      // `export { X } from './x'` both emit runtime code.
      const reExport = /^\s*export\s+[*{]/m.test(source);
      return !runtime && !reExport;
    });

    expect(typeOnly).toEqual([]);
  });

  it('sets every floor to a number between 0 and 100', () => {
    for (const [group, floors] of Object.entries(jestConfig.coverageThreshold)) {
      for (const [metric, value] of Object.entries(floors)) {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
        expect(`${group}.${metric}`).toBeTruthy();
      }
    }
  });
});
