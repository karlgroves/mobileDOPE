# Release runbook

Covers taking a build from this repository to TestFlight, Google Play, and the two
public stores. Written against issue #61, which lists 50-odd checkboxes with no
indication of which ones are configuration, which need a store account, and which
should not be done at all.

That distinction is the point of this document. Most of #61 cannot be done from a
developer machine — it needs an App Store Connect account, a Google Play Developer
account, physical devices and store review. What _is_ in this repo is already
configured, and this records what it is so nobody reconfigures it from scratch.

Anything this file asserts about repository configuration is pinned by
`__tests__/unit/releaseConfig.test.ts`. A runbook that drifts from the config it
describes is worse than no runbook, because it is read at exactly the moment nobody
has time to check it.

## Already configured — do not redo these

| #61 checkbox                        | where it lives                                                                                 | state |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- | ----- |
| Configure automated build numbering | `eas.json` — `cli.appVersionSource: "remote"`, `build.production.autoIncrement: true`          | done  |
| Register bundle ID / package name   | `app.config.ts` — `com.mobiledope.app`, with `.development` / `.staging` suffixes              | done  |
| iOS/Android build profiles          | `eas.json` — `development`, `staging`, `production`                                            | done  |
| User-facing version                 | `app.config.ts` reads `version` from `package.json`; `npm version` is the only place it is set | done  |

`appVersionSource: "remote"` means EAS owns the build number and increments it
server-side. Do not also set `ios.buildNumber` or `android.versionCode` in
`app.config.ts` — two sources for one number is how a build gets rejected for
reusing a version that is already uploaded.

The bundle identifier is per-environment so development, staging and production
builds install side by side on one device. The **deep link scheme is deliberately
not** (`mobiledope` in every environment): a link is written against the scheme, not
against the build. See `src/navigation/linking.ts`.

## Needs an account — cannot be done from this machine

These are blocked on credentials only. Nothing in the repo needs to change first.

- **App Store Connect account**, then register `com.mobiledope.app` against it.
- **Google Play Developer account**, then register the same package name.
- **iOS signing**: `eas credentials` generates and stores the distribution
  certificate and provisioning profile. Let EAS manage them rather than checking
  anything into this repo.
- **Android signing**: `eas credentials` generates the upload keystore. EAS holds it;
  do not generate one locally "as a backup" and commit it.

  Two different keys get conflated here, and the difference decides what losing one
  costs. Under **Play App Signing** — the default for any app registered now —
  Google holds the _app signing_ key and you hold an _upload_ key. Losing the upload
  key is recoverable: generate a new one and ask Google to register it. Losing a
  legacy _self-signed app signing_ key, from before Play App Signing, is not
  recoverable, and that app can only be republished under a new package name. This
  app will be on Play App Signing, so the recoverable case is the one that applies
  — but back the upload keystore up anyway, because the reset goes through
  support and takes days.

- **Submission**: `eas.json` has `submit.production` as an empty object. It needs
  `ascAppId` (iOS) and a Google service account key path (Android) before
  `eas submit` will work. Both come from the accounts above.

## Needs a device or a human

- Physical device testing on iOS and Android.
- Screenshots at every required size, the Play feature graphic, app description,
  categories, age and content ratings.
- TestFlight and Play internal/closed track beta rounds, and acting on the feedback.
- Store review, and responding to it.

Note on tooling: `expo prebuild` generates the native `ios/` project and needs little
more than Node, though CocoaPods wants the Command Line Tools. **Building** — and
therefore anything on a simulator or a device — needs a full Xcode install; Command
Line Tools alone are not enough. Nothing in this repository has been run on a
simulator or a device.

## Not applicable

- **In-app purchases.** The app sells nothing. Leave both store listings configured
  with no IAP; adding an empty IAP configuration invites a review question.

## Contested: crash reporting and performance monitoring

Issue #61 asks for Sentry or Firebase Crashlytics, performance monitoring, and metric
tracking. **These conflict directly with commitments this project has already made**,
and the conflict should be resolved deliberately rather than by whoever picks up the
checkbox first.

`PRIVACY.md` and `CLAUDE.md` both state: _"No analytics, telemetry, crash reporting or
advertising identifiers. The app has no network layer: there is no `fetch` to any
remote host anywhere in `src/`."_ `app.config.ts` declares
`usesNonExemptEncryption: false` on that basis, and `__tests__/unit/offlineFirst.test.ts`
now enforces it — adding an SDK that phones home would fail the suite, which is the
test doing its job rather than an obstacle to route around.

There is also a specific sensitivity here beyond the general one. This app holds a
shooter's rifle inventory and range history. A crash report carrying a stack trace,
device identifier and breadcrumb trail is a different proposition for this data than
for a note-taking app.

If crash reporting is wanted, it needs: a decision recorded as an ADR, `PRIVACY.md`
updated _before_ the SDK lands rather than after, the iOS encryption declaration
rechecked, and an opt-in rather than opt-out default. If it is not wanted, #61's
monitoring section should be struck so it stops being rediscovered.

Until that decision is made, the honest answer to "how do we know about crashes?" is
that users tell us, and that the local gate — lint, types, tests, semgrep, trufflehog
on every commit — is where defects are supposed to be caught instead.

## The release sequence, once the accounts exist

1. `npm version <major|minor|patch>` on `develop`. This is the single source of the
   user-facing version; `app.config.ts` picks it up.
2. Create `release/x.y.z` from `develop`. Final fixes land there.
3. Run the full local gate: `npm run lint`, `npm run type-check`, `npm test`,
   `npm run test:coverage`. Per ADR-011 these are the gate — do not wait on GitHub
   checks that may not run.
4. `APP_ENV=production eas build --profile production` for each platform. EAS
   increments the build number.
5. Distribute to TestFlight / Play internal testing. Gather feedback, fix, repeat
   from step 3.
6. `eas submit` to each store once `submit.production` is filled in.
7. On approval: merge `release/x.y.z` to `main` **and** back to `develop`, tag the
   release on `main`, and update `CHANGELOG.md`.
8. Hotfixes branch from `main`, and merge back to both `main` and `develop`.
