# Mobile DOPE App — Full Technical Specification

## 1. Overview

### 1.1 Purpose

The Mobile DOPE App provides precision shooters with a fast, reliable, and field-ready way to:

- Record DOPE (Data On Previous Engagements) for rifles, optics, ammunition, and environmental conditions
- Generate ballistic solutions based on user-provided weapon/ammo profiles
- Maintain a history of shots and engagements
- Provide wind, elevation, and movement corrections
- Produce printable and exportable DOPE cards

The app is optimized for field use: fast interactions, large touch targets, offline capability, and dark mode for nighttime shooting.

## 2. Target Platforms

- iOS (latest 2 major versions)
- Android (Android 10+)
- Tablet-optimized layouts optional but recommended

## 3. Core Features

### 3.1 Weapon Profiles

Users can create multiple rifle profiles. Each profile includes:

#### Data Fields

- Rifle Name / Nickname
- Caliber (e.g., .308 Win, 6.5 Creedmoor, .45-70 Gov)
- Barrel Length
- Twist Rate
- Zero Distance
- Optic Manufacturer/Model
- Reticle Type
- Click Values (MIL or MOA)
- Scope Height Over Bore

#### Functionality

- Attach DOPE logs to a weapon profile
- Clone profile
- Export/import via JSON, QR code, or cloud sync

### 3.2 Ammunition Profiles

Each rifle can have one or more ammo profiles.

#### Data Fields

- Manufacturer
- Bullet Weight (grains)
- Bullet Type (HPBT, ELD-X, SPCE, etc.)
- Ballistic Coefficient (G1/G7)
- Muzzle Velocity (manual entry or chronograph import)
- Powder Type / Load Details (optional)

#### Functionality

- Velocity Standard Deviation tracking
- Lot tracking
- Auto-calculate BC from historical drops (optional later phase)

### 3.3 Environmental Capture

The app records current conditions for each engagement:

#### Parameters

- Temperature
- Humidity
- Barometric Pressure
- Altitude / Density Altitude
- Wind Speed (constant or gusting)
- Wind Direction
- Latitude
- Light Conditions (day/night slider)

#### Sources

- Manual entry
- Device sensors (where available)
- Connected weather meter (e.g., Kestrel integration—Phase 2)

### 3.4 Ballistic Solver

A built-in ballistic solution engine provides:

#### Inputs

- Rifle + ammo profile
- Environmental conditions
- Target distance
- Shooting angle (up/down hill)

#### Outputs

- Elevation correction (MIL/MOA)
- Windage correction (full wind table)
- Lead corrections for moving targets
- Time of flight
- Velocity decay
- Energy at target

#### Optional Advanced Modules (Phase 2)

- Spin drift
- Coriolis effect
- Subsonic transition modeling

### 3.5 DOPE Logging

This is the core functional area.

Each DOPE log includes:

#### Inputs

- Rifle profile
- Ammo profile
- Date / time
- Distance to target
- Recorded drop (+/-)
- Recorded wind call
- Target type (steel, paper, vital zone)
- Group size
- Point of impact

#### Outputs

- Stored drop for later reference
- Auto-generate a curve of known distances
- Confidence rating per data point

#### Visualizations

- Table view
- Graph view (distance vs elevation correction)
- Wind chart view

### 3.6 DOPE Card Generator

Creates a printable/exportable DOPE card.

#### Supported Formats

- Mobile view (compact)
- Printable PDF (wallet-sized)
- Apple Wallet / Google Wallet pass (Phase 2)

#### Customizations

- Distances in yards or meters
- Correction units in MIL or MOA
- Include/exclude wind columns
- Auto-scale for night mode printing

### 3.7 Shot String Logging

Useful for chronograph sessions or testing loads.

#### Features

- Record shot velocity
- Auto-calculate:
- ES (Extreme Spread)
- SD (Standard Deviation)
- Average velocity
- Tag velocity groups by powder charge

### 3.8 Range Session Mode

A fast-interaction UI for use at the firing line.

#### Capabilities

- Select rifle + ammo profile
- Set distance
- Get immediate ballistic solution
- Log shots with one tap
- Voice input (“Hit at 600, wind 1.2 left”)
- Timer for cold bore / warm bore logging
- Offline mode

