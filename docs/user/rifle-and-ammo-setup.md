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

### Starting from a factory load

A new ammunition profile can start from a factory load. Tap **Factory Load**
at the top of the form and choose one. The form fills in the name,
manufacturer, caliber, bullet weight and type, both ballistic coefficients and
the muzzle velocity, exactly as the manufacturer publishes them. If Notes is
empty it also records where the figures came from. Choosing another load
replaces that note, but never a note you wrote or changed.

Every field stays editable, and nothing is linked afterwards: the profile
saves whatever the form says when you tap **Create**. The list shows only the
loads for the caliber you have chosen, or every load if that caliber has none.
It is not offered when editing a saved profile, because it would overwrite
your figures.

The published velocity is from the manufacturer's test barrel, listed below
where the product page states it.
Your rifle will differ, so chronograph it and replace the figure (see
[Muzzle velocity is worth a chronograph](#muzzle-velocity-is-worth-a-chronograph)).

The table is built into the app. It does not go online and does not update
itself. It is a small, hand-picked set. Each figure was copied from the
manufacturer's own product page on the date shown, and nothing was converted
or estimated. A load you shoot that is not listed is entered by hand from the
box, as before.

Figures read on 2026-11-08:

| Load                                                    | Item  | G1    | G7    | Velocity (fps) | Test barrel | Source                                                                                     |
| ------------------------------------------------------- | ----- | ----- | ----- | -------------- | ----------- | ------------------------------------------------------------------------------------------ |
| Hornady 6.5 Creedmoor 140 gr ELD Match                  | 81500 | 0.646 | 0.326 | 2710           | 24 in.      | <https://www.hornady.com/ammunition/rifle/6-5-creedmoor-140-gr-eld-match>                  |
| Hornady 6.5 Creedmoor 143 gr ELD-X Precision Hunter     | 81499 | 0.623 | 0.314 | 2700           | 24 in.      | <https://www.hornady.com/ammunition/rifle/6-5-creedmoor-143-gr-eld-x-precision-hunter>     |
| Berger 6.5 Creedmoor 140 gr Hybrid Target               | 31011 | 0.607 | 0.311 | 2750           | Not stated  | <https://bergerbullets.com/product/6-5-mm-creedmoor-140gr-hybrid-target/>                  |
| Berger 6.5 Creedmoor 144 gr Long Range Hybrid Target    | 31081 | 0.655 | 0.336 | 2830           | Not stated  | <https://bergerbullets.com/product/6-5-mm-creedmoor-144gr-long-range-hybrid-target/>       |
| Hornady 308 Win 168 gr ELD Match                        | 80966 | 0.523 | 0.263 | 2700           | 24 in.      | <https://www.hornady.com/ammunition/rifle/308-win-168-gr-eld-match>                        |
| Hornady 308 Win 178 gr ELD-X Precision Hunter           | 80994 | 0.552 | 0.278 | 2600           | 24 in.      | <https://www.hornady.com/ammunition/rifle/308-win-178-gr-eld-x-precision-hunter>           |
| Hornady 223 Rem 73 gr ELD Match                         | 80269 | 0.398 | 0.200 | 2790           | 24 in.      | <https://www.hornady.com/ammunition/rifle/223-rem-73-gr-eld-match>                         |
| Hornady 6mm ARC 108 gr ELD Match                        | 81608 | 0.536 | 0.270 | 2750           | 24 in.      | <https://www.hornady.com/ammunition/rifle/6mm-arc-108-gr-eld-match>                        |
| Hornady 270 Win 145 gr ELD-X Precision Hunter           | 80536 | 0.536 | 0.270 | 2970           | 24 in.      | <https://www.hornady.com/ammunition/rifle/270-win-145-gr-eld-x-precision-hunter>           |
| Hornady 30-06 Springfield 178 gr ELD-X Precision Hunter | 81174 | 0.552 | 0.278 | 2750           | 24 in.      | <https://www.hornady.com/ammunition/rifle/30-06-springfield-178-gr-eld-x-precision-hunter> |
| Hornady 300 Win Mag 195 gr ELD Match                    | 82180 | 0.584 | 0.292 | 2930           | 24 in.      | <https://www.hornady.com/ammunition/rifle/300-win-mag-195-gr-eld-match>                    |
| Hornady 7mm PRC 180 gr ELD Match                        | 80711 | 0.796 | 0.401 | 2975           | 24 in.      | <https://www.hornady.com/ammunition/rifle/7mm-prc-180-gr-eld-match>                        |

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
