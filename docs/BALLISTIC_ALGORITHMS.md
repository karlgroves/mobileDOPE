# Ballistic Calculation Algorithms

## Overview

The Mobile DOPE app implements point-mass ballistic trajectory calculations using numerical integration methods. This provides accurate predictions for long-range shooting across various environmental conditions.

## Core Principles

### Point-Mass Model

The ballistic solver treats the projectile as a point mass moving through air, subject to:

- **Gravity**: Constant downward acceleration (32.174 ft/s²)
- **Aerodynamic Drag**: Velocity-dependent deceleration
- **Wind Drift**: Crosswind component affecting horizontal position

### Coordinate System

- **X-axis**: Horizontal distance (line of sight)
- **Y-axis**: Vertical distance (relative to line of sight)
- **Origin**: Muzzle position, offset below line of sight by scope height

## Numerical Integration

### Runge-Kutta 4th Order (RK4)

The trajectory is computed using RK4 integration, providing excellent accuracy with reasonable computational cost.

**State Vector:**

```typescript
interface State {
  x: number; // Horizontal position (feet)
  y: number; // Vertical position (feet)
  vx: number; // Horizontal velocity (ft/s)
  vy: number; // Vertical velocity (ft/s)
}
```

**Integration Step:**

```typescript
function rk4Step(
  state: State,
  dt: number,
  bc: number,
  dragModel: 'G1' | 'G7',
  speedOfSound: number,
  gravity: number
): State;
```

**RK4 Formula:**

1. Calculate k1 (derivatives at current state)
2. Calculate k2 (derivatives at state + dt/2 using k1)
3. Calculate k3 (derivatives at state + dt/2 using k2)
4. Calculate k4 (derivatives at state + dt using k3)
5. Combine: `newState = state + (dt/6) * (k1 + 2*k2 + 2*k3 + k4)`

**Time Step:** 0.001 seconds (1 millisecond) provides good balance of accuracy and performance.

## Drag Modeling

### Ballistic Coefficient (BC)

The BC relates a projectile's drag to a standard reference projectile:

```
BC = (bullet_weight / 7000) / (bullet_diameter² * i)
```

Where `i` is the form factor relating the bullet shape to the standard.

### G1 and G7 Drag Functions

Two standard drag models are supported:

- **G1**: Based on a flat-base projectile, common for traditional bullets
- **G7**: Based on a boat-tail projectile, more accurate for modern long-range bullets

Each model uses a 77-point lookup table of drag coefficients vs. Mach number.

### Drag Coefficient Lookup

```typescript
function getDragCoefficient(velocity: number, dragModel: 'G1' | 'G7', speedOfSound: number): number;
```

1. Calculate Mach number: `M = velocity / speedOfSound`
2. Find bracketing Mach values in table
3. Linear interpolation between table values
4. Return drag coefficient `Cd(M)`

### Retardation Calculation

```typescript
retardation = (v² * Cd(M)) / (BC * 3200)
```

Where:

- `v` = current velocity (ft/s)
- `Cd(M)` = drag coefficient at current Mach number
- `BC` = ballistic coefficient
- `3200` = empirical scaling factor for imperial units

## Atmospheric Effects

### Air Density Correction

BC is adjusted for actual air density:

```typescript
BC_adjusted = BC_standard * (ρ_standard / ρ_actual);
```

**Air Density Formula:**

```typescript
ρ = (pressure_mbar * 100) / (287.05 * temperature_kelvin);
```

### Speed of Sound

Temperature-dependent speed of sound:

```typescript
speedOfSound = 1116.45 * sqrt(temperature_rankine / 518.67);
```

Where temperature_rankine = temperature_fahrenheit + 459.67

### Density Altitude

Effective altitude accounting for temperature and pressure:

```typescript
DA = pressure_altitude + 120 * (temperature_F - standard_temperature);
```

## Rifle Zeroing

### Iterative Zero Finding

The solver computes the launch angle needed to intersect the line of sight at the zero distance:

```typescript
function findZeroAngle(
  zeroDistanceFeet: number,
  sightHeightFeet: number,
  muzzleVelocity: number,
  bc: number,
  dragModel: 'G1' | 'G7',
  speedOfSound: number
): number;
```

**Algorithm:**

1. Start with geometric estimate: `θ₀ = atan(sightHeight / zeroDistance) + 0.01`
2. Simulate trajectory to zero distance
3. Measure error at zero distance (inches)
4. Adjust angle based on error
5. Repeat until error < 0.01 inches (typically 10-20 iterations)

**Adjustment:**

```
adjustment = atan(error_inches / (zeroDistance_inches)) * dampingFactor
θ_new = θ_old - adjustment
```

This accounts for bullet drop over the zero distance, which simple geometry ignores.

## Angled Shots

### Effective Gravity Method

For uphill/downhill shots, gravity's effect on the bullet is reduced:

```typescript
const shotAngleRad = (angle * Math.PI) / 180;
const effectiveGravity = GRAVITY * cos(shotAngleRad);
```

**Key Points:**

