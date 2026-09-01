// Two Jest projects, because the two test layers need different transformers.
//
// - `unit` runs the pure-TypeScript tests (ballistic math, models, utils) through
//   ts-jest in a node environment. This is the long-standing setup and stays as it was.
// - `components` renders React Native components, which needs the jest-expo preset
//   (RN transform, expo module mocks, react-native testEnvironment). ts-jest in a node
//   environment cannot do it -- it fails on the first `import` of `react-native`.
//
// jest-expo requires jest 29 (it depends on jest 29 internals), which is why the
// dependency alignment in ADR-012 had to land before this file could be wired up.
// See issue #28 phase 5.
//
// ---------------------------------------------------------------------------------
//
// COVERAGE OWNERSHIP: exactly one project instruments each source file (#54).
//
// `collectCoverageFrom` is a root-level option, so before this split BOTH projects
// instrumented every file under `src/` -- the `unit` project through ts-jest, the
// `components` project through jest-expo's babel pipeline. The two transformers emit
// different code, so istanbul builds a different statement/branch/function map for the
// same source, in the coordinates of that project's own output.
//
// Jest merges the two into one entry per file (`CoverageMap.addFileCoverage` ->
// `FileCoverage.merge`), which unions the position maps but keeps only the FIRST
// entry's `inputSourceMap`. Which entry lands first is whichever project's test result
// arrives first -- so the source map used to remap the merged positions back to the
// original `.ts` changed from run to run, and with it the denominator.
//
// `src/store/useAppStore.ts` is the only file both projects actually EXECUTE (a
// component test reaches it through the theme), and it is what flaked: 49 statements
// all covered when the ts-jest map won, 71 statements with 55 covered when the babel
// map did. That moved `src/store/` between 198/212 = 93.39% and 204/234 = 87.17% --
// exactly the two readings in #54 -- while the tests themselves were identical.
//
// Splitting ownership removes the merge entirely: `components` owns the three
// directories its suites render, `unit` owns everything else. Nothing is instrumented
// twice, so nothing depends on which project finishes first. It is also the honest
// attribution -- a file is now measured by the transformer that actually ran it.
const COMPONENT_OWNED = '<rootDir>/src/(components|contexts|constants)/';
const NODE_MODULES = '/node_modules/';

const unit = {
  displayName: 'unit',
  preset: 'ts-jest',
  // See COVERAGE OWNERSHIP above: everything except the component-rendered directories.
  coveragePathIgnorePatterns: [NODE_MODULES, COMPONENT_OWNED],
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // `security/tests/` runs in this project too: the security regression suite is
  // plain TypeScript with no renderer, and keeping it inside `npm test` is what
  // makes it a gate rather than an opt-in script. See issue #45 item 8.
  testMatch: [
    '**/__tests__/unit/**/*.(test|spec).(ts|tsx|js)',
    '**/security/tests/**/*.(test|spec).(ts|tsx)',
  ],
  testPathIgnorePatterns: [NODE_MODULES, '/android/', '/ios/'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react',
        },
      },
    ],
  },
};

const components = {
  displayName: 'components',
  preset: 'jest-expo',
  // See COVERAGE OWNERSHIP above: only the directories these suites render. The
  // negative lookahead is the complement of `unit`'s pattern, so the two partition
  // `src/` with no file in both and none in neither.
  coveragePathIgnorePatterns: [NODE_MODULES, '<rootDir>/src/(?!components/|contexts/|constants/)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/components/**/*.(test|spec).(ts|tsx)'],
  testPathIgnorePatterns: [NODE_MODULES, '/android/', '/ios/'],
  // jest.setup.js supplies the expo-sqlite / AsyncStorage mocks these components need.
  // It existed but was never referenced by any config before this change, so it had
  // never run.
  setupFiles: ['<rootDir>/jest.setup.js'],
};

