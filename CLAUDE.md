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

### Running the App

```bash
npm start              # Start Expo development server
npm run android        # Run on Android device/emulator
npm run ios            # Run on iOS device/simulator
npm run web            # Run in web browser
```

### Code Quality

```bash
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint issues automatically
npm run format         # Format code with Prettier
npm run format:check   # Check code formatting
npm run type-check     # Run TypeScript type checking
npm test               # Run tests (placeholder for now)
```

### Building

```bash
# Development build
APP_ENV=development eas build --profile development

# Staging build
APP_ENV=staging eas build --profile staging

# Production build
APP_ENV=production eas build --profile production
```

### Installed Dependencies

**Core:**
- React Native with Expo
- TypeScript with strict mode
- React Navigation (stack and tab navigators)
- Zustand (state management)

**Database & Storage:**
- expo-sqlite (local database)
- @react-native-async-storage/async-storage (settings storage)

**Data & Utilities:**
- date-fns (date/time utilities)
- victory-native (charting for ballistic curves)

**File Operations:**
- expo-print (PDF generation)
- expo-file-system (file operations)
- expo-sharing (share files)

**Device Features:**
- expo-image-picker (camera and photo library)
- expo-location (GPS, altitude)
- expo-sensors (accelerometer, barometer, etc.)

**Development:**
- ESLint + Prettier (code quality)
- TypeScript (type safety)
- GitHub Actions (CI/CD)

## Ballistic Engine Notes

The ballistic solver is performance-critical and should be implemented as a native module. It must calculate:
- Elevation/windage corrections in MIL or MOA
- Time of flight, velocity decay, energy at target
- Wind tables for variable conditions
- Moving target lead corrections
- Optional: spin drift, Coriolis effect, subsonic transitions

Input validation is critical - ensure all ballistic coefficients, velocities, and environmental parameters are within realistic ranges before calculations.

## Development Methodology

**This project uses Test-Driven Development (TDD) for all new code.**

### TDD Workflow

1. **Write the test first** - Before implementing any new feature or function, write the test that defines the expected behavior
2. **Run the test and watch it fail** - Ensure the test fails for the right reason
3. **Write minimal code to pass** - Implement just enough code to make the test pass
4. **Refactor** - Improve the code while keeping tests green
5. **Repeat** - Continue the cycle for each new piece of functionality

### Testing Guidelines

- **Unit Tests**: Test individual functions, classes, and modules in isolation
- **Integration Tests**: Test interactions between modules (e.g., database operations, repository methods)
- **Component Tests**: Test React components with React Native Testing Library
- **Coverage Target**: Aim for >80% code coverage

### Test Organization

```
__tests__/
├── unit/           # Unit tests for utilities, models, calculations
├── integration/    # Integration tests for repositories, services
└── components/     # Component tests for React components
```

### Running Tests

```bash
npm test                    # Run all tests
npm test -- --watch        # Run tests in watch mode
npm test -- --coverage     # Run tests with coverage report
npm test -- <filename>     # Run specific test file
```

When implementing new features:
1. Create the test file first (e.g., `MyComponent.test.tsx` or `myFunction.test.ts`)
2. Write test cases that define the expected behavior
3. Implement the code to satisfy the tests
4. Ensure all tests pass before committing

## Data Privacy

No personal data collection or analytics. All data stored locally unless user explicitly enables cloud sync. Implement optional biometric/passcode lock for sensitive shooting data.
