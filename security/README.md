# security/

Everything that decides whether a security finding blocks, and everything that records
why a finding is tolerated when it does not.

```text
security/
├── config/
│   ├── audit-waivers.json          # individually waived npm advisories
│   ├── audit-waivers.schema.json   # what a waiver must contain
│   ├── gitleaks-baseline.json      # reviewed secret-scan findings (currently empty)
│   └── semgrep.yml                 # 11 custom SAST rules for this codebase
├── docs/
│   ├── secret-scanning.md          # how gitleaks runs, and the baseline procedure
│   └── security-exceptions.md      # the exception process, and the live register
└── tests/
    ├── import.security.spec.ts     # adversarial tests for the only untrusted input
    └── workflows.security.spec.ts  # supply-chain constraints on the workflows
```

`security-thresholds.json` sits at the repository root, not in here, because it is the
input every tool reads — putting it beside the scripts that consume it keeps it from
being mistaken for documentation.

## Where each gate runs

Per [ADR-011](../docs/adr/011-local-gate-first-no-new-actions.md) the gates are local
first. No new GitHub Actions workflow was added for any of this.

| Gate                     | Runs in                    | Blocks on                                                   |
| ------------------------ | -------------------------- | ----------------------------------------------------------- |
| Waiver-gated `npm audit` | `pre-push`, `security.yml` | Any unwaived high/critical, any expired waiver              |
| `osv-scanner`            | `pre-push`                 | CRITICAL                                                    |
| Semgrep                  | `pre-push`                 | ERROR-severity rules                                        |
| `gitleaks` (staged)      | `pre-commit`               | Any finding, or the binary being absent                     |
| `gitleaks` (history)     | `pre-push`                 | Any finding not in the baseline, or the binary being absent |
| Import hardening         | `npm test`                 | Any failing case                                            |
| Workflow constraints     | `npm test`                 | Unpinned action, missing `permissions:`, write scope        |

The last two are Jest suites rather than scanner invocations. They need no binary, work
offline, run inside the gate that already exists, and encode this repository's specific
rules rather than a generic scanner's defaults.

## Adding a rule, waiving a finding

- **New Semgrep rule** — add it to `config/semgrep.yml` with a message that says what
  to do, not just what is wrong. `ERROR` blocks; `WARNING` is advisory.
- **Waiving an advisory** — `docs/security-exceptions.md` defines what a waiver must
  contain and what may never be waived. Do not lower a threshold to make a finding go
  away.
