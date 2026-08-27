# Changelog

All notable changes to the Mobile DOPE app are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Breaking (component API):** `IconButton`'s `accessibilityLabel` prop is now
  required. An icon button renders a bare glyph, so without a label it announces
  as "button" and nothing more. Every existing call site already passed one, so
  no migration was needed in-tree; external consumers of `IconButtonProps` will
  see a type error until they add it.
- `SegmentedControl` and `UnitToggle` options now use `accessibilityRole="radio"`
  inside a `radiogroup` container rather than `button`, so a screen reader
  announces them as the mutually exclusive choices they are.
- The Modal backdrop is hidden from the accessibility tree. Screen-reader users
  dismiss with the close button or the platform back gesture; the backdrop was
  previously announced as an unlabelled tappable region ahead of the dialog's own
  content.

### Added

- `TextInput` now derives an accessible name from its `label`, appends
  ", required" when required, and folds `error`/`helperText` into
  `accessibilityHint`. React Native does not associate a sibling `<Text>` label
  with a field, so every text field in the app previously announced only as
  "text field".

### Fixed

- The 65 outstanding `react-native-a11y` label and hint findings in `src/`, and
  both rules raised from `warn` to `error` (see ADR-010). `lint-staged` now runs
  `eslint --fix --fix-type problem,layout,suggestion` so the descriptor rule's
  autofixer can no longer silently stamp placeholder
  `accessibilityLabel="Text input field"` props on commit.

## [1.0.0] - 2026-07-20

First tagged release. Ships the entire application (113 commits, 23 features, 3 fixes);
`main` previously held only the initial Expo scaffold.

### Added

- Ballistic curve visualization, wind chart, and Wind Table screen
- PDF export for calculator results, DOPE logs, and range session summaries
- DOPE card formats including condensed and night-vision modes
- Save-to-DOPE-Log quick action, quick adjustment inputs, and distance presets
- Ammunition comparison mode and chronograph integration for velocity logging
- Range Session Mode with session tracking and export
- ShotString, RangeSession, and TargetImage models and repositories
- Database backup/restore and AppSettings persistence via AsyncStorage
- Navigation state persistence and model factories for testing
- Portrait and landscape support with responsive layouts for orientation changes
- Screen timeout setting and haptic feedback toggle for range use

### Fixed

- **Ballistics drag model** — replaced a hand-tuned constant with the physical
  point-mass formula, correcting over-predicted drop ([#23], [#24])

### Changed

- Adopted a quality, lint, and security tooling stack; decisions recorded as
  ADR-007..011 ([#17], [#25])
- Dependency updates and export/import security hardening ([#21])
- Pinned the Node floor to 24.15 / npm 11; CI reads `.nvmrc`

### Known limitations

- Test coverage is 18.85% against a declared 70% threshold; enforcement is deferred to a
  test-backfill effort (ADR-010). The suite passes: 455 passed, 1 skipped.
- `npm run security:audit` reports high-severity advisories in Expo transitive
  dependencies with no upstream fix available; re-check on the next Expo bump.

[Unreleased]: https://github.com/karlgroves/mobileDOPE/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/karlgroves/mobileDOPE/releases/tag/v1.0.0
[#17]: https://github.com/karlgroves/mobileDOPE/issues/17
[#21]: https://github.com/karlgroves/mobileDOPE/pull/21
[#23]: https://github.com/karlgroves/mobileDOPE/issues/23
[#24]: https://github.com/karlgroves/mobileDOPE/pull/24
[#25]: https://github.com/karlgroves/mobileDOPE/pull/25
