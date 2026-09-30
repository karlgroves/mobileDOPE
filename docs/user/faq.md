# FAQ

> **Note on Settings.** The Settings screen is currently unreachable from the app's
> UI — it is registered but nothing opens it ([#87](https://github.com/karlgroves/mobileDOPE/issues/87)).
> The features below are described as they are built and intended to work; until #87
> is fixed you cannot get to them.

## Does the app need an internet connection?

No. There is no network layer at all — the app makes no requests, and everything
works offline by design. That is the point: the places people shoot are not the
places with signal.

## Is my data sent anywhere?

No. There is no cloud sync, no account, no analytics, no crash reporting and no
advertising identifiers. Your data is in the app's local database on your device.

The only way data leaves is when you export it yourself.

## Why does it want my location?

For two numbers in the ballistic solution: **altitude**, which feeds density
altitude, and **latitude**, which feeds the Coriolis correction.

**Latitude is rounded to about 11 km before it is saved, and longitude is never
recorded at all.** Coriolis needs to know roughly how far from the equator you
are — not where you are standing. You can enter both by hand instead of granting
location access, and **Settings → Delete Stored Location Data** removes what has
been saved.

See `PRIVACY.md` for the full statement.

## Can I back up or move my data?

Yes. **Settings → Export All Data** writes everything to a file. **Import Data**
reads it back — on the same device or a new one.

A full export includes the coarsened latitude from your environment snapshots.
The export flow warns you about that and offers to leave it out.

## Why is the app dark?

It defaults to dark because it is used at dawn, at dusk and at night, and a white
screen ruins dark adaptation for several minutes. **Settings → Appearance → Theme**
changes it.

## MIL or MOA?

Whichever your turrets are. Set **Click Value Type** on the rifle profile to
match, and **Settings → Default Units → Angular Unit** for how solutions are
displayed.

Mixing them is the classic way to put a round a long way off target. If your
scope is MIL, work in MIL everywhere.

## The calculator's number doesn't match what I actually dial

That is expected, and it is what the app is for.

A solver works from a model: published BC, published velocity, assumed conditions.
Your rifle has a real velocity, a real barrel and a scope with real tracking
error. Past a few hundred yards those differences compound.

**Log what you actually dialled.** After a few sessions your logged DOPE is more
trustworthy than any computed solution, because it contains all the things the
model does not know about.

If the gap is large and consistent, check muzzle velocity first — it is the input
most often wrong, and a chronograph usually explains the discrepancy on its own.

## Why is there no spin drift figure in my solution?

Spin drift is computed from bullet diameter, which is inferred from the rifle's
**Caliber** text. If the spelling is not recognised, the app omits spin drift
rather than guessing a diameter. Try a conventional form: `6.5 Creedmoor`,
`.308 Win`, `.223 Rem`.

## Does it account for aerodynamic jump?

Not currently. The calculation exists in the codebase and is tested, but it is
not applied to the solution. It is a small effect in ordinary conditions and a
real one in a strong full-value crosswind at distance.

## Why does my DOPE card not match today's conditions?

Because a card is computed for the conditions you generated it with, and drop is
mostly determined by density altitude. A card made for a warm day near sea level
will be wrong on a cold morning at 7,000 feet.

Generate one per expected condition set, or generate on the day before you leave
signal. Note the conditions on the card so a stale one announces itself.

## Can I use metric?

Yes. **Settings → Default Units → Distance Unit** switches between yards and
meters.

## Is there an app lock or biometric unlock?

Not at present. It has been discussed and is tracked as an open issue, but it
does not exist today — do not rely on one.

## What happens to my data if I delete the app?

It goes. The database is local to the app, so uninstalling removes it. Export
first if you want to keep it.

**Settings → Clear All Data** also erases everything, deliberately and
irreversibly.

## See also

- [Quick start](./quick-start.md)
- [Rifle and ammunition setup](./rifle-and-ammo-setup.md)
- [Logging DOPE](./logging-dope.md)
- [The ballistic calculator](./ballistic-calculator.md)
- [DOPE cards](./dope-cards.md)
