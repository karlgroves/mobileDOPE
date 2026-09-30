# ADR-010: Pragmatic adoption — noisy rules start as warnings, gates green today

**Status:** Accepted

**Date:** 2026-06-11

## Context

Issue #17 specifies aggressive defaults: ESLint rules at `error` (including
`jsdoc/require-jsdoc` on all exports, `@typescript-eslint/naming-convention`, file and
function size caps), `jscpd` at a 1% duplication threshold, and `tsconfig` strictness
including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.

Applying all of these as hard failures against the existing app surfaces hundreds of
findings — many subjective (documentation, complexity) or behaviour-sensitive — which
would force a large, risky diff. The issue also instructs not to change existing code
logic.

## Decision

Adopt the full applicable plugin/config set, but split severity pragmatically so the
gate is real (errors block) without forcing bulk edits:

- **ESLint `error`** — safe, deterministic rules: `no-secrets/no-secrets`,
  `promise/no-return-wrap`/`param-names`, `import/no-duplicates`/`no-self-import`/
  `no-useless-path-segments`, `no-eval` family.
- **ESLint `warn`** — noisy/subjective rules surfaced for incremental cleanup:
  `sonarjs/*`, `max-lines*`, `complexity`, `max-depth`, `jsdoc/*`, `import/order`,
  `@typescript-eslint/no-explicit-any`. These can be promoted to `error` in follow-ups.
- **ESLint `off`** — `unicorn/filename-case`: the app mixes PascalCase components,
  camelCase utilities, and numbered migration files; enforcing one case is out-of-scope
  churn.
- **`jscpd`** — threshold set to `10%` (current duplication is ~8%) so the gate passes
  today; it is a ratchet to tighten as duplication in screens/PDF templates is reduced.
- **`tsconfig`** — added `noImplicitOverride`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames` (findings fixed).
  `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are **deferred** to avoid
  widespread type churn. `@total-typescript/ts-reset` is added via `src/reset.d.ts`; the
  handful of `unknown`-from-`JSON.parse` sites it surfaced were typed explicitly.
- **Test coverage** — issue #17 asks for an enforced 80% threshold. `jest.config.js`
  already declares 70%, but actual coverage is **18.85%** statements / 16.66% branches,
  so `npm run test:coverage` fails today and did so before this change. Raising the
  number to 80% would make an already-failing gate fail harder without adding a single
  test. The existing 70% declaration is left as the ratchet target and **enforcement is
  deferred** to a dedicated test-backfill effort; `npm run check` deliberately does not
  run coverage, so this does not mask a regression in the day-to-day gate.
- **`react-native-a11y`** — structural rules (malformed `accessibilityRole`/`State`/
  `Value`/`actions`, nested touchables) are `error`. The "missing label/hint" rules
  (`has-valid-accessibility-descriptors`, `has-accessibility-hint`) started as `warn`
  against a backlog originally estimated at ~84 findings. **This deferral is now
  closed** — see the addendum below. See ADR-009.

## Consequences

### Positive

- `npm run lint` passes with **0 errors** today; `npm run check` (lint + type-check +
  markdownlint + dupes) is green on a clean clone.
- The gate blocks real regressions while warnings track the cleanup backlog.

### Negative

- Some quality signals are warnings, not failures, so they can accumulate if ignored.

### Risks

- Deferred `tsconfig` flags, the `jscpd` threshold, the a11y warn-level rules, and
  coverage enforcement all need follow-up issues to ratchet them toward the issue's
  stricter targets. Coverage is the largest gap by far (18.85% vs. a 70% declaration).

## Addendum (2026-08-26): the a11y warn-level deferral is closed

Both "missing label/hint" rules are now **`error`** in `.eslintrc.js`. Issue #30
remediated the backlog and this ADR's deferral no longer applies to them. Everything
else recorded above — the deferred `tsconfig` flags, the `jscpd` threshold, the
coverage posture — is unchanged.

### What the backlog actually was

The original "~84 findings" over-counted. 15 were in `__tests__/components/TextInput.test.tsx`
rather than production code and were scoped out in #35, for a reason worth repeating:
lint-staged runs `eslint --fix` on staged files, and the descriptor rule's autofixer
silently inserted placeholder `accessibilityLabel="Text input field"` props into all 15
`<TextInput>` fixtures — modifying the components under test and converting 15 "missing
descriptor" warnings into 15 "missing hint" warnings, with no accessibility benefit.

One further finding disappeared with `RangeScreen.tsx` in #33. The real production
backlog measured **65 findings across 20 files** when remediation began: 50
`has-valid-accessibility-descriptors` and 15 `has-accessibility-hint`.

### Why the rules can now be errors

Fixing the eight shared components (`TextInput`, `NumberInput`, `NumberPicker`,
`Picker`, `Modal`, `ListItem`, `IconButton`, `SegmentedControl`, `UnitToggle`) removed
13 findings directly and, more importantly, moved the accessible-name responsibility
into the components themselves. `TextInput` in particular had **no** accessible name at
all: React Native does not associate a sibling `<Text>` label with a field the way a web
`<label for>` does, so every text field in the app announced as "text field" and nothing
else. That was the single largest real defect behind the warning count, and it was
invisible in the per-file tallies.

`IconButton.accessibilityLabel` is now **required** rather than optional. An icon button
is a bare glyph; without a name it is unusable by ear. TypeScript found every call site.

### The standard new code is held to

Labels must disambiguate **units and axis**, per the field-use constraints in CLAUDE.md.
A ballistic correction rendered as `↑ 2.34` must announce as "elevation 2.34 mils", not
"up 2.34"; a windage control showing `R 1.2` must say "1.2 mils right". Generic labels
that merely satisfy the rule are a regression dressed as a fix, and the autofixer
produces exactly those — do not use `eslint --fix` for these two rules.

### Out of scope, still manual

Per ADR-009: screen-reader behaviour (VoiceOver/TalkBack), focus order, colour contrast
and dynamic-type scaling remain manual. The linter cannot see them, and nothing here
should be read as claiming the app is accessible — only that this class of defect is now
gated.