- Launch angle stays constant (based on rifle's zero)
- Gravity component perpendicular to line of sight is `g * cos(θ)`
- This is the **rifle cant angle** or **cosine method**
- More accurate than modifying the launch angle

**Example:**

- 30° downhill shot: `g_eff = 32.174 * cos(30°) = 27.87 ft/s²`
- Bullet drops less than level shot, requiring lower elevation correction

## Wind Drift

### Crosswind Component

```typescript
const windAngleRad = (windDirection * Math.PI) / 180;
const crosswindComponent = windSpeed * sin(windAngleRad);
```

**Wind Direction Convention:**

- 0° = headwind (from 12 o'clock)
- 90° = right-to-left (from 3 o'clock)
- 180° = tailwind (from 6 o'clock)
- 270° = left-to-right (from 9 o'clock)

### Drift Calculation

Simplified linear drift model:

```typescript
drift_inches = crosswind_fps * timeOfFlight * 12;
```

Where `crosswind_fps = crosswind_mph * 1.467`

**More accurate**: Integrate drift along the trajectory, but linear model is sufficient for typical ranges.

## Corrections

### Angular Corrections

Convert linear drop/drift to angular corrections:

```typescript
function inchesToCorrection(inches: number, distance_yards: number, unit: 'MIL' | 'MOA'): number {
  const distance_inches = distance_yards * 36;
  const radians = atan(inches / distance_inches);

  if (unit === 'MIL') {
    return radians * 1000; // milliradians
  } else {
    return radians * (180 / PI) * 60; // minutes of angle
  }
}
```

**Note:** This uses **true** angular measurements, not the simplified approximations:

- True MIL: 1 mil = 1 mrad = 1/1000 radian
- True MOA: 1 MOA = 1/60 degree = 0.000290888 radian

## Output

### Trajectory Point

```typescript
interface TrajectoryPoint {
  distance: number; // yards
  time: number; // seconds
  velocity: number; // ft/s
  energy: number; // ft-lbs
  drop: number; // inches
  windage: number; // inches
  elevation: number; // MIL
  windageCorrection: number; // MIL
}
```

### Ballistic Solution

```typescript
interface BallisticSolution {
  drop: number; // inches at target
  windage: number; // inches at target
  elevationMIL: number; // correction in MIL
  elevationMOA: number; // correction in MOA
  windageMIL: number; // correction in MIL
  windageMOA: number; // correction in MOA
  velocity: number; // ft/s at target
  energy: number; // ft-lbs at target
  timeOfFlight: number; // seconds
  trajectory?: TrajectoryPoint[]; // optional full trajectory
  zeroAngle: number; // computed launch angle (radians)
  maxOrdinate: number; // highest point above LOS (inches)
  maxOrdinateDistance: number; // distance of max ordinate (yards)
}
```

## Wind Tables

### Generation

Wind tables are pre-computed for standard conditions:

**Distances:** 100, 200, 300, ..., 1000 yards
**Wind Speeds:** 0, 5, 10, 15, 20 mph
**Wind Direction:** User-selected (typically 90° or 270° for full value wind)

For each combination:

1. Calculate trajectory with wind
2. Extract windage at distance
3. Calculate windage correction
4. Store in table

**Result:**

```typescript
interface WindTableEntry {
  distance: number;
  windSpeed: number;
  windDirection: number;
  windDrift: number; // inches
  windageCorrection: number; // MIL or MOA
}
```

## Performance

### Optimization Techniques

1. **Minimal State**: Only 4 values tracked (x, y, vx, vy)
2. **Table Lookups**: Drag coefficients pre-tabulated
3. **Linear Interpolation**: Fast, accurate-enough for drag lookup
4. **Fixed Time Step**: Avoids adaptive step overhead
5. **Early Termination**: Stop when bullet reaches ground or max distance

### Computational Cost

Typical trajectory calculation (to 1000 yards):

- **~1000 RK4 steps** (1ms time step × 2-3 second flight)
- **~4000 drag lookups** (4 per RK4 step)
- **Total time**: < 50ms on modern mobile hardware

Wind table generation (50 entries):

- **~50 trajectory calculations**
- **Total time**: < 2 seconds

## Validation

### Test Cases

The implementation is validated against:

- Published ballistic tables (Federal, Hornady, Sierra)
- Known ballistic solvers (Applied Ballistics, Strelok)
- Field DOPE data

**Typical Accuracy:**

- Within 0.1 MIL of published data at 1000 yards
- Within 1 inch of wind drift predictions

### Edge Cases

The solver handles:

- Subsonic velocities (v < speed of sound)
- Extreme temperatures (-40°F to 120°F)
- High altitudes (0 to 15,000 ft)
- Steep angles (-45° to +45°)

## References

1. **McCoy, Robert L.** "Modern Exterior Ballistics" (1999)
2. **Litz, Bryan.** "Applied Ballistics for Long Range Shooting" (2015)
3. **Sierra Bullets.** "Exterior Ballistics Tables" (various)
4. **JBM Ballistics.** Online trajectory calculator validation data
