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
  // A RATCHET, not a target (#28 phases 1-2). These are floors just below actual coverage,
  // so `npm run test:coverage` passes today and any regression fails. It once declared 70%,
  // which nothing came close to -- the gate was fiction, so it could not be run in CI and
  // caught nothing.
  //
  // Ratcheted by #28 phase 2 as the services suites landed:
  //
  //   metric       phase 1   3 repos   all 7 repos   export/import   + #39 fix   floor
  //   lines        16.71%    20.12%    24.25%        27.00%          28.11%      27
  //   statements   14.18%    17.13%    20.79%        23.47%          24.60%      24
  //   branches     11.09%    13.14%    15.37%        16.68%          17.97%      17
  //   functions    10.77%    13.96%    19.09%        20.93%          21.87%      21
  //
  // Measure with a clean `coverage/` directory (`rm -rf coverage` first). A stale one left
  // behind by a `--selectProjects` run reports a lower figure, which would set the floors
  // too loose and let real regressions through.
  //
  // Rule for each floor (unchanged from phase 1): the integer below actual, dropped one
  // further when that would leave under ~0.5pp of headroom -- which is all four here. Every
  // floor keeps >= 0.9pp of slack so landing a feature slightly ahead of its tests does not
  // break the build, while a real regression does.
  //
  // ONLY EVER RAISE THESE. All 7 repositories sit at 98-100% statements and ImportService
  // is at ~70%, but the layer is not done: ExportService is still ~9% (only the JSON
  // full-backup path is covered; the CSV, Markdown and PDF exporters are not),
  // DatabaseService is 21%, and MigrationRunner is 0%.
  //
  // Note the percentages are not comparable to pre-#35 figures (18.8%/19.01%): the `unit`
  // and `components` projects instrument differently and report different denominators for
  // the same source, so the baseline was re-measured once both were wired up.
  coverageThreshold: {
    global: {
      branches: 17,
      functions: 21,
      lines: 27,
      statements: 24,
    },
  },
};
