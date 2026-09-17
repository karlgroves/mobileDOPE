# The ballistic calculator

**Calculator** tab.

Pick a rifle and a load, give it a distance and the conditions, and it returns a
firing solution. This page covers what it returns, what it models, and — the part
most calculators are quiet about — what it does not.

## Getting a solution

| Input               | Notes                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| Rifle Profile       | Supplies twist rate, zero distance, scope height, click value                |
| Ammunition          | Supplies BC, bullet weight, muzzle velocity                                  |
| Target Distance     | Yards                                                                        |
| Shooting Angle      | Degrees. Positive uphill, negative downhill, 0 for level                     |
| Temperature         | °F                                                                           |
| Barometric Pressure | inHg — **station pressure**, see below                                       |
| Humidity            | %                                                                            |
| Altitude            | Feet                                                                         |
| Wind Speed          | mph                                                                          |
| Wind Direction      | Degrees the wind blows **from**. 0 = headwind, 90 = full value left-to-right |

## What you get back

- **Elevation** and **windage**, in both MIL and MOA
- **Drop** and **wind drift** in inches
- **Velocity** and **energy** at the target
- **Time of flight**
- **Maximum ordinate** and where it occurs — the highest the bullet rises above line
  of sight, which is what tells you whether a shot clears an intervening obstacle
- **Spin drift**, when it can be calculated (see below)
- **Zero angle** — the launch angle implied by your zero distance

Tap through to **Ballistic Solution Results** for the full set, and **DOPE Curve**
for the trajectory plotted out.

## Station pressure, not altimeter setting

This is the single most common way to get a wrong answer from any solver.

Weather apps, airport METARs and most barometers report **altimeter setting** —
pressure corrected to sea level so that pilots in different places can compare
readings. The solver wants **station pressure**: the actual pressure of the air the
bullet is flying through.

At 5,000 feet the two differ by roughly 5 inHg, which is not a rounding error.

If your source is sea-level-corrected, the safest approach is to give an accurate
**altitude** and a pressure appropriate to it, rather than pairing a sea-level
pressure with a real altitude — that counts the elevation twice and produces a
thinner atmosphere than exists.

## What the solver models

- Drag via **G1 or G7**, whichever coefficient the load carries
- **Density altitude** from temperature, pressure, humidity and altitude
- **Angle** — the cosine effect on uphill and downhill shots
- **Spin drift**, from twist rate, bullet dimensions and time of flight
- **Coriolis**, from latitude
- **Transonic behaviour** as the bullet slows through roughly Mach 1.2–0.8

### Spin drift needs a caliber it recognises

Spin drift is computed from the bullet's diameter, which the app infers from the
rifle's **Caliber** field. If the caliber string is not one it recognises, the
diameter lookup returns nothing and **the solution simply omits spin drift** rather
than guessing.

If you expected a spin drift figure and got none, that is usually why. Try a
conventional spelling — `6.5 Creedmoor`, `.308 Win`, `.223 Rem`.

## What it does not model

Worth knowing before you trust a number at distance:

- **Aerodynamic jump** — the vertical deflection a crosswind induces at the muzzle.
  The calculation exists in the codebase and is tested, but it is **not currently
  applied to the solution**. At normal wind speeds it is a small effect; in a
  full-value 15 mph wind at long range it is not nothing.
- **Powder temperature sensitivity.** Muzzle velocity is taken as the number you
  entered. Real velocity moves with propellant temperature — often 1–2 fps per °F.
  A load chronographed at 70°F and fired at 20°F is not the same load.
- **Vertical wind**, terrain-induced updraught and downdraught.
- **Barrel-to-barrel variation.** You entered a velocity; it believes you.

None of these are reasons to distrust the solver. They are the reasons **logged DOPE
beats a computed solution** once you are past a few hundred yards, and the reason
this app is built around recording what actually happened.

## Wind table

Go to **Calculator → solve → Wind Table**.

A matrix of wind holds across distances and wind speeds for the current rifle, load
and conditions. More useful in the field than a single-wind solution, because the
wind you actually get is not the wind you entered.

## Moving target

Go to **Calculator → Moving Target**.

Reached from the calculator screen itself.

Lead for a target moving across your line of sight, from target speed and the
solution's time of flight.

## Chronograph

Go to **Ammo → (a load) → Chronograph**.

Record a shot string and get its statistics. Use the measured average as your load's
muzzle velocity — it is the input that most repays being measured rather than copied
from a box.

## See also

- [Quick start](./quick-start.md)
- [Logging DOPE](./logging-dope.md) — where the solver's prediction meets reality
- [DOPE cards](./dope-cards.md)
