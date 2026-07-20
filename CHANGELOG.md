# Changelog

All notable changes to the Mobile DOPE app are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
