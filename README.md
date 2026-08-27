# MobileDOPE App

React Native mobile application for the DOPE (motorsports/racing) platform, built with Expo.

## Tech Stack

- React Native with Expo
- TypeScript
- SQLite (local database with migrations)
- React Navigation
- TanStack React Query for data fetching
- Zustand for state management
- React Native Gesture Handler
- AsyncStorage for settings persistence

## Getting Started

### Prerequisites

- Node.js 24.15+ and npm 11+ (pinned in `.nvmrc` / `.node-version`; CI reads the same file)
- Expo CLI
- iOS Simulator (macOS) or Android Emulator

### Installation

```bash
npm install
```

### Development

```bash
npx expo start
```

## Project Structure

```text
src/
├── components/     # Reusable UI components
├── constants/      # Theme and configuration constants
├── contexts/       # React Context providers (Theme)
├── hooks/          # Shared React hooks
├── models/         # Domain entities (RifleProfile, AmmoProfile, DOPELog, ...)
├── navigation/     # React Navigation setup
├── screens/        # Screen components
├── services/       # SQLite repositories, migrations, export and import
├── store/          # Zustand stores
├── types/          # Shared TypeScript types
└── utils/          # Ballistic math and utility functions
```

## Features

- Local SQLite database with a migration runner
- Theme support (light, dark, night vision modes)
- Ballistic solver: elevation and windage, spin drift, Coriolis, aerodynamic jump,
  transonic and subsonic handling
- DOPE logging, wind tables, DOPE card generation
- Export to JSON, CSV, Markdown and PDF; import from a JSON backup
- Error boundary handling

**Not present**, despite what earlier revisions of this file claimed: there is no
analytics integration, no offline queue, no deep-link scheme (`app.config.ts` declares
no `scheme`), no TanStack React Query and no gesture handler. The app has **no network
layer at all** — the only `fetch` in `src/` reads a local `file://` URI during import.
See `PRIVACY.md`.

## Scripts

| Script                                           | Purpose                                                 |
| ------------------------------------------------ | ------------------------------------------------------- |
| `npm start`                                      | Start the Expo dev server                               |
| `npm run ios` / `npm run android`                | Run on a simulator/emulator                             |
| `npm run lint` / `npm run lint:fix`              | ESLint (legacy config via `eslint-config-expo`)         |
| `npm run format` / `npm run format:check`        | Prettier                                                |
| `npm run type-check`                             | TypeScript `tsc --noEmit`                               |
| `npm run markdownlint`                           | Lint Markdown with `markdownlint-cli2`                  |
| `npm run dupes`                                  | Duplication check (`jscpd`)                             |
| `npm test` / `npm run test:coverage`             | Jest unit/integration tests                             |
| `npm run test:e2e`                               | Maestro E2E flows on a simulator (see below)            |
| `npm run check`                                  | Parallel gate: lint + type-check + markdownlint + dupes |
| `npm run check:all`                              | Full gate: `check` + format check + tests               |
| `npm run security:audit`                         | Waiver-gated `npm audit` — **blocking**                 |
| `npm run security:osv` / `:semgrep` / `:secrets` | Binary-backed scans (see Tooling)                       |
| `npm run security:all`                           | Every security gate in sequence                         |
| `npm run license:check`                          | License allowlist compliance                            |

`security:audit` is no longer advisory. It runs `scripts/security-audit.mjs`, which
fails on any high or critical advisory that is not individually waived in
`security/config/audit-waivers.json`, and on any waiver that has expired. The 26
current advisories are all transitive through the Expo/Metro build toolchain and are
waived with a reason, an owner and a 90-day expiry — so a **new** one fails the build
immediately rather than disappearing into the existing debt. See
[`security/docs/security-exceptions.md`](./security/docs/security-exceptions.md).

`npm run lint` carries `--max-warnings=625`, a ratchet: warnings may only go down.

## End-to-end tests

Maestro drives the built app on a simulator. Flows live in `.maestro/`; full setup,
prerequisites and the CI decision are in
[`docs/E2E_TESTING.md`](./docs/E2E_TESTING.md).

```bash
npx expo prebuild --platform ios   # generate the native project (not committed)
npx expo run:ios                   # build and install
npm run test:e2e                   # run the suite
```

The expensive part is the build, not the flows: this is a managed Expo workflow, so
there is no `ios/` or `android/` directory in the repository and one has to be
generated first. `scripts/e2e.sh` checks every prerequisite up front and names the
missing one.

The suite is **not** wired into GitHub Actions, per
[ADR-011](./docs/adr/011-local-gate-first-no-new-actions.md); `docs/E2E_TESTING.md`
records when to run it locally instead.

Flows are validated structurally inside the ordinary `npm test` gate, so a malformed
flow fails in seconds rather than minutes into a device run.

## Code Quality & Tooling

Quality is enforced **locally** through Husky hooks rather than additional CI
(see [ADR-011](./docs/adr/011-local-gate-first-no-new-actions.md)):

- **pre-commit** — `lint-staged`, which runs ESLint + Prettier and a `tsc-files`
  type-check over the staged files, plus a `gitleaks` secret scan.
- **commit-msg** — Conventional Commits via commitlint.
- **pre-push** — `npm run check`, the waiver-gated dependency audit, `osv-scanner`,
  Semgrep, and a full-history `gitleaks` scan against the committed baseline.

The `gitleaks` steps **fail when the binary is absent** rather than printing a note and
continuing. A gate that silently skips is not a gate; run `./scripts/bootstrap.sh` to
install it, or set `SKIP_SECRET_SCAN=1` to skip it loudly and deliberately. See
[`security/docs/secret-scanning.md`](./security/docs/secret-scanning.md).

- **post-merge** — re-installs and audits when `package-lock.json` changes.

`osv-scanner`, `semgrep` and `lychee` are optional — the hooks report and continue when
they are absent. `gitleaks` is **not** optional; see above. Install them with:

```bash
bash scripts/bootstrap.sh
```

The standardized tooling adoption and the decisions about what was kept, deferred, or
skipped for this React Native app are documented in
[`docs/adr/`](./docs/adr/) (ADR-007 through ADR-011).

## Testing

This project follows Test-Driven Development (see
[ADR-006](./docs/adr/006-test-driven-development.md)).

```bash
npm test
npm run test:coverage
```

Accessibility is linted via `eslint-plugin-react-native-a11y` — see
[ADR-009](./docs/adr/009-rn-scope-web-tools-na.md).

Security configuration, thresholds, exception process and regression tests live under
[`security/`](./security/README.md), with every tool reading its failure policy from
`security-thresholds.json`.

`jest.config.js` declares **per-directory** coverage floors, set just below actual
coverage so `npm run test:coverage` passes today and any regression fails. They only
ever ratchet upward, and each layer is gated separately so a well-covered directory
cannot mask an uncovered one. See [ADR-010](./docs/adr/010-pragmatic-quality-adoption.md)
and issue #28.

## Releases

Version history is in [CHANGELOG.md](./CHANGELOG.md). The user-facing version lives in
`package.json` only; `app.config.ts` reads it from there, so `npm version` propagates to
the built app. iOS `buildNumber` / Android `versionCode` are managed by EAS
(`cli.appVersionSource: "remote"`, `autoIncrement` on the production profile).

## Contributing

This project uses **Git Flow** and **Conventional Commits**. Branch from `develop`,
run `npm run check` before pushing, and open a pull request back into `develop`. See
[CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

MIT
