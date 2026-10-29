// Per-test timeout for the `components` Jest project.
//
// Jest's default is 5 s, which is not enough for this project and never was. A
// screen test here mounts a React tree AND runs the real ballistic solver:
// `dopeAdjustedSolution`, `dopeAimingSettings` and `useBarrelState` solve once
// per seeded log, and the interpolated cases solve for the logs either side of
// the shot as well. In isolation those take 1-2 s and 5 s held. Under a
// full-suite run they are scheduled alongside every other component suite on
// the same cores and they began timing out -- `npm test` passing or failing
// according to how busy the machine was, in four suites at once, none of which
// had changed. A pass that depends on machine load is not a test result.
//
// This has to live in `setupFilesAfterEnv` rather than as a `testTimeout` key on
// the project. With `projects` configured, Jest does not honour `testTimeout`
// per project -- verified: a 7 s test still failed at "Exceeded timeout of
// 5000 ms" with `testTimeout: 60_000` set on the project. `setupFiles` is too
// early, because it runs before the test framework installs `jest.setTimeout`.
//
// Deliberately NOT a per-file `jest.setTimeout`: the next solver-backed suite
// someone writes would hit the same wall, and a per-file workaround is a thing
// to remember rather than a property of the project.
//
// This is NOT a licence for slow tests. It is a ceiling that stops a correct
// test being reported as a failure; a suite that genuinely needs 60 s has a
// problem the timeout is hiding. The `unit` project is left at Jest's default
// on purpose -- a pure-TypeScript test that takes 5 s is telling you something.
jest.setTimeout(60_000);
