# Use cases

Every user interaction in Mobile DOPE, written as structured YAML.

These are the specification the E2E suite in [#20](https://github.com/karlgroves/mobileDOPE/issues/20)
consumes. Writing them first means the flows arrive already described, rather than
being invented at automation time.

## Format decision

[#18](https://github.com/karlgroves/mobileDOPE/issues/18) left one question open, and
it had to be settled before ~25 files were written in the wrong shape:

> 1. **Keep the DSL verbatim** so the files stay drop-in compatible if a runner ever
>    targets React Native…
> 2. **Keep the frontmatter fields but relax `steps:`** to prose, since nothing
>    validates them.

**Option 1.** The steps use the `@afixt/usecase-runner` DSL verbs unchanged.

The reasoning in that thread is the reason: the constraint of writing real verbs is
what keeps a use case honest about whether an element is actually reachable. Prose
lets you write "the user reviews the solution" and never discover that the value is
rendered in a `<Text>` with no accessible name. `focus: button "Calculate"` does not
let you get away with that.

It also makes #20 cheap. Maestro flows are YAML too, so translating
`activate: button "X"` into `tapOn: "X"` is mechanical rather than fresh authoring.

**What is not run:** the runner's Playwright codegen. Per
[ADR-009](../adr/009-rn-scope-web-tools-na.md) there is no browser surface to drive —
`react-native-web`, `react-dom` and `@expo/metro-runtime` are all absent, so
`expo start --web` will not boot. The DSL is used here purely as an authoring format.
That door stays open: if a web target ever appears, these files are already valid
input.

## Adaptations for React Native

The reference library at `AFixt/audit-usecases` targets web pages. Two fields change
meaning here, and nothing else does:

| Field            | Web                          | Here                                                                                                                      |
| ---------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `start_location` | A URL                        | A navigator route, as `Stack/ScreenName` — matching `src/navigation/types.ts`                                             |
| `audit: page`    | An axe run over the document | A screen-level accessibility check. Automated coverage is `eslint-plugin-react-native-a11y`; the rest is manual (ADR-009) |

`lang_check` is omitted throughout: it asserts a document `lang` attribute, which has
no React Native equivalent.

## Anatomy

```yaml
id: rifles-create-profile # unique, kebab-case, area-prefixed
title: 'Create a rifle profile'
type: positive # or negative, for the failure paths
description: >- # what this exercises and why it matters
preconditions: # what must be true before step 1
start_location: 'Rifles/RifleProfileList'
expected_result: >- # the observable outcome, not the mechanics
data: # substitutable values, each with a REPLACE comment
steps: # DSL verbs, referencing data as {{ handlebars }}
```

Every `data` value carries a comment saying what to replace it with. The accessible
names in these files are the ones the app should have, not necessarily the ones it has
today — where they differ, that is a finding, which is the point.

## The flows

| Area       | File                                          | Covers                                                         |
| ---------- | --------------------------------------------- | -------------------------------------------------------------- |
| Dashboard  | `dashboard/quick-solution.uc.yaml`            | The one-tap loop: adjust distance and wind, confirm a shot     |
| Dashboard  | `dashboard/empty-state.uc.yaml`               | First run, before any rifle or ammo exists                     |
| Rifles     | `rifles/create-profile.uc.yaml`               | `RifleProfileList` → `RifleProfileForm` → `RifleProfileDetail` |
| Rifles     | `rifles/edit-profile.uc.yaml`                 | Editing an existing profile                                    |
| Rifles     | `rifles/delete-profile.uc.yaml`               | Destructive action and its confirmation                        |
| Rifles     | `rifles/validation-rejects-bad-input.uc.yaml` | Negative: out-of-range ballistic input                         |
| Rifles     | `rifles/clone-profile.uc.yaml`                | Duplicating a rifle as the basis for a new one                 |
| Rifles     | `rifles/ammo-for-rifle.uc.yaml`               | Per-rifle `AmmoProfileList`                                    |
| Ammo       | `ammo/create-profile.uc.yaml`                 | `AllAmmoProfileList` → `AmmoProfileForm`                       |
| Ammo       | `ammo/search-and-sort.uc.yaml`                | Finding a profile in a long list                               |
| Ammo       | `ammo/compare.uc.yaml`                        | `AmmoCompare`                                                  |
| Ammo       | `ammo/chronograph-entry.uc.yaml`              | `ChronographInput`                                             |
| Ammo       | `ammo/shot-string-history.uc.yaml`            | `ShotStringHistory`                                            |
| Ammo       | `ammo/dope-card.uc.yaml`                      | `DOPECardGenerator` and its PDF export                         |
| Calculator | `calculator/ballistic-solution.uc.yaml`       | `BallisticCalculator` → `BallisticSolutionResults`             |
| Calculator | `calculator/wind-table.uc.yaml`               | `WindTable`                                                    |
| Calculator | `calculator/moving-target.uc.yaml`            | `MovingTargetCalculator`                                       |
| Calculator | `calculator/missing-inputs.uc.yaml`           | Negative: solving without a rifle or ammo                      |
| Session    | `session/start-session.uc.yaml`               | `RangeSessionStart` → `RangeSessionActive`                     |
| Session    | `session/record-shots.uc.yaml`                | The gloved, one-tap field loop                                 |
| Session    | `session/finish-session.uc.yaml`              | `RangeSessionSummary`                                          |
| Session    | `session/environment-manual.uc.yaml`          | `EnvironmentInput` by hand                                     |
| Session    | `session/environment-gps-granted.uc.yaml`     | Location permission granted                                    |
| Session    | `session/environment-gps-denied.uc.yaml`      | Negative: permission denied, app stays usable                  |
| History    | `history/browse-logs.uc.yaml`                 | `DOPELogList` → `DOPELogDetail`                                |
| History    | `history/edit-log.uc.yaml`                    | `DOPELogEdit`                                                  |
| History    | `history/dope-curve.uc.yaml`                  | `DOPECurve`                                                    |
| History    | `history/export-logs.uc.yaml`                 | CSV / JSON / PDF export                                        |
| Settings   | `settings/change-units.uc.yaml`               | MIL↔MOA, yards↔meters                                          |
| Settings   | `settings/distance-presets.uc.yaml`           | Adding and removing presets                                    |
| Settings   | `settings/backup-and-restore.uc.yaml`         | Full backup export and import                                  |
| Settings   | `settings/delete-location-data.uc.yaml`       | The privacy retention control                                  |

## Field-use constraints these encode

CLAUDE.md's design constraints are not decoration, and several use cases assert them
directly rather than leaving them to a design review:

- **One-tap entry.** `dashboard/quick-solution` and `session/record-shots` count the
  interactions between "conditions are set" and "shot is logged". If that number grows,
  the use case fails.
- **Gloved operation.** Touch targets on the session screen are asserted against the
  48pt minimum in `src/constants/theme.ts`.
- **The app works with location denied.** `session/environment-gps-denied` is a
  first-class flow, not an error case.
