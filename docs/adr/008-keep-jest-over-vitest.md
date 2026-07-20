# ADR-008: Keep Jest instead of switching to Vitest

**Status:** Accepted

**Date:** 2026-06-11

## Context

Issue #17 proposes Vitest (with `vitest/globals` types and the v8 coverage provider)
as the unit/integration test runner.

This app already uses Jest with `ts-jest` and `jest-expo`, a working `jest.config.js`
(path-alias mapping, coverage thresholds), and an existing test suite under
`__tests__/`. The project's documented methodology is TDD on Jest (see ADR-006).

Vitest has no first-class React Native / Expo preset; `jest-expo` is the supported
path for transforming RN modules. The issue's own ground rules say not to replace
working tooling without a demonstrable quality win.

## Decision

Keep Jest. The Vitest-specific items in issue #17 are not adopted. `npm test`,
`npm run test:watch`, and `npm run test:coverage` continue to run Jest.

## Consequences

### Positive

- The existing test suite and TDD workflow are unchanged.
- RN module transformation keeps working through `jest-expo`.

### Negative

- The repo does not gain Vitest's faster ESM-native runner.

### Risks

- If a non-RN, Vite-based surface is ever added, revisit this decision for that
  surface only.
