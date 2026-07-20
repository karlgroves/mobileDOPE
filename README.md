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
├── db/             # SQLite database and migrations
├── navigation/     # React Navigation setup
├── services/       # Analytics, database, queue processing
├── state/          # Zustand store, React Query, preferences
└── utils/          # Device info and utility functions
```

## Features

- Local SQLite database with migration runner
- Theme support (light, dark, night vision modes)
- Deep linking support (`mobiledope://`)
- Offline queue processing
- Analytics integration
- Error boundary handling

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
| `npm run check`                                  | Parallel gate: lint + type-check + markdownlint + dupes |
| `npm run check:all`                              | Full gate: `check` + format check + tests               |
| `npm run security:audit`                         | `npm audit` (high severity, prod deps) — advisory\*     |
| `npm run security:osv` / `:semgrep` / `:secrets` | Binary-backed scans (see Tooling)                       |
| `npm run license:check`                          | License allowlist compliance                            |

\* `security:audit` currently exits non-zero on high-severity advisories in Expo's
transitive dependencies, which have no upstream fix yet. It is informational for now —
the `post-merge` hook does not fail on it — and should be re-checked on each Expo bump.

## Code Quality & Tooling

Quality is enforced **locally** through Husky hooks rather than additional CI
(see [ADR-011](./docs/adr/011-local-gate-first-no-new-actions.md)):

- **pre-commit** — `lint-staged`, which runs ESLint + Prettier and a `tsc-files`
  type-check over the staged files, plus an optional `gitleaks` secret scan.
- **commit-msg** — Conventional Commits via commitlint.
- **pre-push** — the full `npm run check` gate plus optional `gitleaks`.
- **post-merge** — re-installs and audits when `package-lock.json` changes.

The binary-backed scanners (`gitleaks`, `osv-scanner`, `semgrep`, `lychee`) are
optional; the hooks skip them gracefully when absent. Install them with:

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

Accessibility is linted via `eslint-plugin-react-native-a11y` (malformed a11y props are
errors; missing labels/hints are warnings pending remediation) — see
[ADR-009](./docs/adr/009-rn-scope-web-tools-na.md).

`jest.config.js` declares a 70% coverage threshold, but actual coverage is well below
that today, so `npm run test:coverage` fails. The threshold is a ratchet target, not a
gate; see [ADR-010](./docs/adr/010-pragmatic-quality-adoption.md).

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
