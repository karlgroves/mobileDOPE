# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mobile DOPE App is a mobile application for precision shooters to record DOPE (Data On Previous Engagements), generate ballistic solutions, and maintain shooting history. The app is designed for field use with offline capability, dark mode, and large touch targets optimized for shooting environments.

**Target Platforms:** iOS (latest 2 versions) and Android 10+

**Technology Stack (Planned):**
- React Native or Flutter for cross-platform mobile development
- SQLite for local data storage
- Rust or C++ module for high-performance ballistic engine
- Background service for sensor polling

## Project Status

This is a new project. The technical specification is complete (see `description.md`) but implementation has not yet started. When beginning development, reference the specification for detailed requirements on weapon profiles, ammunition tracking, environmental data capture, ballistic calculations, and DOPE logging.

## Git Workflow

**This project uses Git Flow for all development work.**

### Branch Structure

- **main** - Production-ready code only. All releases are tagged here.
- **develop** - Integration branch for features. This is the default branch for ongoing development.
- **feature/** - Feature branches created from `develop` (e.g., `feature/rifle-profiles`, `feature/ballistic-calculator`)
- **release/** - Release preparation branches created from `develop` (e.g., `release/1.0.0`)
- **hotfix/** - Emergency fixes created from `main` (e.g., `hotfix/critical-crash-fix`)

### Workflow Guidelines

1. **Starting new work:** Create feature branches from `develop`
2. **Feature completion:** Merge feature branches back to `develop` via pull request
3. **Release preparation:** Create release branch from `develop`, perform final testing and bug fixes
4. **Release:** Merge release branch to both `main` and `develop`, tag the release on `main`
5. **Hotfixes:** Create from `main`, merge back to both `main` and `develop`

### Naming Conventions

- Features: `feature/descriptive-name` (e.g., `feature/dope-logging`, `feature/wind-table-generation`)
- Releases: `release/x.y.z` (e.g., `release/1.0.0`)
- Hotfixes: `hotfix/issue-description` (e.g., `hotfix/ballistic-calc-crash`)

When creating commits and branches, follow Git Flow conventions strictly to maintain a clean and organized repository history.

## Core Architecture (From Specification)

### Data Model

The app centers around four main entities:

1. **RifleProfile** - Stores rifle configuration (caliber, barrel length, twist rate, zero distance, optic details, click values)
2. **AmmoProfile** - Linked to rifles, stores ammunition data (manufacturer, bullet weight, BC, muzzle velocity)
3. **EnvironmentSnapshot** - Captures shooting conditions (temperature, humidity, pressure, altitude, wind)
4. **DOPELog** - Core engagement records linking rifle, ammo, environment, distance, drop, wind corrections, and hit data

### Key Features to Implement

**MVP Priority:**
- Rifle and ammunition profile management
- Environmental data entry (manual and sensor-based)
- Ballistic solver core (elevation/windage corrections)
- DOPE logging with table and graph views
- DOPE card generator (PDF export)
- Target marking with group size calculation
- Offline-first architecture

**Phase 2:**
- External device integration (Kestrel weather meter, chronograph Bluetooth)
- Advanced ballistics (spin drift, Coriolis effect)
- Cloud sync (iCloud, Google Drive, Dropbox)
- Wallet pass DOPE cards

### Design Constraints

- **Field-optimized UX:** Large buttons, high contrast, minimal navigation depth
- **Dark theme default:** For nighttime shooting environments
- **Offline-first:** All core functionality must work without network
- **Fast interactions:** One-tap DOPE entry, presets for common distances
- **Security:** Local-only storage by default, optional cloud sync with E2E encryption

## Development Commands

(These will be populated once the project structure is established. Common commands will include building for iOS/Android, running tests, linting, and starting the development server.)

## Ballistic Engine Notes

The ballistic solver is performance-critical and should be implemented as a native module. It must calculate:
- Elevation/windage corrections in MIL or MOA
- Time of flight, velocity decay, energy at target
- Wind tables for variable conditions
- Moving target lead corrections
- Optional: spin drift, Coriolis effect, subsonic transitions

Input validation is critical - ensure all ballistic coefficients, velocities, and environmental parameters are within realistic ranges before calculations.

## Data Privacy

No personal data collection or analytics. All data stored locally unless user explicitly enables cloud sync. Implement optional biometric/passcode lock for sensitive shooting data.
