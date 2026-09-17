# Secret scanning

`trufflehog` is the only secret scanner in this repository. It runs in two Husky hooks
and can be run over the full history on demand. Both hooks call
`scripts/security-secrets.mjs`, which owns the tool check, the flags and the exit-code
handling, so the two hooks cannot drift apart.

## Where it runs

| Hook         | Command                           | Scope                                          |
| ------------ | --------------------------------- | ---------------------------------------------- |
| `pre-commit` | `npm run security:secrets:staged` | The staged content only — fast (~0.3s)         |
| `pre-push`   | `npm run security:secrets`        | The full history — what the push would publish |

The staged scan reads blobs out of the **index** (`git show :path`), not off disk, so a
partially-staged file is scanned as it will be committed. Verified in both directions:
a key staged and then removed from the working tree still fails the gate, and a key
present only in the working tree does not.

## Two things the wiring gets right on purpose

### It checks the tool runs, not that a file exists

The hooks used to gate on `command -v gitleaks`, which only asks whether a file exists
and carries the executable bit. In #78 it did — and it was a **Linux ELF x86-64 binary
on an arm64 Mac**. Every hook took the "installed" branch, ran it, got exit 126 and
blocked the commit while naming the wrong cause. `scripts/bootstrap.sh` made the same
assumption and so reported `✓ gitleaks present` and declined to reinstall it.

`scripts/security-secrets.mjs` runs `trufflehog --version` and treats a non-zero exit
as "cannot scan". `bootstrap.sh`'s `have()` does the same for every tool it installs.

### It runs with no `--results` filter

trufflehog's `--results` flag takes `verified` and `unknown`, and **`unknown` means
"verification failed due to an error", not "unverified"**. So the narrower forms drop
ordinary unverified findings while reading as though they include them. Measured
against a throwaway RSA private key pasted into a `.ts` file:

| Invocation                          | Planted private key  | Exit |
| ----------------------------------- | -------------------- | ---- |
| `--only-verified --fail`            | **missed**           | 0    |
| `--results=verified,unknown --fail` | **missed**           | 0    |
| no filter, `--fail`                 | found (`PrivateKey`) | 183  |

A pre-commit gate has to catch a key whether or not trufflehog can reach the issuing
service to confirm it is live. Offline, or for a detector with no verifier at all,
"unverified" is the normal case — so an unverified finding is exactly what this gate
is for. The cost is that a false positive blocks; that is the right way round here.

## When the tool is missing

Both hooks **fail**. This changed in issue #45: they previously printed

> ℹ not installed — skipping secret scan

and continued, which meant a contributor who had not run `scripts/bootstrap.sh` had no
secret gate at all and no indication they were missing one. A gate that silently skips
is not a gate. Install it with:

```bash
./scripts/bootstrap.sh
```

Or, if the machine genuinely cannot run trufflehog and the push must happen anyway:

```bash
SKIP_SECRET_SCAN=1 git push
```

That escape hatch prints a loud warning naming what was skipped. It exists so the
failure mode is a deliberate, visible decision rather than an invisible default.

## There is no baseline file

`security/config/gitleaks-baseline.json` held an empty array — a full-history scan had
found nothing — and it was removed with the migration rather than reproduced. Carrying
an empty exclusion list forward mainly invites someone to add to it.

If an exclusion ever becomes genuinely necessary, add a deliberate `--exclude-paths`
in `scripts/security-secrets.mjs`, where it sits next to the reasoning and shows up in
a diff. An exclusion that is not accompanied by an explanation in
`security/docs/security-exceptions.md` is a regression, not a fix.

## Full-history scan

The pre-push hook already scans full history, so this is the same command run by hand:

```bash
npm run security:secrets
```

It takes roughly 2–8 seconds over this repository's history (~3,700 chunks, ~4.7 MB).

Rotating a leaked credential is the first step and rewriting history is the second —
never only the second. Anything pushed is assumed to have been fetched.
