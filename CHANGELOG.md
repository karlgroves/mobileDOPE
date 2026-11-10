# Changelog

All notable changes to the Mobile DOPE app are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- New DOPE Log starts the Distance unit at Settings → Default Units → Distance
  Unit instead of always starting at yards. Choosing a unit by hand still wins,
  and an edited log keeps the unit it was saved in.

## [1.2.0] - 2026-11-09

A feature release built on your own logged DOPE: the solution can now be
adjusted by the shots you have actually taken -- in elevation, in windage, by
interpolation between logged distances and by barrel state -- with a confidence
figure that stands aside when the logs disagree. Alongside it: marking and
measuring groups on a target, factory loads, custom calibers, automatic
backups, the device barometer, and a round of ballistics corrections, the
largest of which makes every windage figure about six times smaller and right.

### Added

- Factory loads. A new ammunition profile can start from one of 12 common
  Hornady and Berger loads: Factory Load at the top of the form fills in the
  published G1 and G7 ballistic coefficients, muzzle velocity, bullet and
  caliber, and every field stays editable. The table is built into the app and
  cites each manufacturer's product page and the date it was read. It is listed
  in the rifle and ammunition setup guide.
- The distance selectors on Start Session, the active session and the
  Ballistic Calculator now offer 100 to 1000 in 25-yard steps instead of
  100-yard steps, and open their list at the current distance (or the nearest
  one, for a distance not in the list). In meters the calculator offers the
  same figures, so 25-meter steps. A preset list that is still the old default
  moves to the new one; a list you edited in Settings → Distance Presets is
  kept.
- Android export folder. Settings → Data Management → Choose Export Folder picks
  a folder in the system picker; every manual export then also saves a copy
  there, and the share sheet still opens. If the folder can no longer be
  reached, exports go to the share sheet only and Settings says so. Automatic
  backups stay in the app's private storage. Not offered on iOS.
- Gusting wind in the ballistic calculator: an optional Gust Speed beside Wind
  Speed (which is then the lull). The solution shows a windage bracket, the
  hold for the lull to the hold for the gust.
- An optional profile QR code on the DOPE card. Card Settings → Profile QR Code
  → On Back prints the rifle and load as a QR code on a second page, the back
  of the card. The code is a mobiledope:// link that a phone's own camera
  scans, so the app still never asks for camera access. Importing from the
  link is not built yet. A profile whose names make the link too long for a
  code that scans reliably gets a note on the back instead of the code. The
  comparison card has no code, since it holds several loads.
- Share Target Image on DOPE Log Details sends a marked target to the share
  sheet as a PNG: the target as shown, with the distance it was shot at and the
  group's measurements under it, and without the zoom buttons. The distance is
  also shown above the measurements on the screen itself.
- The Environment screen records the light a reading was taken in — Day, Low
  Light or Night — with the reading, and it can be changed when a saved reading
  is edited. It is optional and starts unselected; readings saved before it
  existed show no light rather than an assumed Day. It travels in full backups.
- Custom calibers. Settings → Manage Calibers adds calibers that are not in the
  built-in list, each with its bullet diameter so spin drift uses the real
  figure rather than a guess from the name. They appear in the rifle and ammo
  caliber pickers marked "(custom)". Renaming one moves every rifle and ammo
  profile that uses it to the new name, after saying how many; deleting one is
  refused while any profile still uses it. The built-in calibers cannot be
  changed or deleted.
