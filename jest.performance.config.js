// Wall-clock performance tests, deliberately OUTSIDE `npm test`.
//
// These assert on elapsed time, and elapsed time is not a property of the code
// alone -- it is a property of the code and whatever else the machine happens to
// be doing. Run interleaved with 70 other suites across parallel workers, that
// second term is noise the test cannot see or control.
//
// It was in the default suite and it flaked. Measured on `develop`: roughly one
// failure in ten full-suite runs, while ten instrumented runs put the observed
// ratio between 2.235 and 2.657 against a threshold of 4.5. It never came close
// on any run that was looked at, and failed anyway -- a rare scheduling stall on
// one half of one measurement, not a threshold set too tight. Loosening the
// number would not have been principled: a threshold high enough to swallow that
// tail is high enough to miss the quadratic regression the test exists for
// (~7.5).
//
// So it runs alone, in band, where the measurement means something:
//
//   npm run test:perf
//
// `--runInBand` is the point, not an optimisation. One worker, no neighbours.
//
// This file is not in `jest.config.js`'s `projects`, so `npm test`, the pre-push
// hook and coverage never touch it. `__tests__/performanceSuiteWired.test.ts`
// runs in the default suite and fails if this config, its script or its tests go
// missing -- a suite nobody runs is a suite that rots, and this one is now only
// run on purpose.
module.exports = {
  displayName: 'performance',
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/performance/**/*.(test|spec).(ts|tsx|js)'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react' } }],
  },
};
