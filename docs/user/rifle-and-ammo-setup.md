# Rifle and ammunition setup

Every field, what it changes, and which ones are worth measuring rather than
guessing.

## Rifle profiles

Go to **Rifles → +**.

### Fields that change the solution

| Field            | Unit                 | Why it matters                                                                                                   |
| ---------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Caliber          | text                 | Used to look up bullet diameter for spin drift. An unrecognised spelling means no spin drift figure — see below. |
| Barrel Length    | inches               | Record-keeping, and context for velocity differences between rifles.                                             |
| Twist Rate       | inches per turn      | The `8` in 1:8. Drives gyroscopic stability and spin drift.                                                      |
| Zero Distance    | yards                | Where your scope is **actually** zeroed. Sets the launch angle everything else is measured from.                 |
| Click Value Type | MIL / MOA            | Match your turrets.                                                                                              |
| Click Value      | MIL or MOA per click | Usually 0.1 MIL or 0.25 MOA. On the turret cap.                                                                  |
| Scope Height     | inches               | Bore centreline to scope tube centreline.                                                                        |

### Fields for your reference only

Rifle Name, Optic Manufacturer, Optic Model, Reticle Type, Notes.

### Measure scope height, don't estimate it

It sets the geometry of the whole trajectory — how steeply the bullet climbs to
meet the line of sight, and therefore where it sits at every distance short of
your zero. Half an inch of error is visible inside 300 yards.

Measure from the centre of the bore to the centre of the scope tube. Half the
objective bell plus the gap to the barrel is close enough if you cannot get at
the bore directly.

### Zero distance is where it _is_, not where you meant

If you set out to zero at 100 and the group settled an inch high, your zero is
not 100 yards. The solver builds every correction from this number, so an
optimistic entry biases every distance.

### Caliber spelling affects spin drift

Spin drift needs the bullet's diameter, which is inferred from this text field.
If the string is not recognised the solution omits spin drift entirely rather
than guessing. Conventional spellings work best: `6.5 Creedmoor`, `.308 Win`,
`.223 Rem`, `.300 Win Mag`.

## Ammunition profiles

Go to **Ammo → +**.

| Field                    | Unit   | Why it matters                                                     |
| ------------------------ | ------ | ------------------------------------------------------------------ |
| Caliber                  | text   | Should match the rifle it is fired from.                           |
| Bullet Weight            | grains | Drag and energy.                                                   |
| G1 Ballistic Coefficient | —      | Drag model for flat-base and most factory bullets.                 |
| G7 Ballistic Coefficient | —      | Drag model for boat-tail match bullets. Preferred where published. |
| Muzzle Velocity          | fps    | The input most worth measuring.                                    |

Manufacturer, Bullet Type, Powder Type, Powder Weight, Lot Number and Notes are
record-keeping — though lot number earns its place the first time a new lot
shoots differently from the old one.

### Which BC to enter

Enter what the manufacturer publishes. Enter both if both are published.

**G7** models a boat-tail match bullet more closely, so its coefficient stays
more nearly constant as the bullet slows — which is why it holds up better at
distance. **G1** is based on a blunter reference projectile; for a modern match
bullet the mismatch grows as velocity drops, which typically shows up as
under-predicted drop past 600 yards or so.

For flat-base and hunting bullets, G1 is usually the published figure and is
appropriate.

### Muzzle velocity is worth a chronograph

The published number came from the manufacturer's test barrel. Yours differs —
barrel length, chamber, throat and lot all move it, and 50–100 fps is an
ordinary spread. At 1000 yards that is more than a foot of elevation.

Use **Ammo → (a load) → Chronograph** to record a string and take the measured average.

Two things it will not account for, both worth knowing:

- **Temperature.** Propellant burn rate moves with temperature, often 1–2 fps
  per °F. A velocity measured at 70°F does not describe the same load at 20°F.
- **Barrel wear.** The number drifts over a barrel's life. Re-chronograph
  occasionally rather than trusting a figure from two thousand rounds ago.

## Managing profiles

- **Rifle Profile Detail** and **Ammo Profile Detail** show everything recorded,
  with the DOPE logged against them
- **All Ammo Profile List** shows every load across all rifles
- **Ammo Compare** puts loads side by side — most meaningful once each has real
  logged DOPE rather than two sets of box figures

## See also

- [Quick start](./quick-start.md)
- [The ballistic calculator](./ballistic-calculator.md)
- [Logging DOPE](./logging-dope.md)
