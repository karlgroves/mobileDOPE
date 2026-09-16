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
stops being reported because it stops being true. The entries currently carried, all
of them build-time-only tooling:

| Override         | Pins forward | Parent that lags                               |
| ---------------- | ------------ | ---------------------------------------------- |
| `@xmldom/xmldom` | `^0.8.15`    | `@expo/config-plugins`, via `expo-sharing`     |
| `fast-uri`       | `^3.1.8`     | `@commitlint/cli`                              |
| `smol-toml`      | `^1.8.0`     | `markdownlint-cli2`, which pins `1.7.0`        |
| `js-yaml@3`      | `^3.15.2`    | `babel-plugin-istanbul`, via `@jest/transform` |
| `js-yaml@4`      | `^4.3.2`     | `@eslint/eslintrc`, `cosmiconfig`              |

`js-yaml` is split by major because the tree legitimately carries 3.x, 4.x and 5.x;
a single override would force one consumer onto an incompatible major. Drop an entry
once the parent's own range admits the patched version — an override that is no longer
doing anything is the same kind of rot as a stale waiver, and nothing warns about it.

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

### npm audit — 15 advisories, expire 2026-11-24

All 15 are transitive through the React Native / Expo build toolchain and are
DoS-class (quadratic parsing, unbounded recursion) in code paths the shipped app does
not reach. The compensating control is structural rather than procedural: **this app
has no network layer**, issues no requests, runs no server, and parses no untrusted
input except a user-selected import file, which has its own allowlist and adversarial
test suite (`security/tests/import.security.spec.ts`).

Full detail, per advisory, is in `security/config/audit-waivers.json`. They are listed
there and not duplicated here so there is exactly one place to update.

Disposition for all 15 is `blocked-on-upstream`: they clear when Expo SDK ships a
dependency set that resolves them. `npm run security:audit` fails the moment a new
advisory appears that is not on that list, which is the property that matters.

### Semgrep — 1 suppression

| Rule                                  | Location                                   | Reason                                                                                                                                                                                                                                       | Owner      | Expires                                                    |
| ------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| `mobiledope-sql-string-interpolation` | `src/services/database/DatabaseService.ts` | SQLite does not accept bound parameters in a `PRAGMA` statement. The interpolated value is `DATABASE_VERSION`, a module-level numeric constant that never comes from input. A permanent limitation of the statement type, not deferred work. | karlgroves | Permanent — review if the PRAGMA ever takes a non-constant |

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
