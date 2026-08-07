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
  // A RATCHET, not a target (#28 phase 1). These are floors just below actual coverage,
  // so `npm run test:coverage` passes today and any regression fails. Previously this
  // declared 70%, which nothing came close to -- the gate was fiction, so it could not be
  // run in CI and caught nothing.
  //
  // Measured on develop @ 973885c, and verified identical across three consecutive runs:
  //
  //   lines      16.71%  (929/5559)   -> floor 16
  //   statements 14.18%  (999/7044)   -> floor 13
  //   branches   11.09%  (397/3577)   -> floor 10
  //   functions  10.77%  (170/1577)   -> floor 10
  //
  // Rule for picking each floor: the integer below actual, dropped one further when that
  // would leave under ~0.5pp of headroom (statements and branches). Every floor therefore
  // has >= 0.7pp of slack -- roughly 300 lines of new uncovered source -- so landing a
  // feature slightly ahead of its tests does not break the build, while a real regression
  // does.
  //
  // ONLY EVER RAISE THESE. Phases 2-4 of #28 (services, stores, models) should each
  // ratchet them up as they land. The >80% goal in CLAUDE.md is the destination, not a
  // number to declare before it is true.
  //
  // Note the percentages are not comparable to the pre-#35 figures (18.8%/19.01%): the
  // `unit` and `components` projects instrument differently and report different
  // denominators for the same source (7044 statements merged vs 4807 under ts-jest
  // alone), so this baseline was re-measured after both projects were wired up.
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 10,
      lines: 16,
      statements: 13,
    },
  },
};
