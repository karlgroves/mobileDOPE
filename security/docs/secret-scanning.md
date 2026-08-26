# Secret scanning

`gitleaks` is the only secret scanner in this repository. It runs in two Husky hooks
and can be run over the full history on demand.

## Where it runs

| Hook         | Command                             | Scope                                |
| ------------ | ----------------------------------- | ------------------------------------ |
| `pre-commit` | `gitleaks protect --staged`         | The staged diff only — fast          |
| `pre-push`   | `gitleaks detect --baseline-path …` | The full history, minus the baseline |

Both **fail** when the binary is absent. This changed in issue #45: the hooks
previously printed

> ℹ gitleaks not installed — skipping secret scan

and continued, which meant a contributor who had not run `scripts/bootstrap.sh` had no
secret gate at all and no indication that they were missing one. A gate that silently
skips is not a gate. Install it with:

```bash
./scripts/bootstrap.sh
```

Or, if the machine genuinely cannot run gitleaks and the push must happen anyway:

```bash
SKIP_SECRET_SCAN=1 git push
```

That escape hatch prints a loud warning naming what was skipped. It exists so the
failure mode is a deliberate, visible decision rather than an invisible default.

## The baseline

`security/config/gitleaks-baseline.json` records findings that existed when scanning
was introduced, so the hooks fail on **new** secrets rather than reporting the same
historical ones on every push.

The baseline is currently **empty** — a full-history scan of all 133 commits found no
leaks. It is committed anyway, as an empty array, so that:

- the `--baseline-path` flag in the hooks has a file to point at, and
- a future finding that is deliberately accepted has somewhere to be recorded, rather
  than being handled by removing the flag.

### Regenerating it

Only after you have read every entry the scan produces. A baseline is an assertion
that each finding in it has been examined and is not a live credential.

```bash
gitleaks detect --no-banner --redact --report-path security/config/gitleaks-baseline.json --exit-code 0
```

Then review the diff before committing. A baseline that grows without a corresponding
explanation in `security/docs/security-exceptions.md` is a regression, not a fix.

## Full-history scan

The pre-push hook already scans full history, so this is the same command run
manually:

```bash
npm run security:secrets
```

Rotating a leaked credential is the first step and rewriting history is the second —
never only the second. Anything pushed is assumed to have been fetched.
