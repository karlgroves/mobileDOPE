# ADR-007: Keep the legacy ESLint config and `eslint-config-expo`

**Status:** Accepted

**Date:** 2026-06-11

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
