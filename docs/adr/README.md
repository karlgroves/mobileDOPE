# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Mobile DOPE app.

## What is an ADR?

An Architecture Decision Record (ADR) captures an important architectural decision made along with its context and consequences.

## ADR Format

Each ADR follows this structure:

```markdown
# ADR-XXX: Title

**Status:** Proposed | Accepted | Deprecated | Superseded

**Date:** YYYY-MM-DD

## Context

What is the issue we're seeing that is motivating this decision or change?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

What becomes easier or more difficult to do because of this change?

### Positive

- Benefit 1
- Benefit 2

### Negative

- Cost 1
- Cost 2

### Risks

- Risk 1
- Risk 2
```

## Index

1. [ADR-001: Use React Native with Expo](./001-use-react-native-expo.md)
2. [ADR-002: Use SQLite for Local Storage](./002-use-sqlite-storage.md)
3. [ADR-003: Use Zustand for State Management](./003-use-zustand-state.md)
4. [ADR-004: Caliber-Based Ammunition Architecture](./004-caliber-based-ammo.md)
5. [ADR-005: TypeScript Ballistic Engine](./005-typescript-ballistic-engine.md)
6. [ADR-006: Test-Driven Development](./006-test-driven-development.md)
7. [ADR-007: Keep the legacy ESLint config and `eslint-config-expo`](./007-keep-legacy-eslint-expo.md)
8. [ADR-008: Keep Jest instead of switching to Vitest](./008-keep-jest-over-vitest.md)
9. [ADR-009: Web/DOM-only tooling is out of scope for this React Native app](./009-rn-scope-web-tools-na.md)
10. [ADR-010: Pragmatic adoption — noisy rules start as warnings](./010-pragmatic-quality-adoption.md)
11. [ADR-011: Local-gate-first; no new GitHub Actions, Dependabot, or CodeQL](./011-local-gate-first-no-new-actions.md)

## Contributing

When making a significant architectural decision:

1. Create a new ADR file using the next sequential number
2. Fill in all sections thoroughly
3. Submit for review
4. Update the index in this README
5. Once accepted, commit to the repository
