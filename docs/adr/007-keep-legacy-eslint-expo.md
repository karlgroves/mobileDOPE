# ADR-007: Keep the legacy ESLint config and `eslint-config-expo`

**Status:** Superseded by the flat-config migration in #75 (2026-09-16)

**Date:** 2026-06-11

> **Superseded.** The blocker this ADR recorded was that `eslint-config-expo` assumed
> the eslintrc format. Expo SDK 55 ships `eslint-config-expo/flat`, so it no longer
> does, and `ESLINT_USE_FLAT_CONFIG=false` is gone along with `.eslintrc.js`.
>
> What this ADR decided is otherwise **unchanged and still in force**: the flat config
> is a faithful translation of the eslintrc, rule for rule. It did not adopt
> `strictTypeChecked`, did not move rules to `error`, and did not take the wider plugin
> set from #17 — the second half of this ADR's decision, about which rules belong here,
> stands as written. Verified rather than asserted: both configs report the same 12
> rules, the same 570 warnings and the same 0 errors over the same files.
>
> Two things flat config does differently were pinned back deliberately rather than
> absorbed, each with its reasoning in `eslint.config.js`: it lints dotfiles and
> `.mjs` (the old run was `--ext .js,.jsx,.ts,.tsx`), and it reports unused
> `eslint-disable` directives. Widening either is worth doing as its own change.

## Context

Issue #17 proposes migrating to a flat ESLint config (`eslint.config.js`) built on
`typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked` plus a large plugin
set, with most rules at `error`.

This app is a React Native / Expo project. It consumes `eslint-config-expo`, which
the Expo toolchain (`expo lint`, Metro, the RN preset) assumes, and it runs ESLint 9
in legacy (`eslintrc`) mode via `ESLINT_USE_FLAT_CONFIG=false`. The existing
`.eslintrc.js` is functional and intentionally on the legacy format.

The issue's own ground rules state: "Do not replace anything that already exists in
this project unless the new proposal leads to a demonstrably higher quality outcome."

A full flat-config migration would have to re-express the Expo preset, the React/RN
rules, and the `strictTypeChecked` type-aware program — generating thousands of
findings and risking conflicts with `eslint-config-expo`, for no demonstrable quality
win over the existing setup.

## Decision

Keep the legacy `.eslintrc.js` format and `eslint-config-expo`. Layer the
standardization plugin set on top of the existing config rather than replacing it
(see ADR-010). The ESLint binary stays at v9, invoked with
`ESLINT_USE_FLAT_CONFIG=false`.

## Consequences

### Positive

- No churn against the working Expo lint baseline; the gate stays green.
- The Expo/React Native rule coverage is preserved exactly as before.
- The new plugins still add real value (see ADR-010) without a risky rewrite.

### Negative

- ESLint emits a deprecation notice for the eslintrc format (support removed in
  v10). Migrating to flat config is deferred until `eslint-config-expo` ships a
  first-class flat preset.

### Risks

- A future ESLint 10 upgrade will force the flat-config migration; revisit then.