### 3.9 Targets & Hit Recording

#### Features

- Tap-to-mark POI on a target image
- Preloaded target templates (IPSC, F-Class, bullseye, steel)
- Upload custom targets
- Group size auto-calculation

### 3.10 Data Export

#### Users can export

- Full profile export (JSON)
- DOPE logs (CSV, PDF)
- Range session summaries (Markdown, PDF)
- Targets with marked impacts (JPEG/PNG)

#### Cloud sync option (Phase 2)

- iCloud
- Google Drive
- Dropbox

## 4. System Architecture

### 4.1 App Architecture

- React Native (recommended for cross-platform) or Flutter
- Local SQLite storage for all data
- Ballistic engine written in Rust or C++ module for performance
- Sync adapter for cloud providers
- Background service for sensor polling

## 4.2 Data Model (Simplified)

### Profiles

```javascript
RifleProfile {
  id
  name
  caliber
  barrelLength
  twistRate
  zeroDistance
  optic
  reticle
  clickValue
  scopeHeight
}
```

### Ammunition

```javascript
AmmoProfile {
  id
  rifleId
  manufacturer
  bulletWeight
  bulletType
  ballisticCoefficientG1
  ballisticCoefficientG7
  muzzleVelocity
  notes
}
```

### Environmental Data

```javascript
EnvironmentSnapshot {
  id
  temp
  humidity
  barometricPressure
  altitude
  windSpeed
  windDirection
  timestamp
}
```

### DOPE Log

```javascript
DOPELog {
  id
  rifleId
  ammoId
  envId
  distance
  dropMil
  windMil
  groupSizeInches
  hitPatternImage
  timestamp
}
```

## 5. UI/UX Requirements

### General Principles

- Large buttons & high contrast
- Dark default theme
- Field use: minimal navigation layers
- Presets for common distances (100/200/300/400/500…)
- One-tap DOPE entry

### Main Screens

1. Dashboard
2. Rifle Profiles
3. Ammo Profiles
4. Range Session
5. Ballistic Calculator
6. DOPE Logs
7. DOPE Card Generator

## 6. Security & Privacy

- All data stored locally unless user opts into cloud sync
- End-to-end encryption for cloud sync
- No personal data collection
- Optional passcode/biometric lock

## 7. Roadmap

### MVP

- Rifle profiles
- Ammo profiles
- Environment entry
- Ballistic solver (core)
- DOPE log
- DOPE card (basic)
- Offline mode
- Target marking
- CSV/PDF export

## 8. Using Prior DOPE to Assist Aiming New Shots

### 8.1 Overview

This system improves aiming solutions by combining:

- Theoretical ballistic predictions
- Historical DOPE logs
- Environmental adjustments
- Error-correction trends observed over time
- Interpolated / extrapolated data
- Barrel state behavior analysis

Engineers should treat this as a hybrid between a ballistics engine and a predictive analytics pipeline.

### 8.2 DOPE Matching Algorithm

When a user requests a firing solution:

#### Step 1: Query Past DOPE

The app searches DOPELog entries filtered by:

```sql
WHERE rifleId = :rifle
AND ammoId = :ammo
AND distance BETWEEN (requested - Δ) AND (requested + Δ)
```

Default Δ = 50 yards or user-configurable.

#### Step 2: Relevance Scoring

Each DOPE entry receives a score:

```
score =
  w_distance * distanceSimilarity +
  w_environment * envSimilarity +
  w_recency * recencyFactor +
  w_shotQuality * groupConsistency +
  w_barrelState * barrelStateMatch
```

Where:

- `distanceSimilarity` uses a Gaussian falloff
- `envSimilarity` is derived from ΔDA, ΔTemp, ΔPressure
- `shotQuality` penalizes logs with high extreme spread
- `barrelStateMatch` boosts cold-bore matches

Top-scoring entries (N = 3–10) feed the adjustment engine.

### 8.3 Correction Offset Generation

The solver provides:

`solverElevationMil`
`solverWindMil`

Match DOPE entries provide:

`actualElevationMil`
`actualWindMil`

Elevation Offset Calculation

`offsetElevation = mean(actualElevationMil - solverElevationMil)`

Weighted by the relevance score.

Wind Offset Calculation

`offsetWind = mean(actualWindMil - solverWindMil)`

