# ADR-011: Local-gate-first; no new GitHub Actions, Dependabot, or CodeQL

**Status:** Accepted

**Date:** 2026-06-11

## Context

Issue #17 asks for several GitHub-side automations: scheduled security workflows
(CodeQL, OWASP Dependency-Check, ZAP, license checks), a weekly link-check workflow,
and a Dependabot configuration.

The maintainer recently and deliberately removed these from this repository. The
`develop` history includes the commits "Disable CodeQL and Dependabot" and
"chore(ci): disable CodeQL, Dependabot, scheduled actions; add PR check workflow." A
lightweight `pr-check.yml` was kept in their place. Issue #17 also states a preference:
"Prefer local gates (Husky hooks) over GitHub Actions where possible to shorten the
feedback loop and reduce Actions minutes."

### Correction (2026-08-06): CodeQL was never actually disabled

The paragraph above took those two commit messages at face value. Their diffs do not
match their subjects, and this ADR propagated the error:

- `ffa8c86` "Disable CodeQL and Dependabot" deleted **only** `.github/dependabot.yml`
  (1 file, 36 deletions). It changed nothing CodeQL-related.
- `819bb51` "chore(ci): disable CodeQL, Dependabot, scheduled actions" removed **only**
  the weekly `schedule:` cron from `security.yml`. Its `codeql` job, and that
  workflow's `push`/`pull_request` triggers on `main`/`develop`, were left intact.

There was never a standalone `codeql.yml`; CodeQL existed only as a job inside
`security.yml`, which this ADR simultaneously listed among the workflows to keep — an
internal contradiction with "do not re-enable CodeQL" below. GitHub-side default-setup
code scanning was separately confirmed `not-configured`, so the workflow job was the
only source.

Consequence: CodeQL ran on every push and PR to `main`/`develop` from its introduction
in `148d16b` until 2026-08-06, consuming the Actions minutes this ADR was written to
conserve. The `codeql` job has now been removed from `security.yml`, making the
repository's state match this ADR's intent. SAST remains available locally and opt-in
via `npm run security:semgrep`.

Lesson for future ADRs: verify claims about repository state against diffs, not commit
subjects.

## Decision

Honour the maintainer's decision and the issue's stated preference:

- Do **not** add new GitHub Actions workflows, and do **not** re-enable CodeQL,
  scheduled OWASP/ZAP scans, or Dependabot.
- Move enforcement to local Husky gates: `pre-commit` (lint-staged + `tsc-files` +
  optional gitleaks), `commit-msg` (commitlint), `pre-push` (`npm run check` + optional
  gitleaks), `post-merge` (lockfile-change audit).
- Keep the binary-backed scanners (`semgrep`, `osv-scanner`, `gitleaks`, `lychee`)
  available as opt-in `npm run security:*` / `links` scripts, installed via
  `scripts/bootstrap.sh`. The hooks degrade gracefully when the binaries are absent.
- Add no new workflow files, but **keep the existing `.github/workflows/*` (`ci.yml`,
  `eas-build.yml`, `pr-check.yml`, `security.yml`) in sync** with changes made here.
  "No new Actions" is not "leave the existing ones to rot": renaming an npm script or
  raising the Node floor must be reflected in the workflows that consume them, or the
  remaining server-side safety net silently breaks. Concretely, this change bumped
  `ci.yml`/`eas-build.yml` to read the Node version from `.nvmrc` and repointed
  `ci.yml` at the renamed `markdownlint` script.

  On the Node floor: `engine-strict=true` turns any `engines` mismatch into a hard
  `npm ci` failure, so the pin must satisfy _every_ transitive constraint, not just the
  one that happens to fail first. Resolving them one at a time is whack-a-mole — the
  Node 20 -> 22 bump merely uncovered the next violation. The floor was therefore
  computed by checking every installed package's `engines` range with semver: Node 22
  leaves exactly one violation (`license-checker-rseidelsohn@5.0.1`, which needs
  Node >= 24 and npm >= 11) and Node 24.15.0 leaves zero. Hence `.nvmrc` = 24 and
  `engines` = `node >=24.15.0` / `npm >=11.0.0`, which also matches the `lts/*` the
  other workflows already resolve to. Re-run that check when bumping dependencies.

## Consequences

### Positive

- No new Actions minutes consumed; feedback happens locally before push.
- Secret scanning, SAST, dependency and license checks are all available on demand.

### Negative

- Enforcement depends on contributors having hooks installed (`npm install` runs
  `prepare` → `husky`) and, for the binary scanners, running `scripts/bootstrap.sh`.

### Risks

- Web-UI merges and `--no-verify` bypass local hooks; the existing `pr-check.yml`
  remains the only server-side safety net. Re-adding Dependabot/CodeQL later is a
  one-file change if the maintainer reverses the earlier decision.
