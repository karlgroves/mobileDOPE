# ADR-014: Crash reporting — a local-only crash log, not an SDK

**Status:** Proposed

**Date:** 2026-10-28

## Context

Issue #61 asks for crash reporting, crash triage, performance monitoring and
metric tracking as part of taking the app to the stores. Issue #111 was split
out of it because four things in this repository assert the opposite, two of
them as executable tests, and because the choice is not a checkbox for whoever
reaches it first.

What currently says no:

| where              | what it says                                                                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PRIVACY.md:8`     | _"Mobile DOPE has no network layer. It does not contain an analytics SDK, a **crash reporter**, a telemetry client, an advertising identifier, or any code that sends a network request to a remote host."_ |
| `PRIVACY.md:81`    | _"No analytics, telemetry, crash reporting, or usage measurement."_                                                                                                                                         |
| `app/CLAUDE.md`    | _"No analytics, telemetry, crash reporting or advertising identifiers. The app has no network layer."_                                                                                                      |
| `app.config.ts:48` | `usesNonExemptEncryption: false`, _"The app has no network layer, collects no identifiers and does no tracking."_                                                                                           |

And two tests that fail the build rather than merely disagreeing:

- `__tests__/unit/offlineFirst.test.ts` — sweeps `src/` for HTTP clients,
  sockets and hard-coded remote hosts, and pins the single `fetch` call site by
  name.
- `__tests__/unit/releaseConfig.test.ts:118` — fails if anything under `src/`
  imports `@sentry/`, `@react-native-firebase/crashlytics` or `bugsnag`.

Those tests exist because the privacy claim was previously true only by
everyone being careful, which is not the same as staying true. #44 was filed
because the documentation said the app collected nothing while it was storing
precise GPS.

### What makes this app's case unusual

Two things, and they pull in the same direction.

**The data is a shooter's rifle inventory and range history, on a device, by
design.** A crash report carrying a stack trace, a device identifier and a
breadcrumb trail is a different proposition for that data than for a
note-taking app. A stack trace from this app can carry rifle names, load data
and file paths.

**The privacy claim is structural, not procedural.** "This app has no network
layer" is not a policy someone could change their mind about — it is a property
of the code that two tests enforce and that
`security/docs/security-exceptions.md` leans on as the _compensating control_
for every waived dependency advisory. That register says so in terms: the
control for the remaining advisories _"is structural rather than procedural:
**this app has no network layer**, issues no requests, runs no server, and
parses no untrusted input except a user-selected import file."_

So an SDK does not only cost a line in `PRIVACY.md`. It removes the argument
that the waiver register currently rests on.

### What the app has today

- `src/components/ErrorBoundary.tsx` catches render errors and calls
  `console.error`. On a release build nobody sees that.
- `expo-sharing` and `expo-file-system` are already dependencies, and the
  export path already writes files to the app's documents directory and hands
  them to the share sheet.
- The app has never shipped to either store, so there are no users whose
  crashes are going unreported today.

## Decision

**This ADR is Proposed and requests a ruling.** Nothing should be implemented
against it until one is given.

Three options, as #111 framed them, with the cost of each.

### Option A — ship a crash-reporting SDK

In scope, in this order:

1. An ADR superseding this one.
2. `PRIVACY.md` updated **before** the SDK lands, not after.
3. `app/CLAUDE.md`'s Data Privacy section brought into step.
4. `app.config.ts` — recheck `usesNonExemptEncryption`. An SDK using TLS may
   change the answer, and that declaration is made to Apple.
5. Opt-in, not opt-out, surfaced in Settings.
6. A scrubbing rule. Stack traces here can carry rifle names and load data.
7. `offlineFirst.test.ts` and `releaseConfig.test.ts` loosened **to exactly
   what was decided**, not to whatever makes them pass.
8. Store data-safety declarations for both platforms.
9. `security/docs/security-exceptions.md` reworded, because its stated
   compensating control stops being true.

**Real cost:** the nine items above, and the loss of the structural claim.
**Real benefit:** aggregated crash data — from an app with no users yet.

### Option B — decline it

Strike the monitoring section from #61, record the decision, and name the
honest fallback: users tell us, and the local gate (lint, types, tests,
semgrep, trufflehog on every commit, per ADR-011) is where defects are meant to
be caught instead.

**Real cost:** when a shooter says "it crashed", there is nothing to look at.
That is the gap, and it is a real one.

### Option C — a local-only crash log (recommended)

`ErrorBoundary` already catches the error. Instead of `console.error`, append
the stack trace and a timestamp to a file in the app's documents directory,
cap it at a few entries, and add a Settings action that shows the log and
offers it to the share sheet — the same share sheet the export path already
uses — so a shooter can attach it to an email **if they choose to**.

**Why this is the recommendation:**

- It keeps the structural property intact. No network layer, no new
  permission, no change to `usesNonExemptEncryption`, no change to either
  executable test, and the waiver register's compensating control still holds.
- It closes the actual gap. The problem to solve is that a shooter reporting a
  crash has nothing to attach, and this solves exactly that.
- The pieces already exist: `ErrorBoundary`, `expo-file-system`,
  `expo-sharing`, and a Settings screen with a Data Management section. This is
  a small amount of new code rather than a dependency and a posture change.
- The egress model is the one `PRIVACY.md` already describes for exports:
  _"User-initiated exports are the only egress."_ A crash log the user chooses
  to send is the same shape as a backup the user chooses to send, so the
  document needs an entry rather than a rewrite.

**What it does not do**, stated plainly so the ruling is informed: it does not
aggregate. There is no dashboard, no crash-free-sessions figure, and no way to
learn about a crash nobody reports. It is strictly worse than Option A at
knowing what is breaking in the field, and strictly better at everything else.

**Performance monitoring** (launch time, calculation speed, key metrics) is
**not** recommended in any form at this stage. It is the half of #61 with the
weakest case: the solver already has a wall-clock budget asserted locally in
`__tests__/performance/solverPerformance.test.ts`, and launch time and memory
are things to measure on a device during release testing rather than to
instrument in a shipped build. If Option A is chosen for crashes, performance
monitoring should still be a separate ruling.

### If the ruling is A or B instead

Both are reasonable and this ADR does not pretend otherwise. A is right if
shipping to real users without aggregate crash data is judged unacceptable;
the nine items above are then the scope, and the order matters. B is right if
the fallback is judged good enough and the local crash log is not worth the
code.

Whichever is chosen, #61's four monitoring checkboxes should be made
actionable or removed, so they stop being rediscovered.

## Consequences

### Positive

- The contradiction stops being latent. Four documents, two tests and an open
  issue currently disagree, and the next person to read any one of them is
  misled.
- Under Option C the app's distinguishing claim survives contact with a real
  release, and survives it as a property rather than as a promise.
- A shooter who hits a crash has something concrete to send, which is what
  makes a bug report actionable.

### Negative

- Option C is more work than adding an SDK, and does less. Someone has to
  write the file handling, the cap, the viewer and the share action.
- Under Option C, a crash that nobody reports is a crash nobody learns about.
  There is no honest way to describe that as equivalent to telemetry.

### Risks

- **Scope creep into telemetry.** A local crash log is one step from "and we
  could upload it automatically". The test sweep is what stops that, so the
  tests must not be loosened by Option C — and under this recommendation they
  do not need to be.
- **A stack trace is user data.** The log will contain rifle names and file
  paths. It must be stored inside the app's own documents directory, included
  in nothing automatically, and the share action must say what it contains
  before it is sent.
- **Documentation drift.** `PRIVACY.md` is the canonical statement and
  `app/CLAUDE.md` mirrors it. Whichever option is chosen, both move in the same
  commit as the code, per #44.

## References

- Issue #111 — the decision this records, and the source of the three options
- Issue #61 — the four monitoring checkboxes that are blocked on it
- Issue #44 — why an inaccurate privacy claim is treated here as a defect
- ADR-011 — local-gate-first, and why defects are caught before a release
  rather than after one
- `PRIVACY.md`, `app/CLAUDE.md`, `app.config.ts`,
  `security/docs/security-exceptions.md` — the four statements that have to
  agree with whatever is decided