Offsets are then applied:

`recommendedElevation = solverElevationMil + offsetElevation`
`recommendedWind = solverWindMil + offsetWind`

This allows the app to "learn" the shooter's actual trajectory.

### 8.4 Interpolation for Missing Distances

If DOPE exists at distances D1 < target < D2:

Use cubic spline or 2-point linear interpolation:

```
dropInterpolated = interpolate(
   (D1, DOPE[D1].actualElevationMil),
   (D2, DOPE[D2].actualElevationMil),
   targetDistance
)
```

Then blend with the solver:

```
recommendedElevation =
   α * dropInterpolated + (1 - α) * solverElevationMil
```

Default α = 0.7 (favor DOPE when available).

### 8.5 Environmental Adjustment Engine (ΔDA Modeling)

When environment differs:

Compute density altitude of historical DOPE:

```
DA_log = computeDA(envLog)
DA_now = computeDA(envCurrent)
ΔDA = DA_now - DA_log
```

Ballistic solver provides Δ drop per ΔDA:

`deltaDrop = solverDrop(DA_now) - solverDrop(DA_log)`

Adjust DOPE:

`environmentAdjustedElevation = actualElevationMil + deltaDrop`

This allows DOPE from sea level shooting to apply in mountain environments.

### 8.6 Wind Scaling Engine

Historical wind entries are normalized:

`windPerMph = actualWindMil / loggedWindSpeedMph`

Then scaled:

`recommendedWind = windPerMph * currentWindEstimateMph`

If solver produces more accurate wind tables:

- Blend them:

`recommendedWind = α * DOPEWind + (1 - α) * solverWind`

α increases if historical DOPE is abundant.

### 8.7 Barrel State Modeling

Cold-bore deviation detection

Query:

`WHERE coldBoreShotBoolean = true`

Compute:

`coldBoreBiasElevation = mean(actualElevationMil - warmBoreElevationMil)`
`coldBoreBiasWind = mean(actualWindMil - warmBoreWindMil)`

Shown as a banner in range mode:

"Expected cold-bore shift: −0.15 MIL elevation, +0.08 MIL wind."

Heat Shift Modeling

Track POI relative to shot number in session:

`slope = linearRegression(shotIndex, elevationMil)`

If slope > threshold:

- Show warning
- Apply optional correction

### 8.8 Confidence Weighting System

Final recommendation includes a confidence score:

```
confidence = combine(
   # of matching DOPE entries,
   environmental similarity,
   recency,
   group quality,
   solver agreement
)
```

Displayed visually (e.g., ★☆☆☆ to ★★★★★).

Low confidence prompts:

"Limited historical data. Using solver-heavy prediction."

### 8.9 Range Session Mode Implementation Flow

Step-by-step logic:

1. User selects rifle + ammo
2. App captures current environment (manual or sensor)
3. Solver computes initial prediction
4. DOPE matching algorithm runs
5. Offsets, deltas, and spline interpolations compute adjusted holds
6. Barrel-state model checks cold/hot conditions
7. Final recommendation displayed:

```
Elevation: +4.3 MIL
Wind: 0.7 MIL R (10 mph FV)
Confidence: ★★★★☆
Notes:
  • Historically 0.3 MIL flatter at this DA
  • Cold-bore shift ~0.2 MIL low
```

8. After each shot, user logs POI
9. DOPE database updates
10. Immediate recalculation improves next shot's recommendation

### 8.10 APIs & Module Interfaces (Internal)

Ballistic Engine API

`getLongRangeSolution(Profile, Ammo, Env, Distance, Angle): BallisticSolution`

DOPE Adjustment API

```
getDOPEAdjustedSolution(request: {
  rifleId,
  ammoId,
  envSnapshot,
  distance,
  solverSolution
}): AdjustedSolution
```

Barrel State API

`getColdBoreBias(rifleId, ammoId): BiasVector`
`getHeatShiftTrend(rifleId, ammoId): ShiftModel`

### Phase 2

- Kestrel integration
- Chronograph Bluetooth import
- Advanced physics (spin drift, Coriolis)
- Wallet pass DOPE cards
- Cloud syncing

### Phase 3

- Team sharing for competitions
- Match mode
- AR-based shot spotting
- AI detection of shot groups
