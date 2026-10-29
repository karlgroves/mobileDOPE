# Security exceptions

An exception is a security finding that is knowingly not fixed right now. This
document defines what one must contain, who may grant it, how long it may live, and
what may never be excepted.

The purpose is not to make findings go away. It is that every tolerated finding has a
name attached, a reason that refers to this app's actual exposure, and a date after
which it stops being tolerated on its own.

## The two mechanisms

| Finding source | Where the exception lives                               | How it expires                                                        |
| -------------- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| `npm audit`    | `security/config/audit-waivers.json`                    | `expires` field; a lapsed waiver fails `npm run security:audit`       |
| Semgrep        | `// nosemgrep: <rule-id>` on the line above the finding | Listed in the register below with an expiry, reviewed at each release |

Nothing else may suppress a finding. In particular: do not lower a threshold in
`security-thresholds.json` to make a finding disappear, do not delete a rule from
`security/config/semgrep.yml`, and do not add a blanket `continue-on-error`.

**An `overrides` entry in `package.json` is not an exception** — it is a fix, and it
belongs in neither register. It pins a transitive dependency forward to a patched
version when the parent that depends on it has not yet released one, so the advisory
stops being reported because it stops being true.

**Reach for one only when the parent's own range cannot admit the patched version.**
Most stale transitives are stale because the _lockfile_ pins them, not because
anything forbids the fix: `npm update <package>` moves them and leaves no permanent
configuration behind. An override added where a refresh would have done is dead
config that still looks load-bearing. The test is mechanical — delete the entry, run
`npm install --package-lock-only`, and see whether the version moves back.

| Override    | Pins forward | Parent that lags                                                                                                              |
| ----------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `smol-toml` | `^1.8.0`     | `markdownlint-cli2`, which pins exactly `1.7.0` — and the advisory range is `<=1.7.0`, so the pin _is_ the vulnerable version |

That is the whole list, and it was four entries longer until each was tested this
way. `@xmldom/xmldom`, `fast-uri` and both `js-yaml` majors all resolve to patched
versions with no override at all, because `@expo/plist`, `ajv`,
`@istanbuljs/load-nyc-config`, `cosmiconfig`, `@expo/xcpretty` and `@eslint/eslintrc`
already allow them. Only `markdownlint-cli2`'s exact pin genuinely blocks npm.

Drop an entry once the parent's own range admits the patched version — an override
that is no longer doing anything is the same kind of rot as a stale waiver, and
nothing warns about it.

None of the overridden packages runs in the shipped app bundle. Several are reachable
through _production_ dependencies rather than devDependencies — `@xmldom/xmldom` via
`expo-sharing` → `@expo/plist`, `js-yaml` via `expo` → `@expo/cli` and via
`react-native` → `babel-jest` — so they appear under `npm ls --omit=dev`. They are
build-time and CLI code paths in every case; nothing reaches the device.

## Required fields

Every exception, in either mechanism, must record:

- **What** — the advisory id or rule id. Never "the audit findings" as a group.
- **Why it is tolerable _here_** — a statement about this codebase's exposure, not a
  restatement of the advisory. "Quadratic complexity DoS" is the advisory.
  "Reached only by the Metro bundler at build time, on archives this repo produces
  itself" is a reason.
- **Owner** — a person, not a team.
- **Expiry** — at most **90 days** from the date the exception was written.
- **Tracking** — a link to the issue where the real fix is being pursued.
- **Compensating control**, if one exists.

A `reason` shorter than 40 characters is rejected by the waiver validator, because
reasons that short are never reasons.

## What may never be excepted

- A hardcoded credential, key or token committed to the repository.
- A finding in code that handles a file the user did not create — currently only
  `ImportService`.
- Anything that would make the app's behaviour contradict `PRIVACY.md`.
- A finding whose only justification is that fixing it is inconvenient, or that it
  has been there a long time.

## Granting and review

`karlgroves` grants exceptions. Every exception is reviewed when it expires and at
each release, whichever comes first. Renewal requires a fresh reason — the previous
one having been true is not evidence that it still is.

Recording a waiver you have not actually reviewed is worse than the unfixed finding,
because it also destroys the record of what was and was not examined.

## Current register

### npm audit — 3 advisories, expire 2026-11-24

All 3 are transitive through the React Native / Expo build toolchain, in code paths
the shipped app does not reach, and all three are DoS-class (quadratic parsing,
unbounded recursion, unbounded memory). The compensating control is structural rather
than procedural: **this app has no network layer**, issues no requests, runs no
server, and parses no untrusted input except a user-selected import file, which has
its own allowlist and adversarial test suite
(`security/tests/import.security.spec.ts`).

Full detail, per advisory, is in `security/config/audit-waivers.json`. They are listed
there and not duplicated here so there is exactly one place to update.

