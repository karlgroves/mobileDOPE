# ADR-015: App lock — a device-authentication gate, or a recorded won't-do

**Status:** Proposed

**Date:** 2026-10-28

## Context

Issue #67 is open, labelled `enhancement`, and asks for a passcode setup
screen, biometric authentication, an app lock toggle, an auto-lock timer,
lock-on-background and an emergency disable.

Three documents in this repository say it is not happening:

| where                | what it says                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/CLAUDE.md:263`  | _"There is **no** biometric or passcode lock. `description.md` used to promise one; it does not exist and is not planned. Do not cite it as an existing control."_     |
| `description.md:331` | _"**Passcode / biometric lock.** Not implemented and not currently planned. Earlier drafts of this document listed it as a control; it never shipped. See issue #44."_ |
| `PRIVACY.md`         | Silent. It does not mention a lock in either direction, so it does not settle it and will need a line whichever way this goes.                                         |

Both cannot be true. Either the standing instructions are stale, or #67's
security half is a won't-do and should be closed as one. The reason this
matters more than ordinary bookkeeping is in #44's lineage: the documentation
once claimed a control the code did not have. A standing instruction saying
"not planned" while an open `enhancement` says "build it" is the same failure
mode pointing the other way — whichever one the next person reads, they are
misled.

Verified rather than assumed, while triaging:

- `expo-local-authentication` is **not** in `package.json`. No dependency has
  been added in anticipation.
- Nothing in `src/` references biometrics, a passcode or a local-auth module.

### What a lock would and would not protect

Worth stating precisely, because the issue's wording ("App lock and security")
invites a stronger reading than any implementation would support.

**It would protect against** someone who has the shooter's **unlocked** phone:
handed over to show a photo, borrowed, or left on a bench at a range. For this
app that is not a hypothetical — the data is a rifle inventory and a range
history, which is to say a list of what the shooter owns and where and when
they shoot.

**It would not protect against** anything else, and three paths make that
concrete:

1. **It is not encryption.** The SQLite database is unencrypted on disk. A
   lock gates the UI, not the file.
2. **The export path is unencrypted.** A full JSON backup written to the
   documents directory contains everything the lock was hiding. That is #66's
   open "backup encryption" box, and it bounds what any lock can be worth.
3. **The OS already covers the lost-phone case** with device lock and
   full-disk encryption, which is the threat most people picture first.

So the honest claim is narrow: it stops a casual reader of an unlocked phone.
That is a real threat and a worthwhile thing to stop. It is not "security" in
the sense the issue's heading implies, and it must not be described as data
protection — which is exactly the sentence `app/CLAUDE.md` is carrying.

## Decision

**This ADR is Proposed and requests a ruling.** Two options.

### Option A — build it, scoped to device authentication (recommended)

Build a lock, and build **less** than the issue asks for:

- **Use the device's own authentication**, via `expo-local-authentication`'s
  device-owner flow: Face ID, Touch ID or fingerprint, falling back to the
  **device passcode**.
- **Gate at launch and on return from foreground**, with a configurable grace
  period so a quick switch to the camera does not demand a thumbprint.
- **Opt-in, default off**, with the setting saying what it does and does not
  do in the words above.
- **One new permission**, `NSFaceIDUsageDescription`, with a real purpose
  string in `app.config.ts` and a matching `PRIVACY.md` entry — which is what
  `app/CLAUDE.md` already requires of any new permission, and
  `plugins/withTrimmedIosPermissions.js` will strip a placeholder.

**Two items from the issue's list should be dropped**, and the reasoning is
the main thing this ADR contributes:

- **The bespoke passcode setup screen.** Using the device passcode means there
  is no app-specific secret to create, store, rotate or forget. An app that
  invents its own passcode has to store a verifier somewhere, and in an app
  with an unencrypted database that verifier protects nothing a device passcode
  would not protect better.
- **The emergency disable.** It only exists because of the bespoke passcode. If
  it bypasses the lock, the lock is theatre; if it wipes data, it is a
  data-loss footgun in a field app with no cloud copy. With device
  authentication the problem disappears: a shooter who can unlock their phone
  can get into the app.

**Why Option A is the recommendation:** the threat is narrow but real and
specific to this app's data; the implementation is small and adds no bespoke
cryptography; and it resolves the contradiction in the direction the open
issue asks for. The alternative leaves an `enhancement` and three documents
disagreeing, which is the condition this ADR exists to end.

**What must move in the same change**, per #44: `app/CLAUDE.md:263`,
`description.md:331` out of "Not built", and a new `PRIVACY.md` entry stating
what the lock does and — explicitly — that it is not encryption and the
database and exports remain unencrypted.

### Option B — decline it, and record that

- Close #67's security half as a won't-do, citing the OS's own device lock and
  full-disk encryption as the control.
- Leave `app/CLAUDE.md` and `description.md` as they are; they already say it.
- **Add the missing `PRIVACY.md` line** saying no app lock exists, so the
  canonical statement answers the question rather than being silent on it.
- Keep #67 open only for the three non-security preferences below, or split
  them out.

This is a legitimate ruling and not a worse one. It is right if the casual
reader of an unlocked phone is judged out of scope, and it costs one
documentation line rather than a dependency, a permission and a gate.

### What this ADR does not decide

**Backup encryption** (#66). It is referenced above because it bounds what a
lock is worth, but it is a separate ruling with its own dependency question,
and Option A does not depend on it. A lock without backup encryption is still
worth having against the threat it addresses; it should simply not be
described as more.

## Related, not covered by this ADR

Issue #67 also carries three non-security preferences. The caliber one is done;
the other two are **not** blocked on a decision about locks, and each needs a
different kind of answer. Recorded here because the evidence was gathered while
triaging and would otherwise be lost.

- **Caliber database management — already shipped.** PR #197 added adding,
  renaming and deleting custom calibers. The box can be ticked.
- **Sound effects toggle — nothing to toggle.** The app has no audio
  dependency and no sound playback anywhere in `src/`; every match for "sound"
  is the speed of sound (`ballistics.ts`, `subsonic.ts`, `atmospheric.ts`,
  `dragModels.ts`) or the adjective (`offsetInterpolation.ts`). A toggle would
  govern nothing. The real question is
  whether the app should have sounds at all, which is a feature request rather
  than a preference, and `hapticFeedbackEnabled` may already cover the
  intent.
- **Data storage location preference — needs a question answered first.**
  Everything is written to `Paths.document`, the app's own sandbox. On iOS
  there is no alternative a user can choose. On Android a real version of this
  would mean the Storage Access Framework for **exports and backups**, so that
  a backup survives uninstalling the app — which matters in an app with no
  cloud copy. That is worth doing, is Android-only, and is a different feature
  from a preference row.

## Consequences

### Positive

- The contradiction ends, in a direction someone chose rather than by whoever
  reaches the issue first.
- Under Option A the shooter gets a control that matches a threat they actually
  face, described in terms that do not overstate it.
- Dropping the bespoke passcode and the emergency disable removes the two parts
  of the issue's list with the worst cost-to-value ratio, and with them a
  stored verifier and a data-loss path.

### Negative

- Option A adds a dependency, a permission and a gate on app start — the one
  place in a field app where an extra step is most annoying. The grace period
  mitigates it; it does not remove it.
- Option A invites the misreading this ADR spends a section guarding against.
  Every place the lock is described has to keep saying it is not encryption.

### Risks

- **A false control.** The precise #44 failure. Mitigated only by the wording
  rules above, and they have to survive future edits to three documents.
- **Lockout.** Device authentication makes this nearly impossible — a shooter
  who can unlock their phone is in — but `expo-local-authentication` can report
  no enrolled biometric and no device passcode. The gate must fall open in that
  case, not closed, and say why.
- **Scope creep towards encryption.** Once a lock exists, "and encrypt the
  database" is the obvious next ask. That is a much larger change (a SQLCipher
  build, key management, migration of existing data) and should be its own ADR
  rather than an extension of this one.

## References

- Issue #67 — the enhancement this records a ruling on
- Issue #44 — why a documented control that does not exist is treated here as a
  defect
- Issue #66 — backup encryption, which bounds what any lock is worth
- `app/CLAUDE.md:263`, `description.md:331`, `PRIVACY.md` — the three documents
  that must agree with whatever is decided
