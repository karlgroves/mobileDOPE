# Changelog

All notable changes to the Mobile DOPE app are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-09-30

A feature release: your own logged DOPE now shapes what the app shows you,
alongside a round of fixes found by using the app on a device.

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

- **Logged DOPE beside the solution.** The calculator shows your own logged
  entries for the shot in front of you, ranked by how closely each log's
  recorded conditions match (#96, #113, #126), with how well-evidenced each
  entry is (#112).
- **DOPE Curve.** Your logged drop drawn against the solver's curve, each
  marker's opacity showing its confidence, with axis values, a legend, export,
  and pinch or drag to zoom and pan along distance (#143, #146). Entries that
  disagree with the rest are listed (#127), and muzzle-velocity and BC changes
  are suggested from what you logged (#124).
- **Analysis.** Confidence, outliers and corrections read back from logged DOPE
  (#93); group statistics from marked points of impact (#94).
- **Ballistics.** Spin drift and Coriolis, which the solver already computed,
  are applied to the solution (#97).
- **Cards and sessions.** Several loads side by side on one DOPE card (#105);
  conditions compared between sessions (#99).
- **Import** plans merge-versus-replace instead of always duplicating (#95).
- **Deep links** into the app (#102).
- **Privacy.** Precise location is no longer collected: latitude is coarsened
  to about 11 km and longitude is never recorded; permissions are declared and
  a privacy policy is published (#46).
- An end-user guide (#88).
- `TextInput` now derives an accessible name from its `label`, appends
  ", required" when required, and folds `error`/`helperText` into
  `accessibilityHint`. React Native does not associate a sibling `<Text>` label
  with a field, so every text field in the app previously announced only as
  "text field".

### Fixed

- **Fresh installs launch.** Migration 001 built the live schema, so 002 failed
  on every new install (#128, #130).
- **No DOPE history is lost in migrations.** They run with foreign keys
  suspended and a `foreign_key_check` before commit; migration 004 had deleted
  every DOPE log through a cascade (#57).
- **Crashes and wrong readings from empty fields.** Empty columns read as
  `undefined`, a recorded 0 hits is kept as 0, and a screen that throws shows a
  recoverable error instead of a blank app (#134, #136).
- **Restored screens.** DOPE Log Details and Edit load their log by id after a
  relaunch instead of calling it missing (#141, #147).
- **New DOPE Log** says what it needs when there are no rifle or ammunition
  profiles (#132, #140).
- **Navigation.** The last tab is Session again, and Home's Env indicator opens
  the weather screen (#131, #142). Settings and the DOPE Curve are reachable
  (#91).
- **Theme.** Headers, the tab bar and every shared component follow the chosen
  theme (#120, #144, #150); the theme switcher no longer leaves the chosen
  option washed out (#145, #151); text colours meet WCAG AA on every theme
  (#115, #118, #121).
- **Units.** Distances are converted at the solver boundary instead of
  relabelled, and logs are read in yards and one correction unit on the curve
  and in analysis (#107, #125). One caliber database with diameters the solver
  can trust (#103). The calculator no longer requires an altitude the solver
  never reads (#98), and says which pressure it wants (#92).
- **Native dependencies** match Expo SDK 55: victory-native's Skia, Reanimated,
  Gesture Handler and Worklets (#139), and `expo-font` / `expo-asset`.
- The 65 outstanding `react-native-a11y` label and hint findings in `src/`, and
  both rules raised from `warn` to `error` (see ADR-010). `lint-staged` now runs
  `eslint --fix --fix-type problem,layout,suggestion` so the descriptor rule's
  autofixer can no longer silently stamp placeholder
  `accessibilityLabel="Text input field"` props on commit.
- `expo-font` and `expo-asset` are now direct dependencies at the SDK 55
  versions (#137). `expo-font` previously arrived only as a peer of
  `@expo/vector-icons`, which resolved it to 14.0.11 (SDK 54) and linked that
  native module into the app; it also could not resolve `expo-asset`, so no
  test could render the icon sets. A unit test now checks that every
  SDK-pinned native package is installed within its pin.
- DOPE log CSV export (#138):
  - The `Hit` column exported "Yes" for any log with a shot count, including
    0 hits from 5. It is replaced by separate `Hits` and `Shots` columns. A
    single "3/5" cell would open in a spreadsheet as a date.
  - The temperature, humidity, pressure, wind and altitude columns were
    always empty. They now come from each log's environment snapshot, and
    their headers carry units (°F, %, inHg, mph, °, ft).
  - Negative numbers, such as a left windage correction, exported as text
    (`'-0.5`) because the formula-injection guard also caught a leading
    minus. Numbers are no longer prefixed; free text still is.
- Migration 006 drops the always-NULL `environment_snapshots.longitude` column
  that migration 005 emptied but could not remove (#133). SQLite's
  `DROP COLUMN` removes it in place, with no table rebuild; databases that
  never had the column are skipped. Every install now matches `DB_SCHEMA`.
- Night vision's secondary text was `#cc0000`: 3.42:1 on its surface and
  3.52:1 on its background, under the 4.5:1 WCAG AA needs for labels,
  captions, legends and list metadata across the app (#148). It is now the
  primary red, `#ff0000` (5.03:1), and secondary text is told apart by size
  and weight. The tab bar could no longer mark the active tab by label colour
  in that theme, so there the active tab is filled red with a black label,
  as a selected segment is. The bar is also 8pt taller: at its old height
  the label overflowed its item, which the fill made visible.

### Security

- Dependency advisories cleared: 15 high advisories (#76), `undici`
  GHSA-rfgv-xxqx-mfg5 (#135) and `brace-expansion` GHSA-qhr7-859c-m2p7 and
  GHSA-6j4f-fj2g-mc7p (#149).
- Secret scanning with TruffleHog in the pre-commit and CI gates (#79, #109),
  and ten spec-audit gaps closed (#49, #56).

## 1.0.1 - 2026-09-29

Released on `main` as a hotfix; not tagged.

### Fixed

- A fresh install could not get past launch: migration 001 created the live
  schema and 002 then failed adding a column that already existed (#128, #129).

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

[Unreleased]: https://github.com/karlgroves/mobileDOPE/compare/v1.1.0...develop
[1.1.0]: https://github.com/karlgroves/mobileDOPE/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/karlgroves/mobileDOPE/releases/tag/v1.0.0
[#17]: https://github.com/karlgroves/mobileDOPE/issues/17
[#21]: https://github.com/karlgroves/mobileDOPE/pull/21
[#23]: https://github.com/karlgroves/mobileDOPE/issues/23
[#24]: https://github.com/karlgroves/mobileDOPE/pull/24
[#25]: https://github.com/karlgroves/mobileDOPE/pull/25
