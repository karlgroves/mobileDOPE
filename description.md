# Mobile DOPE App — Full Technical Specification

## 1. Overview

### 1.1 Purpose

The Mobile DOPE App provides precision shooters with a fast, reliable, and field-ready way to:

* Record DOPE (Data On Previous Engagements) for rifles, optics, ammunition, and environmental conditions
* Generate ballistic solutions based on user-provided weapon/ammo profiles
* Maintain a history of shots and engagements
* Provide wind, elevation, and movement corrections
* Produce printable and exportable DOPE cards

The app is optimized for field use: fast interactions, large touch targets, offline capability, and dark mode for nighttime shooting.

## 2. Target Platforms

* iOS (latest 2 major versions)
* Android (Android 10+)
* Tablet-optimized layouts optional but recommended

## 3. Core Features

### 3.1 Weapon Profiles

Users can create multiple rifle profiles. Each profile includes:

#### Data Fields

* Rifle Name / Nickname
* Caliber (e.g., .308 Win, 6.5 Creedmoor, .45-70 Gov)
* Barrel Length
* Twist Rate
* Zero Distance
* Optic Manufacturer/Model
* Reticle Type
* Click Values (MIL or MOA)
* Scope Height Over Bore

#### Functionality

* Attach DOPE logs to a weapon profile
* Clone profile
* Export/import via JSON, QR code, or cloud sync

### 3.2 Ammunition Profiles

Each rifle can have one or more ammo profiles.

#### Data Fields

* Manufacturer
* Bullet Weight (grains)
* Bullet Type (HPBT, ELD-X, SPCE, etc.)
* Ballistic Coefficient (G1/G7)
* Muzzle Velocity (manual entry or chronograph import)
* Powder Type / Load Details (optional)

#### Functionality

* Velocity Standard Deviation tracking
* Lot tracking
* Auto-calculate BC from historical drops (optional later phase)

### 3.3 Environmental Capture

The app records current conditions for each engagement:

#### Parameters

* Temperature
* Humidity
* Barometric Pressure
* Altitude / Density Altitude
* Wind Speed (constant or gusting)
* Wind Direction
* Latitude
* Light Conditions (day/night slider)

#### Sources

* Manual entry
* Device sensors (where available)
* Connected weather meter (e.g., Kestrel integration—Phase 2)

### 3.4 Ballistic Solver

A built-in ballistic solution engine provides:

#### Inputs

* Rifle + ammo profile
* Environmental conditions
* Target distance
* Shooting angle (up/down hill)

#### Outputs

* Elevation correction (MIL/MOA)
* Windage correction (full wind table)
* Lead corrections for moving targets
* Time of flight
* Velocity decay
* Energy at target

#### Optional Advanced Modules (Phase 2)

* Spin drift
* Coriolis effect
* Subsonic transition modeling

### 3.5 DOPE Logging

This is the core functional area.

Each DOPE log includes:

#### Inputs

* Rifle profile
* Ammo profile
* Date / time
* Distance to target
* Recorded drop (+/-)
* Recorded wind call
* Target type (steel, paper, vital zone)
* Group size
* Point of impact

#### Outputs

* Stored drop for later reference
* Auto-generate a curve of known distances
* Confidence rating per data point

#### Visualizations

* Table view
* Graph view (distance vs elevation correction)
* Wind chart view

### 3.6 DOPE Card Generator

Creates a printable/exportable DOPE card.

#### Supported Formats

* Mobile view (compact)
* Printable PDF (wallet-sized)
* Apple Wallet / Google Wallet pass (Phase 2)

#### Customizations

* Distances in yards or meters
* Correction units in MIL or MOA
* Include/exclude wind columns
* Auto-scale for night mode printing

### 3.7 Shot String Logging

Useful for chronograph sessions or testing loads.

#### Features

* Record shot velocity
* Auto-calculate:
* ES (Extreme Spread)
* SD (Standard Deviation)
* Average velocity
* Tag velocity groups by powder charge

### 3.8 Range Session Mode

A fast-interaction UI for use at the firing line.

#### Capabilities

* Select rifle + ammo profile
* Set distance
* Get immediate ballistic solution
* Log shots with one tap
* Voice input (“Hit at 600, wind 1.2 left”)
* Timer for cold bore / warm bore logging
* Offline mode

### 3.9 Targets & Hit Recording

#### Features

* Tap-to-mark POI on a target image
* Preloaded target templates (IPSC, F-Class, bullseye, steel)
* Upload custom targets
* Group size auto-calculation

### 3.10 Data Export

#### Users can export

* Full profile export (JSON)
* DOPE logs (CSV, PDF)
* Range session summaries (Markdown, PDF)
* Targets with marked impacts (JPEG/PNG)

#### Cloud sync option (Phase 2)

* iCloud
* Google Drive
* Dropbox

## 4. System Architecture

### 4.1 App Architecture

* React Native (recommended for cross-platform) or Flutter
* Local SQLite storage for all data
* Ballistic engine written in Rust or C++ module for performance
* Sync adapter for cloud providers
* Background service for sensor polling

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

* Large buttons & high contrast
* Dark default theme
* Field use: minimal navigation layers
* Presets for common distances (100/200/300/400/500…)
* One-tap DOPE entry

### Main Screens

1. Dashboard
2. Rifle Profiles
3. Ammo Profiles
4. Range Session
5. Ballistic Calculator
6. DOPE Logs
7. DOPE Card Generator

## 6. Security & Privacy

* All data stored locally unless user opts into cloud sync
* End-to-end encryption for cloud sync
* No personal data collection
* Optional passcode/biometric lock

## 7. Roadmap

### MVP

* Rifle profiles
* Ammo profiles
* Environment entry
* Ballistic solver (core)
* DOPE log
* DOPE card (basic)
* Offline mode
* Target marking
* CSV/PDF export

### Phase 2

* Kestrel integration
* Chronograph Bluetooth import
* Advanced physics (spin drift, Coriolis)
* Wallet pass DOPE cards
* Cloud syncing

### Phase 3

* Team sharing for competitions
* Match mode
* AR-based shot spotting
* AI detection of shot groups
