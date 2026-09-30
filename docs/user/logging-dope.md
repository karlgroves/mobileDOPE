# Logging DOPE

**History** tab.

DOPE is Data On Previous Engagements: what you actually dialled, at what distance, in
what conditions, and where the round actually went. It is the part of the app that
gets better the longer you use it, because it is the only part based on your rifle
rather than a model of one.

> **Note on Settings.** The Settings screen is currently unreachable from the app's
> UI — it is registered but nothing opens it ([#87](https://github.com/karlgroves/mobileDOPE/issues/87)).
> The features below are described as they are built and intended to work; until #87
> is fixed you cannot get to them.

## Logging a shot

Go to **History → +**.

| Field                | What to enter                                              |
| -------------------- | ---------------------------------------------------------- |
| Rifle Profile        | What you actually shot                                     |
| Ammunition           | What you actually shot                                     |
| Target Distance      | Yards — measured if you can                                |
| Elevation Correction | What you **actually dialled** to hit                       |
| Windage Correction   | Same                                                       |
| Target Type          | Your reference                                             |
| Group Size (inches)  | Extreme spread                                             |
| Hits / Shots         | e.g. 4 of 5                                                |
| Notes                | Mirage, position, light, anything you would want next time |

**Log the correction that worked, not the one the calculator gave you.** If the
solver said 4.2 MIL and 4.5 put you in the middle, the log says 4.5. That 0.3 is the
whole value of the record — it is your barrel, your lot, your chronograph error and
your scope's tracking, all folded into one honest number.

Over a season the difference stops looking like noise and starts looking like a
correction you can apply.

## Attach the conditions

A drop figure without conditions is nearly worthless — the same rifle and load can
differ by a mil between a cold morning at sea level and a hot afternoon at altitude.

Record an **Environment** snapshot alongside the shot. The sensor-backed fields can
be read from the device where available; the rest are manual.

## Range sessions

**Session** tab.

A session groups everything from one range trip:

1. **Range Session Start** — name it, set the conditions once
2. **Range Session Active** — log shots against that session as you go
3. **Range Session Summary** — what you shot, how it grouped, what changed

Sessions are the natural unit for reviewing later: "that cold morning in February"
is a more useful handle than sixteen individual entries.

## Chronograph strings

**Ammo → (a load) → Chronograph** records a string of measured velocities and gives you the
statistics for it. **Shot String History** keeps the strings.

Put the measured average into the load's **Muzzle Velocity**. It is the single input
where a measurement most outperforms the published figure — factory numbers come
from the manufacturer's test barrel, and 50–100 fps of difference is ordinary.

## Reading the history

- **DOPE Log List** — everything, filterable
- **DOPE Log Detail** — one engagement in full
- **DOPE Curve** — your logged corrections plotted against distance

The curve is where a bad data point shows itself. A log that sits well off the line
its neighbours describe is usually a transcription error, a misread distance, or a
shot you should not have counted — and it is much easier to see on the plot than in
the list.

## Comparing loads

**Ammo → Compare** puts loads side by side. Most useful once you have logged real
DOPE for each, rather than comparing two sets of box figures.

## Getting your data out

Go to **Settings → Export All Data** writes everything to a file you keep. **Import Data**.
reads it back.

The export includes the coarsened latitude from your environment snapshots, and the
export flow warns you and offers to omit it. Longitude was never recorded. See
`PRIVACY.md`.

There is no cloud sync. Your data is on your device and in whatever you export.

## See also

- [Quick start](./quick-start.md)
- [The ballistic calculator](./ballistic-calculator.md)
- [DOPE cards](./dope-cards.md)
