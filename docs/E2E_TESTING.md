# End-to-end testing

Maestro drives the built app on a simulator or device. The flows live in
`.maestro/`; the definitions they were transcribed from live in
[`docs/use-cases/`](./use-cases/README.md).

## Why Maestro, and not Detox

[ADR-009](./adr/009-rn-scope-web-tools-na.md) names Detox or Maestro as the React
Native E2E path, and rules out the DOM tooling. Between the two, Maestro:

- **needs no build-time instrumentation**, which matters in a managed Expo workflow
  where the native projects are generated rather than committed;
- **is YAML**, so a flow is close to a transcription of the corresponding
  `.uc.yaml` definition rather than a fresh authoring pass in a second language.

That second point is why [#18](https://github.com/karlgroves/mobileDOPE/issues/18)
was sequenced first. `activate: button "Save"` becomes `tapOn: 'Save'`.

## The expensive part is the build, not the flows

There is **no `ios/` or `android/` directory in this repository**, and there should
not be. This is a managed Expo workflow: all native configuration comes from
`app.config.ts`, and the native projects are generated. `.gitignore` excludes them
deliberately.

So before any flow can run, a native project has to be produced and built. That is
the cost of E2E here — writing the flows is the cheap half.

```bash
# 1. Generate the native project (regenerable; do not commit the output)
npx expo prebuild --platform ios

# 2. Build and install on a booted simulator
npx expo run:ios

# 3. Run the suite
npm run test:e2e
```

`npx expo prebuild --clean` regenerates from scratch after any change to
`app.config.ts`. Anything hand-edited inside `ios/` or `android/` is lost on the
next prebuild, which is the point: `app.config.ts` is the source of truth.

## Prerequisites

`scripts/e2e.sh` checks all of these before starting and names the missing one,
rather than letting Maestro fail with "no devices found" three minutes in.

| Requirement      | Check                              | Fix                                                                                                              |
| ---------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Maestro binary   | `maestro --version`                | `curl -Ls https://get.maestro.mobile.dev \| bash`                                                                |
| Full Xcode (iOS) | `xcrun simctl list`                | `sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer` — Command Line Tools alone is not enough |
| Native project   | `ls ios`                           | `npx expo prebuild --platform ios`                                                                               |
| Booted device    | `xcrun simctl list devices booted` | `npx expo run:ios`                                                                                               |

`./scripts/bootstrap.sh` installs Maestro alongside the other optional binaries.

## Running

```bash
npm run test:e2e          # smoke + journeys, excluding destructive flows
npm run test:e2e:smoke    # smoke only — the fast check after a build
npm run test:e2e:all      # everything, including flows that clear app state
```

**Destructive flows are excluded by default.** `.maestro/config.yaml` sets
`excludeTags: [destructive]`, and `__tests__/unit/maestroFlows.test.ts` fails if a
flow uses `clearState: true` without carrying that tag. A stray local run must not
be able to wipe a device holding real DOPE.

## The flows

| Flow                                        | Tags                              | Covers                                                                       |
| ------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| `smoke/app-launches.yaml`                   | smoke                             | The app starts, the database opens, the dashboard paints, all six tabs mount |
| `smoke/navigation.yaml`                     | smoke                             | Every tab reaches its root screen without throwing                           |
| `journeys/rifle-to-dope-card.yaml`          | journey, destructive              | Empty install → rifle → load → DOPE card PDF                                 |
| `journeys/record-session-shot.yaml`         | journey                           | Conditions → session → adjust → record → it reaches history                  |
| `journeys/environment-location-denied.yaml` | journey, permissions, destructive | The app stays fully usable with location declined                            |

The last one earns its place: `PRIVACY.md` commits to it in as many words, and the
system permission dialog is the one thing no unit test can reach.

## What runs without a device

`__tests__/unit/maestroFlows.test.ts` validates the flows structurally inside the
ordinary `npm test` gate — YAML shape, known commands only, an `appId` matching the
config, a wait before the first assertion, at least one assertion per flow, and the
destructive-tag rule.

It cannot tell you whether a selector matches a real screen. It can tell you that a
flow is malformed, which otherwise surfaces minutes into a device run on a machine
that has Xcode, Maestro and a booted simulator — the slowest feedback loop in this
repository.

`__tests__/unit/maestroSelectors.test.ts` narrows the gap further. Every literal
selector must either appear verbatim in `src/`, or be listed with a reason:

- **flow-created data** — profile names and values the flow types in, which will
  never be in source;
- **pending from another PR** — labels arriving with a named open PR. Currently
  empty: the eight entries that were here landed with #46 and #47, and the
  `keeps the pending list honest` assertion flagged them the moment those merged;
- **unverified on device** — the genuine remainder, currently five.

`id:` selectors are checked strictly, with no allowance: unlike a visible label, a
testID has no reason to be absent from source. That rule exists because two flows
originally tapped `create-rifle-button` and `create-ammo-button`, neither of which
exists anywhere in the app — so the flagship journey could not have run past its
second step.

When one of those PRs merges, remove its entries and re-run. Anything still
missing is a real selector defect rather than a sequencing artefact.

## CI

**The suite is not wired into GitHub Actions, and this is deliberate.**

[ADR-011](./adr/011-local-gate-first-no-new-actions.md) rules out adding new
workflows; device E2E would be among the most minute-hungry jobs in the repo; and
issue #20's own acceptance criterion offers "or has a documented plan to". This is
that plan.

Run it locally:

- after `expo prebuild` or any change to `app.config.ts` — that is what regenerates
  the native project, and the permission declarations with it;
- before cutting a release branch;
- when changing navigation, a form, or anything in the session screen.

If E2E ever does move to CI, the shape it should take is a self-hosted runner or an
EAS build feeding a hosted device farm — not a `macos-latest` job doing a cold
prebuild on every PR. That decision belongs with the ADR-011 posture as a whole,
not with this suite.

## Writing a new flow

1. Write or find the definition in `docs/use-cases/`. If the interaction is not
   described there, describe it there first — that is where the intent lives.
2. Transcribe the steps. `activate` → `tapOn`, `enter` → `tapOn` + `inputText`,
   `verify` → `assertVisible`, `wait_for` → `extendedWaitUntil`.
3. Prefer accessible names as selectors over `id:`. A flow that can only find a
   control by test id is telling you the control has no accessible name — and
   `maestroSelectors.test.ts` rejects a testID that exists nowhere in `src/`.
4. Tag it. Add `destructive` if it uses `clearState: true`.
5. Run `npm test` before running on a device — it catches the malformed cases in
   seconds rather than minutes.
