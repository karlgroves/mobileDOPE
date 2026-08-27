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
const unit = {
  displayName: 'unit',
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/unit/**/*.(test|spec).(ts|tsx|js)'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
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
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/components/**/*.(test|spec).(ts|tsx)'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
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
  // layer that caused it. Jest assigns each file to the most specific matching path,
  // which leaves `global` covering nothing -- that is deliberate, not an oversight:
  // there is no unclassified source left. Adding a new top-level directory under
  // `src/` means adding its floor here.
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
  //   directory                      s      b      l      f     state
  //   utils                        90.5   77.4   90.1   87.5   ballistic math, done
  //   store                        93.4   83.9   94.4   92.5   #28 phase 3, this change
  //   models                       85.3   80.7   85.2   83.3   #28 phase 4, mostly done
  //   services/database            60.7   77.7   64.2   70.0   repositories high, runner 0%
  //   services                     62.1   57.5   64.3   67.1   CSV/Markdown covered; PDF 0%
  //   contexts                     66.7   50.0   76.9   40.0   incidental, via components
  //   components                   14.4   20.2   18.1   16.0   8 of ~20 suites
  //   constants                    10.2    7.1   13.2    2.2   data tables
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
    // Floored below the observed worst case, not the usual one. `src/store/`
    // normally reports 93.39/83.87/92.47/94.38, but roughly one run in six loses
    // one store test file's contribution and reports 87.17 statements instead --
    // reproduced across repeated clean runs, in-band and parallel alike. The cause
    // is tracked in #54.
    //
    // A ratchet that reds one push in six gets re-run rather than read, so these
    // sit under the low reading. Raise them back to the ~92 mark once #54 lands.
    './src/store/': { branches: 77, functions: 86, lines: 88, statements: 86 },
    './src/models/': { branches: 79, functions: 82, lines: 84, statements: 84 },
    './src/services/database/': { branches: 76, functions: 69, lines: 63, statements: 59 },
    './src/services/': { branches: 56, functions: 66, lines: 63, statements: 61 },
    './src/contexts/': { branches: 48, functions: 38, lines: 75, statements: 65 },
    './src/components/': { branches: 19, functions: 15, lines: 17, statements: 13 },
    './src/constants/': { branches: 6, functions: 1, lines: 12, statements: 9 },

    // Not yet started. Declared at 0 so they are visible in this table rather than
    // invisible inside a merged average, and so the first test written for them can
    // raise a floor that means something.
    './src/services/database/migrations/': {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
    './src/screens/': { branches: 0, functions: 0, lines: 0, statements: 0 },
    './src/navigation/': { branches: 0, functions: 0, lines: 0, statements: 0 },
    './src/hooks/': { branches: 0, functions: 0, lines: 0, statements: 0 },
  },
};
