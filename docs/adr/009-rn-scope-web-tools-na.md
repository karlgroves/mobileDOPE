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
- **Accessibility (DOM-based only):** `eslint-plugin-jsx-a11y` (RN has no DOM elements
  or ARIA) and `@afix/a11y-assert` at component/E2E/preview levels (it asserts on the
  DOM). These specific tools cannot run here.

  Accessibility itself is **not** out of scope. React Native has its own accessibility
  API, and it is lintable: `eslint-plugin-react-native-a11y` is adopted in
  `.eslintrc.js` to cover RN's `accessibilityRole`, `accessibilityState`,
  `accessibilityValue`, `accessibilityActions`, `accessibilityLabel`/`Hint`, live
  regions, and nested touchables. Malformed props are `error`; missing labels/hints are
  `warn` while the existing screens are remediated (see ADR-010).

  Note the plugin's published peer range stops at ESLint 8, so `package.json` carries an
  `overrides` entry pinning it to this repo's ESLint 9. This was verified to load and
  report correctly under ESLint 9 in eslintrc-compat mode; revisit if the plugin
  publishes native ESLint 9 support or if a future ESLint upgrade breaks it.

  Still not covered automatically, and remaining manual concerns: screen-reader
  behaviour (VoiceOver/TalkBack), focus order, contrast, and dynamic-type/scaling.

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

- Bundle-size budgets are not covered; they remain an Expo-native concern.
- RN accessibility linting catches prop-level mistakes only. Screen-reader flow,
  focus order, and contrast still require manual testing on device.

### Risks

- If a web build target (e.g. `expo start --web` hardened for production) becomes a
  real surface, revisit and layer in the web tooling for that target only.