- Automatic backups on a daily or weekly schedule, chosen in Settings →
  Automatic Backup (Manual, the default, keeps today's behaviour). With no
  background task, a backup is written when the app opens or returns to the
  foreground and one is due. It is the ordinary full backup without latitude,
  saved in the app's private storage; the newest seven are kept. Settings shows
  when the last one ran and can share the newest through the share sheet.
- On a device with a barometer, the Environment screen offers Read Barometer,
  which fills in station pressure from the phone's own sensor. The reading is
  the pressure where you are standing — what the solver needs — so it is
  converted from hPa and never corrected to sea level. A calibration offset in
  Settings › Barometer corrects a phone that reads high or low; it applies to
  sensor readings only, never to a pressure you type. On iPhone the first
  reading asks for Motion & Fitness access, which is where iOS files the
  barometer; the privacy policy says so. (#62)
- DOPE logs record barrel state: whether the shot was a cold bore, and its
  position in the day's string. New DOPE Log suggests cold bore when the rifle
  has not fired for ten minutes, and the suggestion can be overruled or left
  unanswered. Both fields export to JSON and CSV, and an older backup without
  them still imports.
- The DOPE Curve says which distances you have DOPE at and which gaps are worth
  practising, so a thin spot in your data is visible rather than implied. Gaps
  narrower than 150 yards are not flagged, since interpolating across them is
  sound.
- The ballistic solution can be adjusted by your own logged DOPE. The relevant
  logs are compared against what the solver predicted for each of them, and the
  difference is applied to today's answer, weighted by how well each log
  matches. The solver's own figure stays on screen, a switch turns the
  adjustment off, and with no relevant logs nothing changes.
- The DOPE-adjusted elevation carries a confidence figure of its own, shown
  beside it in the same form as the per-log confidence. It reads how much
  relevant DOPE there is, how well evidenced those logs are, how closely they
  agree and how near they were shot to today's distance, and it names the weak
  one in plain words. Below 40% the solver's own figure stands and the screen
  says why, so logs that disagree with each other no longer average into a
  correction nobody measured.
- Mark Target, from DOPE Log Details: tap where each shot landed on a plain
  target or on a photo of your own, or enter its distance from the centre with
  Add Shot by Measurement (the route for a screen reader, keyboard or switch).
  Shots are numbered in order, with undo and clear. Enter the target's width
  and the group is measured as you go — extreme spread, mean radius,
  horizontal and vertical spread and CEP, in inches and in MOA at the log's
  distance. The saved target and its figures appear on
  the log, and a measurable group (two or more shots, with a width) replaces the
  log's typed group size with the measured one. Choosing a photo needs no
  permission, and the photo is kept with its location and other metadata
  removed. Upgrading adds two columns to the target table (migration 008).
- With no log near today's distance, the solution is adjusted by the offset
  interpolated between your logged distances either side, and says so ("Interpolated
  between your 430 and 560 yd logs"). Past the last logged distance the nearest
  offset is held, marked as extrapolated, and the screen asks for a sighter. The
  confidence figure drops the further today is from a log, and across a gap wide
  enough to be worth practising the solver's own figure stands. Only the logs
  either side of today's distance are solved, so a long history does not slow
  the screen.

- Range sessions show the same adjusted figure the calculator does. The active
  session screen now uses the calculator's own DOPE-adjustment hook, so the two
  screens cannot disagree about one shot: the adjusted elevation in large type,
  the caption saying where it came from, the confidence badge, the same "Adjust
  by my DOPE" switch, and an expandable breakdown of the solver's figure, the
  DOPE offset, each barrel-state correction and the shooter's manual trim, with
  the contributing logs beneath it. It loads the logs itself, so a shooter who
  went straight to a session is no longer told there is no historical data.
- Barrel state reaches the shooter. A cold-bore bias and a heat shift are read
  from your own logs -- each log's offset against the solver in that log's own
  conditions, which is what makes shots at 300 and 900 yards comparable -- and
  offered in a session. Both are off by default, each behind its own switch, so
  a correction drawn from three cold-bore shots is never dialled unasked.
- Windage is adjusted by your own logs too. Raw windage offsets cannot be
  averaged across different winds, so each offset is divided by the crosswind it
  was measured in before anything is averaged, and the weighted mean is
  multiplied by today's crosswind. The crosswind's sign carries through, so a
  log shot in a left-to-right wind corrects a right-to-left shot the way the
  bullet does. It uses the same evidence curve as the elevation offset.
- Saved Conditions, on the Session stack from the Environmental Data screen:
  every saved reading with its time, conditions and density altitude (derived
  where the stored field predates the column). Tapping one selects it, a second
  produces the comparison the app could already compute but never offered, and a
  third drops the oldest so readings can be walked against one you hold on to. A
  saved reading can also be edited.
- Settings -> DOPE-Assisted Aiming holds the three figures the adjustment uses:
  whether to adjust by your DOPE at all (on), the matching window a log must
  have been fired within to count (50 yd), and the confidence the app must have
  in itself before using its own correction (40%). Each default is taken from
  the module that consumes it rather than restated, and the user guide has a
  page on the feature.
- The target zooms, to 8x, and pans, with pinch or with buttons, and shots can
  be marked through the zoom. At full view a half-inch group on an 8.5-inch
  target is about twenty points across, so several marks landed inside one
  marker dot while the statistics reported the spread to two decimal places.
- Settings -> Automatic Backup -> Delete Automatic Backups removes the automatic
  backups, after confirmation, and clears the last-run time. Switching to Manual
  used to leave every one of them in place with uninstalling the only way out.
  With a schedule still on, a new backup is due at once, and the confirmation
  says so and suggests choosing Manual first.
- The opt-in app lock is accepted (ADR-015) and its setting is stored, off by
  default. **The lock itself is not shipped**: nothing reads the setting yet and
  Settings does not show a switch, so the app never offers a lock that locks
  nothing. When it lands it will use the device's own authentication and will
  gate the UI only -- it is not encryption, and the database and exports stay
  unencrypted. `expo-local-authentication` and its Face ID and biometric
  permissions are declared ahead of the gate, and `PRIVACY.md` says so. (#67)

### Fixed

- The Wind Table opened slowly with no sign it was working: the button stayed
  dimmed for about 15 s on the Simulator. It now opens straight to a spinner
  while the table is built, and builds it with one solve per distance instead
  of one per cell, about a fifth of the work, with the same figures. Its
  direction picker is also labelled Wind Direction once instead of twice.
- A shot logged from a range session or the calculator now appears at the top
  of DOPE Logs, with its date, without a pull to refresh. The new log had no
  timestamp until it was read back from the database, so the date sort put it
  last. DOPE Logs also reloads every log each time it comes back into view, so
  it no longer shows the one rifle's logs another screen loaded.
- New DOPE Log starts Dial Corrections in the selected rifle's turret unit
  (its click value type), and follows the rifle if another is picked, rather
  than always starting at MIL. Settings → Default Units → Angular Unit is the
  fallback. Choosing a unit by hand still wins, and an edited log keeps the
  unit it was saved in.
- New DOPE Log no longer says "No environmental data captured" and disables
  Save on a fresh launch when conditions were recorded in the last day. It
  shows that latest snapshot, with its age, and saves the log against it, by
  the same under-a-day rule as the DOPE ranking and Start Session. Older
  conditions still ask for new ones. The message now names a place that
  exists, Session → Current Conditions, instead of a Range tab the app does
  not have. Editing an existing log no longer needs conditions recorded first.
- The Coriolis correction is now a distance. It was computed as 2ω·v·t, which
  has the units of a velocity, so for a .308 it overstated the deflection about
  five times at 300 yards, two and a half times at 600 and by half at 1000,
  and understated it past about three seconds of flight. It is now the
  Coriolis acceleration integrated over the flight, with drag slowing the
  sideways speed it builds up, which at constant speed is the textbook
  ω·X·t·sin(latitude). A .308 at 1000 yards and 45° now drifts about 2.8",
  inside the 2.5-3.0" Litz publishes for a typical 1000 yard trajectory.
  The vertical (Eötvös) term was documented as extra drop when firing East; it
  is a lift, and the bullet strikes high. The dialled elevation already moved
  the right way, so only the description changed.
- The pre-push secret scan works from a git worktree. trufflehog could not open
  a worktree's `.git` file, so the hook failed and no branch could be pushed
  from one. It now scans a temporary shared clone of the worktree instead, which
  holds every branch and the worktree's own HEAD, so the scan covers what it
  covers from the main checkout, and a key committed only in the worktree,
  on its branch or at a detached HEAD, still blocks.
- Wind corrections are about six times smaller, and now right. The solver blew
  the bullet along with the air for its whole time of flight, so a 10 mph
  full-value wind at 500 yards on a .308 175 gr load read 122 inches (6.8 MIL)
  where the maker publishes 20.3 inches. It now uses the time the bullet loses
  to drag, and agrees with the published table to within an inch. Every
  windage figure — the solution, the wind table and the DOPE card — changes with
  it; moving-target lead, which is time of flight alone, does not. Found by the
  end-to-end solver test added for #68. Time of flight is now taken at the
  target rather than at the first integration step past it (up to a millisecond
  less), because lag time is small enough at short range for that step to
  matter, and trajectory points each carry their own drift instead of a linear
  share of the target's.
- The cold-bore suggestion on New DOPE Log says why it was made, truthfully. It
  used to read "Suggested from the 10 minutes since this rifle last fired"
  whatever the real gap was — so a rifle last fired three days ago was told it
  had been ten minutes. It now names the actual gap, distinguishes it from the
  ten-minute threshold, and says plainly when the rifle has no earlier logs or
  when its last shot time could not be read.
- The DOPE log CSV has a `Distance Unit` column. Each log keeps its own
  distance unit, so a distance of 500 could have been yards or meters.

- Starting a range session no longer re-stamps the conditions it copies. The
  copy carried `new Date().toISOString()`, so air measured weeks ago came back
  dated minutes ago -- and since the DOPE ranking began trusting the latest
  snapshot only while it is under 24 hours old, every session start defeated
  that limit and stale air was ranked as similar conditions. The copy now
  carries the source reading's own timestamp, and a session started on
  conditions over a day old says how old they are and offers Environment input
  first. (#192)
- The DOPE ranking uses the most recent snapshot when the shooter has not set
  current conditions, which on a cold launch is almost always -- without it a
  quarter of the ranking weight stopped discriminating while the card still
  said "from similar conditions". The fallback is used only while that snapshot
  can be shown to be under a day old, and the caption now claims only what was
  actually compared.
- With the adjustment on, the headline reads ELEVATION (ADJUSTED) while the log
  records the solver's own figure -- which is right, since every offset is
  logged minus predicted -- but nothing said so. A line under the save button
  now names both figures.
- An interpolated adjustment says what it drew on instead of leaving the
  relevant-DOPE list saying no log was close enough, is no longer built and
  solved while the Adjust by my DOPE switch is off, and predicts each log at its
  own distance rather than at the rounded yard it was grouped by (which gave a
  metric log two different offsets depending on the path that read it).
- The DOPE adjustment switch is drawn in the app's theme rather than the iOS
  system green, like the app's other switches.
- Clearing the barometer calibration offset now means no offset; the previously
  saved figure stayed applied to every reading while the field showed blank. A
  successful barometer read is also announced to screen readers, and the button
  keeps its accessible name while the spinner replaces its title.
- Shots can be placed by measurement. The marking surface could only be tapped,
  and a screen reader activates it at its centre, so VoiceOver and TalkBack
  users could only mark dead centre -- a group then reported as 0.00 in -- and a
  keyboard or switch user could not place a shot at all (WCAG 2.1.1). Add Shot
  by Measurement takes inches right of and above the centre and places the shot
  where a tap would, and the surface's hint points to it. A retried save also
  updates the log's row rather than leaving the old figures on screen.
- A target photo's metadata is stripped past the primary image. The stripper
  treated the first scan as running to the end of the file, so an MPF file's
  secondary images -- an iPhone HDR gain map or depth map, each a complete JPEG
  with EXIF of its own -- kept their metadata, GPS included. The saved stream
  now ends at the primary image's EOI.
- Automatic backups survive a clock set back: a file stamped with a set-back
  clock sorted oldest, so pruning deleted it as soon as it was written and Share
  Latest Backup sent an older file. An unrecognised stored schedule is treated
  as Manual, and a failure to record the backup time is logged rather than left
  as an unhandled rejection.
- Renaming a custom caliber validates the new name before asking for
  confirmation, instead of confirming an empty, duplicate or built-in name and
  then refusing it; a refused or failed delete now reports itself; and a rename
  whose commit fails restores the stored caliber list as well as the in-memory
  one, so storage no longer names a caliber no profile uses.

### Security

- Dependency advisories cleared: `undici` GHSA-2m5v-pch6-74hx,
  GHSA-qrxm-fqhp-jwvm and GHSA-xjj6-f33q-929c, by updating it to 6.29.1
  (#200). It is install-time only, through node-gyp. The first two were new
  and failed the audit gate; the third had been waived `fixable-now`, and its
  waiver is removed.

- Further advisories cleared across the release: 28 by a lockfile-only
  `npm audit fix`, four transitive dependencies bumped to patched releases, and
  the two unwaived `markdown-it` advisories. The waiver register is down from
  eleven entries to three -- `tar`, `nanoid`, `shell-quote`, `ws`, `form-data`
  and `ip-address` are all patched, `braces`'s advisory was withdrawn and
  `node-forge` is fixed, so each of those waivers is gone. What remains waived
  is `image-size` (two advisories, build-time only) and `zod`
  GHSA-mrhx-c7xc-m3w5, which Expo's own nested copy keeps reported; nothing
  under `src/` imports zod.
- The security register's waiver expiry dates are now checked, not just the
  waiver count, so a waiver cannot quietly outlive its justification.

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
- **Android permissions.** `ACTIVITY_RECOGNITION` (from `expo-sensors`, which
  the app does not use) and `WRITE_EXTERNAL_STORAGE` (from `expo-file-system`)
  were merged into the Android manifest unblocked, while the privacy policy said
  motion permissions were blocked. Both are now blocked, and a test checks every
  dangerous permission any installed native module declares.
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

[Unreleased]: https://github.com/karlgroves/mobileDOPE/compare/v1.2.0...develop
[1.2.0]: https://github.com/karlgroves/mobileDOPE/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/karlgroves/mobileDOPE/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/karlgroves/mobileDOPE/releases/tag/v1.0.0
[#17]: https://github.com/karlgroves/mobileDOPE/issues/17
[#21]: https://github.com/karlgroves/mobileDOPE/pull/21
[#23]: https://github.com/karlgroves/mobileDOPE/issues/23
[#24]: https://github.com/karlgroves/mobileDOPE/pull/24
[#25]: https://github.com/karlgroves/mobileDOPE/pull/25
