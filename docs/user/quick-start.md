# Quick start

Getting from a fresh install to your first logged shot. About ten minutes, most of
it spent measuring your scope height.

You need three things before the app can calculate anything: a **rifle**, a
**load**, and the **conditions** you are shooting in. Set them up once and the rest
is a few taps per shot.

## 1. Add your rifle

Go to **Rifles** tab → **+**.

Everything here except Notes feeds the solver, so approximate answers give
approximate corrections.

| Field                      | What to enter                                                                    |
| -------------------------- | -------------------------------------------------------------------------------- |
| Rifle Name                 | Whatever you call it. "6.5 Tikka" is more useful at 500 yards than "Rifle 1".    |
| Caliber                    | e.g. `6.5 Creedmoor`, `.308 Win`                                                 |
| Barrel Length              | Inches.                                                                          |
| Twist Rate                 | Inches per turn — the `8` in 1:8. Used for spin drift.                           |
| Zero Distance              | The distance your scope is actually zeroed at, not the one you meant to zero at. |
| Optic Manufacturer / Model | For your own reference.                                                          |
| Reticle Type               | For your own reference.                                                          |
| Click Value Type           | **MIL** or **MOA**. Match your turrets.                                          |
| Click Value                | Usually `0.1` for MIL, `0.25` for MOA. Check the turret cap.                     |
| Scope Height               | Centre of the bore to centre of the scope tube, in inches. Typically 1.5–2.0.    |

**Scope height matters more than people expect.** It is what makes the bullet cross
the line of sight twice, and getting it wrong by half an inch visibly moves your
near-distance solutions.

## 2. Add a load

Go to **Ammo** tab → **+**.

| Field                             | What to enter                                   |
| --------------------------------- | ----------------------------------------------- |
| Ammo Name                         | e.g. `140 ELD-M 41.5gr H4350`                   |
| Manufacturer                      | Factory brand, or your own name for a handload. |
| Caliber                           | Should match the rifle you will shoot it from.  |
| Bullet Weight                     | Grains.                                         |
| Bullet Type                       | Match, hunting, FMJ — your reference.           |
| G1 Ballistic Coefficient          | From the bullet manufacturer.                   |
| G7 Ballistic Coefficient          | Also from the manufacturer, if published.       |
| Muzzle Velocity                   | Feet per second.                                |
| Powder Type / Weight / Lot Number | Handload record-keeping. Optional.              |

### G1 or G7?

Enter whichever the manufacturer publishes; enter both if you have both.

For modern boat-tail match bullets **G7 is the better model** — the reference
projectile is a closer match to the bullet's actual shape, so the coefficient stays
more constant across the velocity range. G1 tends to over-predict at distance
because the drag model diverges as the bullet slows. For flat-base and hunting
bullets, G1 is usually what is published and is fine.

### About muzzle velocity

The manufacturer's figure was measured in their barrel, not yours. Expect real
differences of 50–100 fps from barrel length and chamber alone, and that is enough
to move a 1000-yard solution by a foot or more.

Chronograph it if you can — **Ammo → (a load) → Chronograph** records shot strings and gives
you a measured average to put here. Until then the book number is a starting point,
and the whole reason for logging DOPE is that it will not be exactly right.

## 3. Record the conditions

Go to **Calculator** tab, or **Session → Environment**.

| Field               | Units                                      |
| ------------------- | ------------------------------------------ |
| Temperature         | °F                                         |
| Humidity            | %                                          |
| Barometric Pressure | inHg                                       |
| Altitude            | Feet                                       |
| Wind Speed          | mph                                        |
| Wind Direction      | Degrees, where the wind is coming **from** |
| Latitude            | Degrees — for the Coriolis correction      |

**Use station pressure, not the airport's.** Weather apps and METARs report
_altimeter setting_, which is corrected to sea level so pilots can compare. The
solver wants the actual pressure where you are standing. If your source is corrected,
enter your altitude and let density altitude do the work rather than entering both a
sea-level pressure and a real altitude — that double-counts.

**Latitude is stored rounded to about 11 km, and longitude is never recorded at
all.** Coriolis needs roughly where on the planet you are, not where you are
standing. See `PRIVACY.md`.

## 4. Get a solution

**Calculator** tab → pick the rifle and load → enter distance and conditions →
solve.

You get elevation and windage in your chosen angular unit, plus time of flight,
retained velocity and energy. **Shooting Angle** handles uphill and downhill shots;
leave it at 0 for level ground.

## 5. Shoot it, then log what actually happened

Go to **History** tab → **+**.

This is the point of the app. The solution is a prediction; the log is the truth.

| Field                      | What to enter                                                |
| -------------------------- | ------------------------------------------------------------ |
| Rifle Profile / Ammunition | What you actually shot.                                      |
| Target Distance            | Measured, not estimated, if you can.                         |
| Elevation Correction       | What you **actually dialled** to hit.                        |
| Windage Correction         | Same.                                                        |
| Target Type                | Your reference.                                              |
| Group Size (inches)        | Extreme spread.                                              |
| Hits / Shots               | e.g. 4 of 5.                                                 |
| Notes                      | Mirage, position, anything you would want to know next time. |

Log the correction that worked, not the one the calculator suggested. Where the two
differ is exactly the information you came for, and after a few range trips the
pattern in that difference is worth more than any published BC.

## 6. Make a card for the field

Go to **Ammo → (a load) → DOPE Card**.

Generates a drop table from 100 to 1000 yards in 100-yard steps for the selected
rifle, load and conditions, with wind holds. Exports as a **PDF** you can print,
share, or keep on your phone.

## Next

- [Rifle and ammunition setup](./rifle-and-ammo-setup.md) — every field, and what it
  changes
- [Logging DOPE](./logging-dope.md) — sessions, chronograph strings, reading the curve
- [The ballistic calculator](./ballistic-calculator.md) — wind tables, moving targets,
  what the solver does and does not model
- [DOPE cards](./dope-cards.md)
- [FAQ](./faq.md)
