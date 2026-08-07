# ADR-012: Upgrade to Expo SDK 55 rather than reverting to SDK 54

**Status:** Accepted

**Date:** 2026-08-06

## Context

Issue #29 was filed to fix a dependency drift that blocks the component-test runner (and
therefore #28 phase 5 and #20). It proposed aligning **backward** to Expo SDK 54, on the
basis that `npx expo install --check` reported `react`, `react-native`,
`react-native-screens`, `expo`, `jest` and others as ahead of SDK 54's pins.

Investigating before implementing changed the picture. Comparing what each SDK bundles
against what was actually installed:

|                                  | react-native | react-native-screens | reanimated | skia   |
| -------------------------------- | ------------ | -------------------- | ---------- | ------ |
| SDK 54 (declared)                | 0.81.5       | ~4.16.0              | ~4.1.1     | 2.2.12 |
| **SDK 55**                       | **0.83.10**  | **~4.23.0**          | 4.2.1      | 2.4.18 |
| SDK 56                           | 0.85.3       | ~4.26.0              | 4.3.1      | 2.6.2  |
| **installed before this change** | **0.83.1**   | **~4.23.0**          | 4.3.0      | 2.6.2  |

`react-native-screens@~4.23.0` was _exactly_ SDK 55's pin, `react-native@0.83.1` shared
SDK 55's minor, and `react-native@0.83.10` peer-requires `react@^19.2.0` — which the
installed `react@19.2.4` satisfied. Only the `expo` package itself was still on 54.

The drift originated in `163ee90` (`dependabot[bot]`, 2026-02-07), which bumped react,
react-native and react-native-screens in one grouped PR. That bump did not move the project
somewhere arbitrary — it moved it _most of the way to SDK 55_. SDK 54 was also three majors
behind by this point (SDK 57 was current).

Reverting would have meant moving five packages backward, including react-native down two
minors, against where the tree already sat — and would have left the project three SDK
majors behind, with the same upgrade still owed later.

Two facts constrained the decision but did not depend on it:

- **jest must be 29 either way.** `jest-expo` 54, 55 _and_ 56 all depend on jest 29
  internals (`@jest/globals@^29.2.1`, `jest-snapshot@^29.2.1`). jest 30 was installed, and
  jest 30's stricter module scope is what made expo's lazy `installGlobal` getters throw
  `ReferenceError: You are trying to import a file outside of the scope of the test code`.
  No SDK upgrade escapes this; the jest downgrade is unavoidable.
- **`@testing-library/jest-native` had to go.** It was declared but imported nowhere, is
  deprecated (superseded by `@testing-library/react-native` v12.4+, as `jest.setup.js`
  already noted), and its `react-test-renderer` peer was what made a clean `npm install`
  unresolvable.

## Decision

Target **Expo SDK 55**. Concretely:

- `expo` `~54.0.33` → `~55.0.28`, and every `expo-*` package to its SDK 55 version (SDK 55
  renumbers them to `55.x`).
- `react` `19.2.4` → `19.2.0`, `react-native` `0.83.1` → `0.83.10`.
  `react-native-screens` and `react-native-safe-area-context` were already correct.
- `jest` `^30.2.0` → `~29.7.0`, `@types/jest` → `29.5.14`, `jest-expo` → `~55.0.20`,
  `eslint-config-expo` → `~55.0.1`.
- Remove `@testing-library/jest-native`; pin `react-test-renderer` to `19.2.0` so it tracks
  react exactly (an unpinned resolve takes the newest, which peer-requires a newer react).
- Declare `@jest/transform`, `@jest/types`, `babel-jest` and `jest-util` explicitly. These
  are `ts-jest` **peer dependencies**, so this project is expected to supply them; they
  happened to be hoisted under jest 30 but nest unresolvably under jest 29 + jest-expo 55.
- Add `expo-sharing` to `plugins` in `app.config.ts` — SDK 55 requires it as a config
  plugin, and `expo install --fix` cannot write a dynamic (`.ts`) config automatically.

Do **not** revert the Dependabot bump. Finish the move it started.

## Consequences

### Positive

- `npx expo install --check` reports "Dependencies are up to date" — the declared SDK and
  the installed tree agree for the first time since February.
- **The component-test runner is unblocked.** Under jest-expo 55 + jest 29, all 8 dormant
  suites in `__tests__/components/` execute (58 of 64 assertions pass). The 6 remaining
  failures are test-authoring bugs, not infrastructure — e.g. `TextInput.test.tsx:221`
  expects `props.style` to be an object when React Native supplies an array. Fixing those
  and wiring the runner into `jest.config.js` is #28 phase 5.
- Security posture improves: production vulnerabilities 19 → 16, high 6 → 4, critical
  2 → 1.
- One SDK major behind instead of three.

### Negative

- Large `package-lock.json` diff (~5,100 insertions / ~9,200 deletions).
- Four jest-internal packages are now declared directly. They are legitimate peer
  dependencies of `ts-jest`, but they are implementation detail and will need revisiting if
  the transformer changes.
- `react` and `react-native` move _down_ by a patch/patch respectively from what was
  installed, which can look like a regression in isolation.

### Risks

- **Native build not verified here.** `npm ci`, type-check, lint, the 455 unit tests and
  `expo config` all pass, but no iOS/Android binary was produced. An SDK major carries
  native changes; the first EAS build on this branch is the real proof.
- `eslint-config-expo` jumped 10 → 55 (SDK renumbering, not 45 majors of change). Lint
  passes with 0 errors, but the legacy eslintrc path (ADR-007) is the unusual configuration
  here and is worth watching.
- SDK 56/57 remain unadopted, so this defers rather than eliminates the upgrade debt.
- ADR-011's Node-floor check was re-run as that ADR requires: Node 24.15.0 / npm 11.0.0
  satisfy every installed package's `engines`, 0 violations. Re-run it on the next bump.

## References

- #29 — the originating issue (filed proposing the SDK 54 revert; superseded by this)
- #28 — coverage backfill; phase 5 (component runner) is unblocked by this change
- ADR-007 — legacy eslintrc retained for `eslint-config-expo`
- ADR-008 — Jest retained over Vitest
- ADR-011 — Dependabot disabled, so this drift will not self-correct; run
  `npx expo install --check` periodically
