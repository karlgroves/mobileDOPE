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
  `ci.yml`/`eas-build.yml` to read the Node version from `.nvmrc` (the new
  `@commitlint/cli` requires Node >= 22.12 and `engine-strict=true` makes a mismatch a
  hard `npm ci` failure) and repointed `ci.yml` at the renamed `markdownlint` script.

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