Disposition for 3 of the 3 is `blocked-on-upstream`: they clear when the toolchain
ships a dependency set that resolves them. `zod` (GHSA-mrhx-c7xc-m3w5) is the shape for
the copy that matters: the dev copy is already past the 4.6.6 fix, but Expo's nested
3.x copy keeps the advisory reported and npm's only offered fix is `expo` 51.0.39, a
semver-major **downgrade** from the SDK 55 this project is on.

`npm run security:audit` fails the moment a new advisory appears that is not on that
list, which is the property that matters.

The count moves in both directions. It was 15 when this register was written; two
advisories left it by being **fixed** rather than renewed (`brace-expansion` and
`undici`, in 5d98b34 and 855a330), and the heading went stale because nothing checked
it. `security/tests/waiverRegister.security.spec.ts` now does, so the two can no
longer drift apart silently — if you are reading a checkout where they disagree,
`audit-waivers.json` is the one to trust.

It fell from 13 to 4 when `npm audit fix --package-lock-only` resolved nine of them
outright — `tar` ×3, `shell-quote` ×2, `nanoid`, `ws`, `form-data` and `ip-address` — by
moving the toolchain forward rather than by renewing anything. That is the
`blocked-on-upstream` disposition doing what it says: the waivers were removed, not
re-dated.

It then moved again, in both directions at once. `braces`
(GHSA-vfj7-8cjw-p6xm, #170) **was withdrawn upstream** on 2026-10-23 and is no longer
reported at all, so its waiver was deleted rather than re-dated — a withdrawn advisory
is not a waived one, and leaving the entry in place would have claimed a review of
something that no longer exists. Issue #170 was closed on 2026-10-20.
In the same advisory-database refresh `undici` returned under a second id and `zod`
appeared for the first time, which is why the net count went from 4 to 5.

It fell back to 4 when `undici` was bumped to 6.29.1 in the lockfile. That release
fixes GHSA-xjj6-f33q-929c, which was waived `fixable-now`, and the two advisories
published against `undici` on 2026-10-27 (GHSA-2m5v-pch6-74hx, GHSA-qrxm-fqhp-jwvm),
which had started failing `npm run security:audit`, and so the pre-push hook, on every
branch. The waiver was deleted rather than re-dated.

It fell to 3 when `node-forge` reached 1.4.2 in the lockfile, which patches
GHSA-86w9-cpqp-85rv. That waiver said in terms that _"no patched release exists at any
version"_ and that a semver-major bump of the parent was npm's only offered fix. Both
had stopped being true: a plain `npm audit fix` moved the transitive copy forward
without touching `expo`. So the waiver was deleted rather than re-dated. #169 was
already closed, on 2026-10-20, eight days before the waiver tracking it came off file —
`waiverRegister.security.spec.ts` checks that a waiver points at an issue in this
repository, not that the issue is still open. Worth noting for the next renewal — the reason
a `blocked-on-upstream` waiver gives is a claim about the ecosystem on the day it was
written, and the ecosystem moves without telling you.

### Semgrep — 0 suppressions

There are no `nosemgrep` comments in `src/`. `npm run security:semgrep` passes 77
rules over 280 files on its own merits.

The register carried one entry until #59. `mobiledope-sql-string-interpolation` was
suppressed on `DatabaseService.setDatabaseVersion()`, which interpolated a constant
into `PRAGMA user_version` — a real limitation of the statement type, since SQLite
does not bind parameters in a PRAGMA. Enabling `noUnusedLocals` showed the method
had no callers at all: `MigrationRunner` had taken over `user_version` and writes it
on every migrate and rollback. The method was not merely unused but stale, pinned to
`DATABASE_VERSION = 1` while migrations had reached 5 — calling it would have stamped
the database backwards and re-run every migration. Deleting it removed the last
suppression as a side effect.

`MigrationRunner` performs the same interpolation and is not suppressed either: the
rule's own `paths.exclude` covers `/src/services/database/migrations/`, so the
exclusion is in the rule where it can be read, not in a comment at the call site.

There was briefly a second entry here, suppressing a real full-precision-GPS
finding in `EnvironmentInput.tsx` on the grounds that issue #44 fixes it. That was
the wrong shape and it was removed along with the rule that produced it: a security
gate reporting green **because** it suppresses a live defect is worse than one that
never had the rule, since it also stops anyone else from looking.

`mobiledope-uncoarsened-coordinate` is now in the ruleset (#53), added after #44's
remediation had landed — so it passes on its own merits, with no suppression. The
register is shorter by an entry because the defect was fixed, which is the only
way an exception should ever leave this list.

**The general principle, learned the hard way:** a new rule and the fix that makes
it pass belong in the same change. If adding a rule requires a suppression on the
first day, the rule is not ready to add here.

## Adding a waiver

```bash
# 1. Confirm the finding and read the advisory.
npm audit --json | jq '.vulnerabilities'

# 2. Add an entry to security/config/audit-waivers.json matching
#    security/config/audit-waivers.schema.json.

# 3. Verify the gate accepts it and still fails on anything new.
npm run security:audit
```
