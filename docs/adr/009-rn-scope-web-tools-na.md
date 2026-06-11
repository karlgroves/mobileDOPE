# ADR-009: Web/DOM-only tooling is out of scope for this React Native app

**Status:** Accepted

**Date:** 2026-06-11

## Context

Issue #17 describes a tooling stack aimed at Vite/React **web** projects. This app is
React Native + Expo: it renders through native views, ships no DOM, has no CSS/SCSS,
serves no HTML, and has no SEO surface. A large fraction of the issue therefore does
not apply to this codebase.

## Decision

Adopt only the React-Native-relevant portions of the standardization. The following
items from issue #17 are intentionally **not applicable** and are omitted:

- **Bundler/build:** Vite, `vite build`/`preview`, `react-jsx`/DOM `tsconfig`,
  `verbatimModuleSyntax`/`isolatedModules` bundler settings (the app uses Metro/Expo).
- **Accessibility (DOM-based):** `eslint-plugin-jsx-a11y` (RN has no DOM elements or
  ARIA), `@afix/a11y-assert` at component/E2E/preview levels (it asserts on the DOM).
  React Native accessibility is a separate concern handled via RN's `accessibility*`
  props and manual testing.
- **CSS quality:** Stylelint and `@double-great/stylelint-a11y` (no CSS/SCSS files).
- **E2E:** Playwright (no browser surface to drive; RN E2E would use Detox/Maestro).
- **Performance/SEO web tools:** Lighthouse CI, `size-limit` + `@size-limit/preset-app`,
  `web-vitals`, React Compiler Vite plugin, `react-helmet-async`, `schema-dts`,
  sitemap/`robots.txt`/`llms.txt`, SSR/SSG.
- **Node/Express-only ESLint plugins:** `eslint-plugin-security` and `eslint-plugin-n`
  target Node/Express runtimes, not the RN/Hermes runtime.

## Consequences

### Positive

- The adopted tooling matches what the app actually is; no dead config for absent
  surfaces.
- Contributors are not asked to install or satisfy gates that cannot apply.

### Negative

- RN accessibility and bundle-size budgets are not covered by these specific tools;
  they remain manual/Expo-native concerns.

### Risks

- If a web build target (e.g. `expo start --web` hardened for production) becomes a
  real surface, revisit and layer in the web tooling for that target only.
