# ADR-016: QR profile sharing without a camera, and encrypted backups

**Status:** Proposed

**Date:** 2026-10-28

## Context

Issue #66 has five open boxes after #196 and earlier work closed the rest.
They are two independent decisions wearing one issue number, and the issue
itself says so about the first: _"This needs a library choice before anything
else."_

**QR code profile sharing** (three boxes): generate a QR for a profile, scan
one to import a profile, and optionally put a QR on the generated DOPE card.

**Backup** (two boxes): backup scheduling — **already shipped in #196** — and
a backup encryption option, which has not.

Verified rather than assumed:

- No QR dependency of any kind in `package.json`, and no `qrcode`/`QRCode`
  reference anywhere in `src/`.
- No `react-native-svg`, no `expo-camera`, no `expo-crypto`, no
  `expo-secure-store`.
- `android.permission.CAMERA` is **explicitly blocked** in `app.config.ts`,
  with a written reason: _"expo-image-picker is used for one thing: choosing a
  target photo (#63) … and the app never opens the camera. Left unblocked,
  autolinking would still add CAMERA and media permissions that nothing
  exercises."_
- `plugins/withTrimmedIosPermissions.js` deletes the placeholder usage
  descriptions Expo's template seeds, so an iOS camera permission would need a
  deliberate purpose string.
- The app already has a deep-link scheme and a route table:
  `APP_SCHEME = 'mobiledope'`, with `rifles/new` and `rifles/:rifleId` among the
  configured paths.

### Why scanning is the expensive half

Generating a QR needs an encoder and somewhere to draw it. Scanning one needs
a **camera**, and in this repository a camera is not a dependency decision —
it is a reversal of a recorded one. `CLAUDE.md` requires that any new
permission have a purpose string **and** a matching `PRIVACY.md` entry, and
`PRIVACY.md` is the canonical privacy statement that `description.md` and
`CLAUDE.md` both mirror. Adding `expo-camera` means:

- unblocking `android.permission.CAMERA` and deleting the comment explaining
  why it was blocked;
- an `NSCameraUsageDescription` that survives the permission-trimming plugin;
- a `PRIVACY.md` entry, and store data-safety declarations on both platforms;
- a native dependency whose own advisory surface joins the waiver register.

All of that to read a QR code that the shooter is holding up on another phone
two feet away.

## Decision

**This ADR is Proposed and requests two rulings.** They are independent —
either can be taken without the other.

### Ruling 1 — QR profile sharing

**Recommended: generate QR codes; do not add a camera. Encode a deep link and
let the operating system's own camera do the scanning.**

The app already handles `mobiledope://` links and already has a route table. A
QR containing a profile-import link is scanned by the stock iOS and Android
camera apps, which offer to open it, and the app's deep-link handling receives
it. The receiving shooter never grants this app camera access, because this app
never opens a camera.

That gives all three of the issue's boxes except the literal wording of
"implement QR code scanning for profile import" — which is satisfied in effect
rather than in mechanism:

| box                                    | under this ruling                                  |
| -------------------------------------- | -------------------------------------------------- |
| QR generation for profile sharing      | yes — a QR encoder and a screen that draws it      |
| QR scanning for profile import         | the OS camera scans; the app handles the deep link |
| Optional QR on the generated DOPE card | yes, and this one is nearly free — see below       |

**What it costs:**

- **A QR encoder.** `qrcode-generator` is MIT and has zero dependencies, which
  matters here because the obvious alternative, `qrcode`, pulls in `yargs` and
  `pngjs` for its CLI. This ADR does not pretend to have audited either; the
  point is that a zero-dependency pure-JS encoder exists and is the shape to
  look for.
- **Somewhere to draw it on screen**, which means `react-native-svg` — the
  one genuinely new native dependency. **On the DOPE card it costs nothing
  extra**: that card is HTML rendered by `expo-print`, so an inline `<svg>`
  string drops straight in. If the on-screen QR is judged not worth
  `react-native-svg`, the card-only box can be taken on its own and is the
  cheapest third of this issue.
- **A compact encoding.** A rifle-plus-ammo profile as raw JSON is roughly
  300–600 bytes, which is near the practical ceiling for a QR someone scans
  across a bench. A defined short-key encoding is needed, not
  `JSON.stringify`, and a profile with long names must fail with a message
  rather than produce an unscannable code.
- **A new import route.** `src/navigation/linking.ts` has no import route
  today, and the obvious path, `rifles/import`, would be swallowed by the
  existing `rifles/:rifleId` pattern and open `RifleProfileDetail` with an
  unparseable id. The route needs a path that cannot collide, and its payload
  is untrusted input — `linking.ts` already says deep links are an input
  surface — so it must pass the same guards as file import (`importGuards.ts`)
  before anything reaches the database.

**Two things to weigh before ruling, both arguments against:**

- **Profile data in a URL.** A deep link is a URL, and URLs end up in logs,
  recents and clipboard history. This is the shooter deliberately sharing their
  own load data, which is the entire point of the feature — but it is a
  different exposure from a file passed through the share sheet, and it is
  worth deciding knowingly. The alternative is to put the data in an exported
  file and the QR on the file's location, which is more steps and less magic.
- **The app already has import.** `ImportService` reads a JSON file through the
  document picker, and the share sheet already moves files between phones. QR
  sharing is faster and more pleasant, not newly possible. If the answer is
  "the existing path is good enough", that is a legitimate ruling and closes
  three boxes.

**Not recommended in any form: adding `expo-camera`.** If the ruling is to
scan in-app anyway, the four items under "Why scanning is the expensive half"
are the scope, and `PRIVACY.md` moves first, not last.

### Ruling 2 — backup encryption

**Recommended: a passphrase-encrypted backup, opt-in, with the irreversibility
stated at the point of use.**

The shape, rather than a package:

- The shooter supplies a passphrase at export time. It is **not** stored. A
  forgotten passphrase means an unrecoverable backup, and the UI has to say so
  before the file is written, in those words.
- Derive a key with a slow KDF, encrypt with an **authenticated** cipher so a
  corrupted or tampered file fails loudly instead of decrypting to rubbish, and
  write the salt and nonce into the file's own header alongside a format
  version.
- Import detects an encrypted file and asks for the passphrase. An unencrypted
  backup keeps working unchanged — this is an option, not a migration.

**What needs settling, and why this ADR does not settle it:** `expo-crypto`
provides digests and secure random bytes but **no symmetric cipher**, so this
needs either a pure-JS implementation or a native module. The honest position
is that picking a cryptographic library is a decision that deserves a look at
what is currently maintained and audited, which is not something to take on
trust from a summary. What this ADR does claim is the shape above, and that a
backup is a one-off operation so a slow pure-JS cipher is acceptable where it
would not be on a hot path.

**Deliberately out of scope:** encrypting the database itself. That is
SQLCipher, key management and migrating existing data, and it belongs in its
own ADR — see ADR-015 (proposed in #211, not yet accepted), which reaches the
same boundary from the other side.

## Consequences

### Positive

- Ruling 1 as recommended closes three boxes **without touching the privacy
  posture at all** — no camera, no new permission, no `PRIVACY.md` change for
  the sharing feature itself, and the blocked-permission comment in
  `app.config.ts` stays true.
- The DOPE-card QR is separable and nearly free, so a partial ruling still
  ships something.
- Ruling 2 closes the gap that bounds what ADR-015's proposed app lock can be
  worth: at present a backup file beside a locked app contains everything the lock hid.

### Negative

- Ruling 1 still adds `react-native-svg` for the on-screen code, and a native
  dependency is a native dependency.
- The deep-link approach is a slightly worse user experience than in-app
  scanning: the receiving shooter opens their camera app rather than this one,
  and on some Android launchers that is two taps rather than one.
- Ruling 2 introduces the first thing in this app that can permanently lose a
  shooter's data through a forgotten passphrase. That is inherent to
  encryption, and the mitigation is wording rather than engineering.

### Risks

- **An unscannable QR.** Profile data is close to QR capacity. Without a
  compact encoding and a hard check, the feature produces codes that fail
  silently on a bench at a range, which is the worst possible place.
- **Crypto chosen on reputation rather than review.** The real risk in
  Ruling 2. A library that is popular and unmaintained is worse than no
  feature.
- **"Encrypted backup" misread as "encrypted app".** The same misreading
  ADR-015 guards against, from the other direction. Both documents need to keep
  saying which is which.
- **Scope creep back towards a camera.** Once QR generation exists, "and we
  should scan them in-app" is the obvious next ask. The blocked permission and
  its comment are what stand in the way, and they should stay.

## References

- Issue #66 — the two rulings this records
- ADR-015 (proposed in #211) — the app lock, which reaches the same
  database-encryption boundary
- `app.config.ts` — the blocked `android.permission.CAMERA` and its reason
- `plugins/withTrimmedIosPermissions.js` — why an iOS permission needs a
  deliberate purpose string
- `src/navigation/linking.ts` — the `mobiledope://` scheme and route table the
  recommended approach relies on
- `PRIVACY.md`, `CLAUDE.md` — what would have to move if a camera is added
