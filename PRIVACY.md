# Privacy Policy — Mobile DOPE

**Last updated:** 2026-10-26
**Applies to:** Mobile DOPE for iOS and Android, current release.

## The short version

Mobile DOPE has no network layer. It does not contain an analytics SDK, a crash
reporter, a telemetry client, an advertising identifier, or any code that sends a
network request to a remote host. Nothing you enter is transmitted anywhere. The
only way data leaves your device is when you deliberately export or share a file.

There are no accounts, no sign-in, and no cloud sync.

## What the app stores on your device

All of the following is written to a private SQLite database inside the app's own
storage area, readable only by the app:

- **Rifle profiles** — name, caliber, barrel length, twist rate, zero distance,
  optic details and click values.
- **Ammunition profiles** — manufacturer, bullet weight and type, ballistic
  coefficients, muzzle velocity, powder and lot details, notes.
- **Environmental readings** — temperature, humidity, barometric pressure,
  altitude, density altitude, wind speed and direction, and an **approximate
  latitude** (see below).
- **DOPE logs** — distance, elevation and windage corrections, hit/miss results,
  notes, and the time of the engagement.
- **Range sessions and shot strings** — including chronograph readings.
- **App settings** — units, distance presets, display preferences, and any custom
  calibers you add.

## Location

Mobile DOPE asks for location permission only while you are using the app, and only
when you tap to fetch conditions on the Environment screen. It is never requested in
the background.

**What it is used for.** Two things:

1. **Altitude**, which feeds the density-altitude term in the ballistic solution.
2. **Latitude**, which the Coriolis correction uses as `sin(latitude)` and
   `cos(latitude)`.

**What is actually stored.** Latitude is rounded to one decimal place — roughly
11 kilometres — _before_ it is written to the database. The Coriolis model varies by
about 1.7% per whole degree of latitude, so a tenth of a degree is already finer
than the calculation can use. Rounding costs no accuracy and means the stored value
does not identify a shooting position.

**Longitude is not recorded at all.** No calculation in the app uses it.

**Earlier versions.** Earlier releases stored both latitude and longitude at full
GPS precision. Upgrading runs a one-time migration that clears every stored
longitude and rounds every stored latitude to one decimal place. This is not
reversible, which is the intent. See `CHANGELOG.md` for the release it shipped in.

**You can decline.** The app is fully usable with location permission denied —
altitude can be entered by hand, and the Coriolis correction is optional. Nothing is
withheld from you for saying no.

**You can erase it.** Settings → Privacy → _Delete Stored Location Data_ removes the
latitude from every stored environmental reading while leaving the temperature,
pressure and wind readings intact.

## Barometer

On a phone or tablet that has a barometer, the Environment screen offers **Read
Barometer**. Tapping it takes a few pressure readings over a second or two, fills in
station pressure, and stops reading. Nothing reads the barometer in the background
or at any other time.

**What is stored.** Only the station pressure that ends up in the pressure field,
exactly as if you had typed it. The raw readings are not kept. An optional
calibration offset you set in Settings is stored with your other settings.

**The iOS permission.** iOS treats the barometer as part of _Motion & Fitness_, so
the first reading on an iPhone shows a permission prompt under that name. Mobile
DOPE reads only air pressure through it; it does not read steps, movement or
activity. On iOS 17.4 and later the sensor library asks iOS to record a tenth of a
second of accelerometer data to make that prompt appear, working around an iOS
bug; the app never reads that data. Android needs no permission for the barometer.

**You can decline.** Station pressure can always be entered by hand.

## Exports and sharing

You can export your data as JSON, CSV, Markdown or PDF, and share it through the
system share sheet.

**Exported files are outside the app's control.** Once you send a backup to another
app, a cloud drive, or a person, this policy no longer governs what happens to it.

A full JSON backup includes the approximate latitude stored with each environmental
reading. Before a full backup is created, the app tells you this and offers to leave
the coordinates out. A backup exported without coordinates still restores completely —
only the latitude is missing.

## Automatic backups

Settings → Automatic Backup can save a full backup on a daily or weekly schedule.
It is off (_Manual_) unless you turn it on.

**When.** There is no background task. A backup is written when you open the app,
or bring it back to the foreground, and the chosen interval has passed since the
last one. Choosing _Daily_ or _Weekly_ writes the first one straight away.

**What it contains.** The same JSON as a manual full backup — rifle and ammunition
profiles, environmental readings and DOPE logs — **with the latitude always left
out**. It never contains a location, so _Delete Stored Location Data_ leaves no copy
of your coordinates behind in old backups. App settings are not included.

**Where it lives.** In a `backups` folder inside the app's private documents
storage — the same private area as the database, readable only by the app. The
newest seven are kept; older ones are deleted as new ones are written. Nothing is
sent anywhere. Like the database, the folder is covered by your phone's own device
backup (iCloud or Google) if you have that turned on.

**Leaving the device.** Only when you tap _Share Latest Backup_, which hands the
newest file to the system share sheet, exactly as a manual export does.

## What the app does not do

- No accounts, sign-in, or user identifiers.
- No analytics, telemetry, crash reporting, or usage measurement.
- No advertising, ad identifiers, or tracking of any kind.
- No cloud sync or remote backup.
- No sale or sharing of data with third parties — there is no mechanism by which
  data could reach a third party.
- No collection of contacts, photos, microphone, camera, movement, activity, or
  health data. The app declares no permission for any of these. (The Motion &
  Fitness permission on iOS is for the barometer only — see above.)

## Retention and deletion

Data is kept until you delete it. There is no automatic expiry.

- **Location only** — Settings → Privacy → _Delete Stored Location Data_.
- **Everything** — Settings → Data Management → _Clear All Data_.
- **Automatic backups** — Settings → Automatic Backup → _Delete Automatic
  Backups_. Choosing _Manual_ stops new ones but keeps the ones already saved.
  Uninstalling the app also deletes them. Backups you exported yourself are not
  touched.
- **Everything, including settings** — uninstall the app. iOS and Android delete the
  app's private storage on uninstall.

## Children

Mobile DOPE is not directed at children and collects nothing that would identify
anyone, of any age.

## Permissions the app requests

| Permission             | Platform     | Why                                                   |
| ---------------------- | ------------ | ----------------------------------------------------- |
| Location, while in use | iOS, Android | Altitude and approximate latitude, as described above |
| Motion & Fitness       | iOS only     | Reading the barometer, as described above             |

No other runtime permission is requested. Camera, photo library and shared
storage, microphone, and Android's physical activity permissions are explicitly
blocked in the app's build configuration so that autolinked libraries cannot
introduce them. Files you export are written to the app's own storage and handed
to the system share sheet, which needs no storage permission.

## Changes to this policy

Material changes will be reflected here with an updated date, and this document is
checked against the app's actual behaviour before each release rather than written
from intent.

## Contact

Questions about this policy: open an issue at
<https://github.com/karlgroves/mobileDOPE/issues>.