module.exports = {
  projects: [unit, components],
  // Coverage is configured at the root so `jest --coverage` reports across both projects.
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.types.ts',
    // Also the un-dotted form, which `!src/**/*.types.ts` does not match -- there is no
    // dot before `types`. `src/navigation/types.ts` is 21 type and interface
    // declarations and zero runtime statements, so it compiles to an empty module: one
    // transformer emits a coverage entry for it and the other emits none, which made it
    // appear and disappear between runs. It has no statements, lines, functions or
    // branches, so it never moved a percentage -- but a file that flickers in and out of
    // the report is noise, and a type-only module has nothing to cover in the first
    // place. Excluding it is hygiene, not the #54 fix; see COVERAGE OWNERSHIP above for
    // that.
    '!src/**/types.ts',
    '!src/**/__tests__/**',
  ],
  // PER-DIRECTORY RATCHETS, not targets (#28).
  //
  // This replaces the single merged `global` floor, which was not a meaningful gate.
  // Coverage merged across the `unit` and `components` projects moves for reasons
  // unrelated to test quality: the two projects instrument the same source with
  // different denominators, so adding component tests dilutes the unit figure and
  // vice versa. A number that goes up while risk stays flat -- or drops while tests
  // are added -- cannot be ratcheted honestly. It also averaged `src/utils/` at ~90%
  // against `src/screens/` at 0%, hiding both.
  //
  // Every directory now carries its own floor, so a regression is attributed to the
  // layer that caused it. `global` covers nothing -- that is deliberate, not an
  // oversight: only files matching NO path group fall into it, and there is no
  // unclassified source left. Adding a new top-level directory under `src/` means
  // adding its floor here.
  //
  // Floors are the integer below actual, dropped one further where that leaves under
  // ~0.5pp of headroom, so landing a feature slightly ahead of its tests does not
  // break the build while a real regression does.
  //
  // ONLY EVER RAISE THESE.
  //
  // `npm run test:coverage` clears `coverage/` before running, because a stale
  // directory left by a `--selectProjects` or single-file run reports lower figures
  // and would set the floors too loose. That used to be a comment asking you to
  // remember; it is now in the script.
  //
  // `__tests__/unit/coverageThresholds.test.ts` asserts the property this design
  // rests on: that every instrumented file belongs to one of the named groups
  // below. Without it, a new top-level directory falls into `global` -- which is
  // zero, so it is not gated at all -- and the gate stays green.
  //
  // Figures below are as measured after the #54 coverage-ownership split, and are
  // reproducible: 20 consecutive `rm -rf coverage && npm run test:coverage` runs
  // produce a byte-identical per-file report. Several rose against the pre-#54 table
  // without a test being written, because a file is no longer counted twice with two
  // different statement maps -- see COVERAGE OWNERSHIP at the top of this file.
  //
  // A group's figure is the sum over the files beneath it, and jest counts a file in
  // EVERY threshold path it sits under, not just the most specific one -- so
  // `./src/services/` includes `database/` and `database/migrations/`.
  //
  //   directory                      s      b      l      f     state
  //   utils                        90.5   77.3   90.1   87.5   ballistic math, done
  //   store                        92.9   86.6   94.1   92.3   #28 phase 3
  //   models                       86.7   82.6   86.7   84.7   #28 phase 4, mostly done
  //   services/database            77.2   79.1   78.5   81.0   repositories high, runner low
  //   services                     72.7   59.1   73.2   75.7   CSV/Markdown covered; PDF 0%
  //   contexts                     83.3   50.0   83.3   66.6   incidental, via components
  //   components                   27.0   31.8   27.5   28.5   8 of ~20 suites
  //   constants                    18.3    9.0   23.6    3.4   data tables
  //   screens / navigation / hooks  0      0      0      0     #28 phase 6, not started
  //
  // Next targets, in cost order: the PDF exporters (expo-print ships ESM, which the
  // ts-jest/node `unit` project cannot parse -- they need the `components` project
  // or a transform allowlist), MigrationRunner, then screens.
  coverageThreshold: {
    // Empty by construction: every instrumented file matches one of the groups
    // below, which `__tests__/unit/coverageThresholds.test.ts` enforces. Left
    // declared because jest requires it and because a zero here is a deliberate
    // statement -- anything reaching `global` is ungated, and that test is what
    // makes sure nothing does.
    global: { branches: 0, functions: 0, lines: 0, statements: 0 },

    './src/utils/': { branches: 76, functions: 86, lines: 89, statements: 89 },
    // The store, contexts, components and constants floors were dropped below their
    // observed worst case by #48, as a stopgap while the coverage numbers moved
    // between runs. #54 fixed the cause -- `src/store/useAppStore.ts` was instrumented
    // by BOTH jest projects and the merged entry was remapped through whichever
    // project's source map arrived first, swinging `src/store/` between 198/212 =
    // 93.39% and 204/234 = 87.17% statements. See COVERAGE OWNERSHIP at the top of
    // this file.
    //
    // They are back at their pre-#48 values. Every one now sits below a figure that 20
    // consecutive clean runs reproduce exactly. The readings in the table above are
    // higher still for the groups the split un-diluted; ratcheting up to them is a
    // separate, deliberate step, not a side effect of a bug fix.
    './src/store/': { branches: 82, functions: 91, lines: 93, statements: 92 },
    './src/models/': { branches: 79, functions: 82, lines: 84, statements: 84 },
    './src/services/database/': { branches: 76, functions: 69, lines: 63, statements: 59 },
    './src/services/': { branches: 56, functions: 66, lines: 63, statements: 61 },
    './src/contexts/': { branches: 48, functions: 38, lines: 75, statements: 65 },
    './src/components/': { branches: 19, functions: 15, lines: 17, statements: 13 },
    './src/constants/': { branches: 6, functions: 1, lines: 12, statements: 9 },

    // Not yet started. Declared at 0 so they are visible in this table rather than
    // invisible inside a merged average, and so the first test written for them can
    // raise a floor that means something.
    // Raised from 0 by #52's migration suites. Branches stays at 0: the migration
    // files are almost entirely SQL string literals with no conditionals in them,
    // so there is nothing to branch on and the metric is not meaningful here.
    './src/services/database/migrations/': {
      branches: 0,
      functions: 50,
      lines: 56,
      statements: 56,
    },
    './src/screens/': { branches: 0, functions: 0, lines: 0, statements: 0 },
    './src/navigation/': { branches: 0, functions: 0, lines: 0, statements: 0 },
    './src/hooks/': { branches: 0, functions: 0, lines: 0, statements: 0 },
  },
};
