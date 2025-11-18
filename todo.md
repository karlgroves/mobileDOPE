# Mobile DOPE App - Development Tasks

## Project Setup & Infrastructure

### Initial Setup
- [x] Decide between React Native vs Flutter framework (React Native with Expo)
- [x] Initialize project with CLI tool (expo/react-native-cli or flutter create)
- [x] Set up version control and .gitignore (Git Flow with main/develop branches)
- [x] Configure TypeScript/Dart for type safety (TypeScript with strict mode)
- [x] Set up project folder structure (screens, components, services, models, utils)
- [x] Configure linting (ESLint/TSLint or Flutter analysis)
- [x] Set up code formatting (Prettier or dartfmt)
- [x] Create development, staging, and production build configurations (app.config.ts, eas.json)

### Development Environment
- [ ] Set up iOS development environment (Xcode, simulators) - User setup required
- [ ] Set up Android development environment (Android Studio, emulators) - User setup required
- [x] Configure Metro bundler / Flutter build system (Expo configured)
- [x] Set up hot reload and fast refresh (Expo default)
- [x] Configure debugging tools (React DevTools / Flutter DevTools) (Expo default)
- [ ] Set up device testing on physical iOS and Android devices - User setup required

### Dependencies & Libraries
- [x] Install and configure SQLite database library (expo-sqlite)
- [x] Install navigation library (@react-navigation/native, native-stack, bottom-tabs)
- [x] Install state management solution (Zustand)
- [ ] Install form handling library (react-hook-form) - To be added when needed
- [x] Install date/time utilities (date-fns)
- [x] Install charting/graphing library for ballistic curves (victory-native)
- [x] Install PDF generation library (expo-print)
- [ ] Install CSV export library - Will implement custom utility
- [x] Install image picker/camera library for target photos (expo-image-picker)
- [x] Install device sensor access libraries (expo-sensors, expo-location)
- [x] Install async storage for app settings (@react-native-async-storage/async-storage)

### Build & CI/CD
- [x] Configure build scripts for iOS (eas.json)
- [x] Configure build scripts for Android (eas.json)
- [x] Set up automated testing pipeline (GitHub Actions CI workflow)
- [ ] Configure code signing for iOS - User setup required (EAS)
- [ ] Configure signing keys for Android - User setup required (EAS)
- [x] Set up continuous integration (GitHub Actions)
- [ ] Configure automated build numbering - Will configure with EAS

---

## Data Layer

### Database Schema Design
- [x] Design RifleProfile table schema
- [x] Design AmmoProfile table schema with rifleId foreign key
- [x] Design EnvironmentSnapshot table schema
- [x] Design DOPELog table schema with foreign keys
- [x] Design ShotString table for chronograph sessions
- [x] Design RangeSession table for session tracking
- [x] Design TargetImage table for POI marking
- [x] Design AppSettings table for user preferences
- [x] Create database migration system
- [x] Add indexes for common queries (by rifleId, by timestamp, etc.)

### Database Implementation
- [x] Create database initialization module
- [x] Implement database connection manager
- [x] Create schema migration runner
- [x] Implement RifleProfile CRUD operations
- [x] Implement AmmoProfile CRUD operations
- [x] Implement EnvironmentSnapshot CRUD operations
- [x] Implement DOPELog CRUD operations
- [ ] Implement ShotString CRUD operations - To be implemented when needed
- [ ] Implement RangeSession CRUD operations - To be implemented when needed
- [ ] Implement TargetImage CRUD operations - To be implemented when needed
- [ ] Implement AppSettings CRUD operations - To be implemented when needed
- [x] Add database transaction support
- [x] Implement cascading deletes (e.g., delete ammo when rifle deleted) - Via foreign keys
- [ ] Create database backup/restore functionality - To be implemented later
- [x] Add database integrity checks

### Data Models
- [x] Create RifleProfile model class with validation
- [x] Create AmmoProfile model class with validation
- [x] Create EnvironmentSnapshot model class with validation
- [x] Create DOPELog model class with validation
- [ ] Create ShotString model class with validation - To be implemented when needed
- [ ] Create RangeSession model class with validation - To be implemented when needed
- [ ] Create TargetImage model class with validation - To be implemented when needed
- [x] Implement model serialization (toJSON/fromJSON)
- [ ] Create model factories for testing - To be implemented with tests
- [x] Add data validation rules (e.g., BC must be 0-1, velocity > 0)

---

## Ballistic Engine

### Core Ballistic Calculations
- [ ] Research ballistic calculation algorithms (Miller, Litz, McCoy models)
- [ ] Decide on native module approach (Rust/C++ vs pure Dart/JS)
- [ ] Set up native module bridge if using Rust/C++
- [ ] Implement atmospheric model (pressure altitude, density altitude calculation)
- [ ] Implement drag model for G1 ballistic coefficient
- [ ] Implement drag model for G7 ballistic coefficient
- [ ] Implement trajectory calculation (Runge-Kutta or similar numerical integration)
- [ ] Implement elevation correction calculation (MIL output)
- [ ] Implement elevation correction calculation (MOA output)
- [ ] Implement windage correction calculation
- [ ] Implement time of flight calculation
- [ ] Implement velocity decay calculation
- [ ] Implement energy at target calculation
- [ ] Implement angle cosine factor for uphill/downhill shooting
- [x] Add unit conversion utilities (yards/meters, fps/mps, etc.) - WITH TESTS

### Advanced Ballistic Features (Phase 2)
- [ ] Implement spin drift calculation
- [ ] Implement Coriolis effect calculation (latitude-dependent)
- [ ] Implement subsonic transition detection
- [ ] Implement subsonic drag modeling
- [ ] Add aerodynamic jump calculation
- [ ] Implement moving target lead calculation

### Wind Table Generation
- [ ] Create wind table generator (0-20 mph at various angles)
- [ ] Implement crosswind component calculation
- [ ] Implement headwind/tailwind effects
- [ ] Create wind rose visualization data structure
- [ ] Add gusting wind averaging

### Ballistic Engine Testing
- [ ] Unit test atmospheric calculations against known values
- [ ] Unit test trajectory calculations against published ballistic tables
- [ ] Validate G1/G7 drag models with manufacturer data
- [ ] Test edge cases (extreme temperatures, altitudes, angles)
- [ ] Performance test for real-time calculation speed
- [ ] Create benchmark suite comparing to known ballistic solvers

---

## UI/UX Foundation

### Theme & Styling
- [x] Create dark theme color palette
- [x] Create optional light theme color palette
- [x] Define typography scale (large, field-readable fonts)
- [x] Create night-vision compatible red mode (optional)
- [ ] Create button component with large touch targets
- [ ] Create input field component with large touch targets
- [ ] Create high-contrast form components
- [ ] Implement theme switching mechanism
- [ ] Test color contrast ratios for accessibility

### Navigation Structure
- [x] Design navigation architecture (tabs, stack, drawer)
- [x] Implement main tab navigator (Dashboard, Profiles, Range, Calculator, Logs)
- [x] Implement stack navigation for drill-down screens (Profiles, Range, Calculator, Logs)
- [x] Implement back button handling (default React Navigation behavior)
- [ ] Create navigation animations suitable for field use - Using defaults for now
- [ ] Add navigation state persistence - To be implemented later
- [ ] Create deep linking structure for future use - To be implemented later

### Common Components
- [ ] Create reusable Card component
- [ ] Create reusable List component
- [ ] Create reusable Modal/Dialog component
- [ ] Create IconButton component
- [ ] Create SegmentedControl component (for MIL/MOA switching)
- [ ] Create NumberPicker component (for distance selection)
- [ ] Create UnitToggle component (yards/meters, MIL/MOA)
- [ ] Create ConfirmationDialog component
- [ ] Create LoadingSpinner component
- [ ] Create EmptyState component
- [ ] Create ErrorBoundary component

---

## Feature: Rifle Profiles

### Rifle Profile Management
- [ ] Design Rifle Profile list screen
- [ ] Implement Rifle Profile list screen with sorting/filtering
- [ ] Design Rifle Profile detail/edit screen
- [ ] Implement Rifle Profile creation form
- [ ] Add caliber picker with common calibers preset
- [ ] Add optic manufacturer/model picker
- [ ] Add reticle type picker
- [ ] Add click value input (MIL/MOA with validation)
- [ ] Add scope height over bore input
- [ ] Implement Rifle Profile edit functionality
- [ ] Implement Rifle Profile delete with confirmation
- [ ] Add profile clone functionality
- [ ] Implement profile image upload (optional rifle photo)
- [ ] Add validation for all required fields
- [ ] Add search/filter for rifle list
- [ ] Implement sort by name, caliber, last used

### Rifle Profile Data
- [ ] Create comprehensive caliber database (.308, 6.5 CM, .45-70, etc.)
- [ ] Create optic manufacturer database
- [ ] Create reticle type database
- [ ] Add custom caliber entry option
- [ ] Add custom optic entry option

---

## Feature: Ammunition Profiles

### Ammo Profile Management
- [ ] Design Ammo Profile list screen (grouped by rifle)
- [ ] Implement Ammo Profile list screen
- [ ] Design Ammo Profile detail/edit screen
- [ ] Implement Ammo Profile creation form
- [ ] Add manufacturer picker
- [ ] Add bullet weight input with validation
- [ ] Add bullet type picker (HPBT, ELD-X, SPCE, etc.)
- [ ] Add ballistic coefficient inputs (G1 and G7)
- [ ] Add muzzle velocity input
- [ ] Add powder type/load details fields
- [ ] Add lot tracking field
- [ ] Implement Ammo Profile edit functionality
- [ ] Implement Ammo Profile delete with confirmation
- [ ] Link ammo profiles to rifle profiles
- [ ] Add validation for BC range (0-1 typically)
- [ ] Add validation for realistic velocity ranges

### Ammo Data
- [ ] Create ammunition manufacturer database
- [ ] Create bullet type database
- [ ] Add factory load database with known BC/velocity values
- [ ] Allow custom ammo entry

### Chronograph Integration
- [ ] Design velocity entry interface
- [ ] Implement shot string velocity logging
- [ ] Calculate and display ES (Extreme Spread)
- [ ] Calculate and display SD (Standard Deviation)
- [ ] Calculate and display average velocity
- [ ] Link shot strings to ammo profiles
- [ ] Update ammo profile muzzle velocity from shot string
- [ ] Add chronograph session history

---

## Feature: Environmental Data

### Environmental Input
- [ ] Design environmental data entry screen
- [ ] Implement manual temperature input
- [ ] Implement manual humidity input
- [ ] Implement manual barometric pressure input
- [ ] Implement manual altitude input
- [ ] Implement wind speed input (constant or gusting range)
- [ ] Implement wind direction picker (compass rose UI)
- [ ] Add light conditions slider (day/night)
- [ ] Implement density altitude calculation and display
- [ ] Add presets for common conditions

### Sensor Integration
- [ ] Request device sensor permissions
- [ ] Access device barometer (if available)
- [ ] Access device GPS for altitude and latitude
- [ ] Access device temperature sensor (if available)
- [ ] Implement sensor data refresh mechanism
- [ ] Add sensor availability detection
- [ ] Implement fallback to manual entry when sensors unavailable
- [ ] Add sensor calibration options

### Environmental Snapshot Management
- [ ] Auto-save environmental snapshot with each DOPE log
- [ ] Allow editing of saved environmental data
- [ ] Display environmental conditions in log history
- [ ] Compare environmental conditions across sessions

---

## Feature: Ballistic Calculator

### Calculator UI
- [ ] Design ballistic calculator screen
- [ ] Add rifle profile selector
- [ ] Add ammo profile selector
- [ ] Add target distance input
- [ ] Add shooting angle input (incline/decline)
- [ ] Add current environmental conditions section
- [ ] Implement "Calculate" button
- [ ] Display elevation correction prominently
- [ ] Display windage correction table
- [ ] Display time of flight
- [ ] Display velocity at target
- [ ] Display energy at target
- [ ] Add unit toggle (MIL/MOA, yards/meters)
- [ ] Add distance presets (100, 200, 300, 400, 500, 600+ yards)
- [ ] Implement one-tap distance selection

### Calculator Features
- [ ] Generate full wind table (0-20mph, various angles)
- [ ] Display wind table in scrollable view
- [ ] Implement moving target lead calculator
- [ ] Add "Save to DOPE Log" quick action
- [ ] Add comparison mode (compare two ammo profiles)
- [ ] Export calculator results as PDF/image

---

## Feature: DOPE Logging

### DOPE Log Entry
- [ ] Design DOPE log entry screen
- [ ] Implement quick-entry mode for field use
- [ ] Add rifle profile auto-selection (from last used)
- [ ] Add ammo profile auto-selection (from last used)
- [ ] Add distance quick-select buttons
- [ ] Add drop correction input (MIL/MOA)
- [ ] Add windage correction input (MIL/MOA)
- [ ] Add target type selector (steel, paper, vital zone)
- [ ] Add group size input
- [ ] Add POI marking on target image
- [ ] Add notes field
- [ ] Auto-populate environmental data
- [ ] Add timestamp (auto or manual)
- [ ] Implement one-tap save
- [ ] Add voice input support for hands-free logging

### DOPE Log Viewing
- [ ] Design DOPE log list screen
- [ ] Implement DOPE log table view
- [ ] Add filtering by rifle, ammo, date, distance
- [ ] Add sorting options
- [ ] Implement DOPE log detail view
- [ ] Allow editing of saved DOPE logs
- [ ] Allow deletion of DOPE logs
- [ ] Display environmental conditions for each log
- [ ] Show attached target images

### DOPE Visualization
- [ ] Design ballistic curve graph view
- [ ] Implement distance vs elevation graph
- [ ] Plot actual DOPE data points on graph
- [ ] Overlay calculated ballistic curve
- [ ] Show confidence rating per data point
- [ ] Implement wind chart visualization
- [ ] Add zoom/pan for graph interaction
- [ ] Export graph as image

### DOPE Analysis
- [ ] Calculate confidence rating for each data point
- [ ] Detect outliers in DOPE data
- [ ] Auto-generate drop curve from known distances
- [ ] Compare actual vs calculated drops
- [ ] Suggest muzzle velocity corrections based on DOPE
- [ ] Suggest BC corrections based on DOPE

---

## Feature: Range Session Mode

### Session Management
- [ ] Design range session start screen
- [ ] Implement session creation (select rifle + ammo)
- [ ] Set current distance for session
- [ ] Auto-load environmental conditions
- [ ] Display current ballistic solution prominently
- [ ] Implement quick shot logging (one-tap)
- [ ] Add shot counter for session
- [ ] Implement session timer
- [ ] Track cold bore vs warm bore shots
- [ ] End session and save all data
- [ ] Review session summary
- [ ] Export session report

### Fast Interaction UI
- [ ] Design minimal, glove-friendly interface
- [ ] Implement large hit/miss buttons
- [ ] Add quick adjustment inputs (+/- 0.1 MIL increments)
- [ ] Implement swipe gestures for common actions
- [ ] Add voice command support ("Hit at 600")
- [ ] Implement haptic feedback for confirmations
- [ ] Ensure offline functionality
- [ ] Add screen wake lock during session

---

## Feature: Target & Hit Recording

### Target Management
- [ ] Create target template database (IPSC, F-Class, bullseye, steel)
- [ ] Design target image viewer with POI marking
- [ ] Implement tap-to-mark POI on target
- [ ] Add multiple POI markers for group
- [ ] Calculate group size automatically (max spread)
- [ ] Calculate group center (mean POI)
- [ ] Allow custom target image upload
- [ ] Implement pinch-zoom on target images
- [ ] Save marked target images to DOPE logs
- [ ] Export marked targets as JPEG/PNG

### Group Analysis
- [ ] Calculate horizontal spread
- [ ] Calculate vertical spread
- [ ] Calculate mean radius
- [ ] Calculate circular error probable (CEP)
- [ ] Detect shot calling accuracy (if predicted POI recorded)

---

## Feature: DOPE Card Generator

### DOPE Card Design
- [ ] Create printable DOPE card template (wallet-sized)
- [ ] Design mobile view DOPE card
- [ ] Add customization for distance range
- [ ] Add customization for distance increments
- [ ] Add customization for wind speed columns
- [ ] Add toggle for MIL/MOA units
- [ ] Add toggle for yards/meters
- [ ] Implement dark/light print optimization
- [ ] Add rifle/ammo/date header
- [ ] Include QR code with profile data (optional)

### DOPE Card Export
- [ ] Generate PDF from DOPE card
- [ ] Implement PDF page sizing (wallet card dimensions)
- [ ] Add "Save to Files" functionality
- [ ] Add "Share" functionality (email, AirDrop, etc.)
- [ ] Implement print functionality
- [ ] Add preview before export

### DOPE Card Formats
- [ ] Create condensed format (distance + correction only)
- [ ] Create detailed format (with wind table)
- [ ] Create comparison format (multiple ammo types)
- [ ] Add night-vision friendly format (red on black)

---

## Feature: Data Import/Export

### Export Functionality
- [ ] Design export options screen
- [ ] Implement full profile export (JSON)
- [ ] Implement DOPE logs export (CSV)
- [ ] Implement DOPE logs export (PDF report)
- [ ] Implement range session summary export (Markdown)
- [ ] Implement range session summary export (PDF)
- [ ] Export marked target images
- [ ] Implement QR code generation for profile sharing
- [ ] Add batch export (all profiles at once)

### Import Functionality
- [ ] Design import screen
- [ ] Implement JSON profile import
- [ ] Implement QR code scanning for profile import
- [ ] Add duplicate detection during import
- [ ] Add merge vs replace options
- [ ] Validate imported data format
- [ ] Handle import errors gracefully

### Backup/Restore
- [ ] Implement full database backup
- [ ] Implement full database restore
- [ ] Add backup scheduling (daily, weekly, manual)
- [ ] Store backups to local storage
- [ ] Add backup encryption option

---

## Settings & Preferences

### App Settings
- [ ] Design settings screen
- [ ] Add default units preference (MIL/MOA)
- [ ] Add default distance units preference (yards/meters)
- [ ] Add default theme preference (dark/light/auto)
- [ ] Add default rifle/ammo selection
- [ ] Add distance preset customization
- [ ] Add caliber database management
- [ ] Add data storage location preference
- [ ] Implement app lock toggle (passcode/biometric)
- [ ] Add haptic feedback toggle
- [ ] Add sound effects toggle
- [ ] Add screen timeout preference for range sessions

### Security Settings
- [ ] Implement passcode setup screen
- [ ] Implement biometric authentication (Face ID, Touch ID, fingerprint)
- [ ] Add auto-lock timer setting
- [ ] Implement app lock on background
- [ ] Add emergency disable option

---

## Testing

### Unit Tests
- [ ] Write unit tests for ballistic calculations
- [ ] Write unit tests for atmospheric models
- [ ] Write unit tests for data models
- [ ] Write unit tests for database operations
- [ ] Write unit tests for import/export functions
- [ ] Write unit tests for validation logic
- [ ] Write unit tests for unit conversions
- [ ] Write unit tests for group size calculations
- [ ] Achieve >80% code coverage

### Integration Tests
- [ ] Test database migrations
- [ ] Test profile creation and DOPE logging workflow
- [ ] Test environmental data capture and usage
- [ ] Test ballistic solver integration
- [ ] Test export/import round-trip
- [ ] Test offline mode functionality
- [ ] Test sensor integration

### UI/UX Tests
- [ ] Test navigation flows
- [ ] Test form validation and error states
- [ ] Test dark theme rendering
- [ ] Test touch target sizes (minimum 44x44pt)
- [ ] Test scrolling performance with large datasets
- [ ] Test graph rendering performance
- [ ] User acceptance testing with target users (shooters)

### Device Testing
- [ ] Test on iPhone (latest 2 iOS versions)
- [ ] Test on iPad
- [ ] Test on Android phone (Android 10, 11, 12, 13, 14)
- [ ] Test on Android tablet
- [ ] Test in bright sunlight conditions
- [ ] Test with gloves on
- [ ] Test battery usage during range sessions
- [ ] Test sensor availability across devices

### Performance Testing
- [ ] Measure app launch time
- [ ] Measure ballistic calculation speed
- [ ] Measure database query performance with 1000+ logs
- [ ] Measure graph rendering with 100+ data points
- [ ] Test memory usage
- [ ] Profile and optimize hot paths

---

## Documentation

### User Documentation
- [ ] Write user guide for rifle/ammo setup
- [ ] Write user guide for DOPE logging
- [ ] Write user guide for ballistic calculator
- [ ] Write user guide for DOPE card generation
- [ ] Create quick start guide
- [ ] Create tutorial for first-time users
- [ ] Add in-app help/tooltips
- [ ] Create FAQ document

### Developer Documentation
- [ ] Document database schema
- [ ] Document ballistic calculation algorithms
- [ ] Document API for native modules
- [ ] Create architecture decision records (ADRs)
- [ ] Document state management patterns
- [ ] Create contribution guide

---

## Deployment - iOS

### App Store Preparation
- [ ] Create App Store Connect account
- [ ] Register app bundle ID
- [ ] Create app icons (all required sizes)
- [ ] Create launch screen
- [ ] Prepare app screenshots (all device sizes)
- [ ] Write app description
- [ ] Prepare app preview video (optional)
- [ ] Choose app categories
- [ ] Set age rating
- [ ] Create privacy policy
- [ ] Configure in-app purchases (if applicable)

### iOS Build & Release
- [ ] Configure code signing certificates
- [ ] Configure provisioning profiles
- [ ] Test on TestFlight with beta testers
- [ ] Gather beta feedback
- [ ] Fix critical bugs from beta
- [ ] Create production build
- [ ] Submit for App Store review
- [ ] Respond to review feedback
- [ ] Release to App Store

---

## Deployment - Android

### Google Play Preparation
- [ ] Create Google Play Developer account
- [ ] Register app package name
- [ ] Create app icons (all required sizes)
- [ ] Create launch screen
- [ ] Prepare app screenshots (all device sizes)
- [ ] Create feature graphic
- [ ] Write app description
- [ ] Prepare promotional video (optional)
- [ ] Choose app categories
- [ ] Set content rating
- [ ] Create privacy policy
- [ ] Configure in-app purchases (if applicable)

### Android Build & Release
- [ ] Generate upload keystore
- [ ] Configure signing in build.gradle
- [ ] Create release build (AAB format)
- [ ] Test on internal testing track
- [ ] Promote to closed beta track
- [ ] Gather beta feedback
- [ ] Fix critical bugs from beta
- [ ] Create production release
- [ ] Submit for Google Play review
- [ ] Release to Google Play

---

## Feature: DOPE-Assisted Aiming (Hybrid Ballistic + Historical System)

### DOPE Matching Algorithm

#### Query System
- [ ] Implement DOPE query builder with configurable distance delta (Δ)
- [ ] Add WHERE clause filtering by rifleId, ammoId, and distance range
- [ ] Set default Δ = 50 yards (configurable in settings)
- [ ] Create user preference for custom Δ values
- [ ] Write unit tests for query builder with various distance ranges

#### Relevance Scoring Engine
- [ ] Design relevance scoring data structure (weights + factors)
- [ ] Implement distance similarity calculation (Gaussian falloff)
- [ ] Implement environment similarity calculation (ΔDA, ΔTemp, ΔPressure)
- [ ] Implement recency factor calculation (time-decay function)
- [ ] Implement shot quality metrics (group consistency, extreme spread penalization)
- [ ] Implement barrel state matching (cold bore, shot count in session)
- [ ] Create weighted scoring function combining all factors
- [ ] Add configurable weight parameters (w_distance, w_environment, w_recency, etc.)
- [ ] Optimize scoring to select top N=3-10 entries
- [ ] Write unit tests for relevance scoring with known data sets

#### Gaussian Falloff Implementation
- [ ] Research optimal sigma value for distance similarity
- [ ] Implement Gaussian distance similarity function: `exp(-((d1-d2)^2) / (2*sigma^2))`
- [ ] Test falloff curves with different sigma values
- [ ] Add sigma as configurable parameter

#### Environmental Similarity Calculation
- [ ] Implement ΔDA (density altitude delta) calculation between logs
- [ ] Implement ΔTemp calculation with normalized weighting
- [ ] Implement ΔPressure calculation with normalized weighting
- [ ] Combine environmental deltas into single similarity score
- [ ] Test environmental similarity with extreme conditions (sea level vs mountain)

#### Recency Factor
- [ ] Implement time-decay function (exponential or linear)
- [ ] Add half-life parameter for decay (default: 6 months)
- [ ] Test recency scoring with timestamps spanning years
- [ ] Add option to disable recency weighting

#### Shot Quality Metrics
- [ ] Calculate group consistency score from groupSizeInches
- [ ] Penalize logs with high extreme spread
- [ ] Boost logs with tight groups (< 1 MOA)
- [ ] Implement outlier detection for group sizes

#### Barrel State Matching
- [ ] Add coldBoreShot boolean field to DOPE logs
- [ ] Add shotNumberInSession field to DOPE logs
- [ ] Implement cold bore matching logic
- [ ] Implement warm bore matching logic
- [ ] Calculate barrel temperature state similarity

---

### Correction Offset Generation

#### Solver Integration
- [ ] Create interface between DOPE system and ballistic solver
- [ ] Get solver predictions for historical DOPE entries (elevation, windage)
- [ ] Store solver predictions alongside actual DOPE data
- [ ] Handle cases where solver parameters differ from log time

#### Offset Calculation
- [ ] Implement elevation offset calculation: `mean(actualElevationMil - solverElevationMil)`
- [ ] Implement windage offset calculation: `mean(actualWindMil - solverWindMil)`
- [ ] Apply relevance score weighting to offset means
- [ ] Handle edge cases (no matching DOPE, single data point)

#### Offset Application
- [ ] Apply elevation offset to solver predictions: `solverElevationMil + offsetElevation`
- [ ] Apply windage offset to solver predictions: `solverWindMil + offsetWind`
- [ ] Display both raw solver and adjusted predictions in UI
- [ ] Add toggle to disable DOPE adjustments (solver-only mode)

#### Testing
- [ ] Write unit tests for offset calculations with mock data
- [ ] Test weighted offset with varying relevance scores
- [ ] Test edge cases (zero matching DOPE, all perfect matches)
- [ ] Validate against real-world DOPE data sets

---

### Interpolation for Missing Distances

#### Cubic Spline Implementation
- [ ] Research cubic spline interpolation algorithms
- [ ] Implement natural cubic spline for elevation data
- [ ] Implement natural cubic spline for windage data
- [ ] Handle boundary conditions (start/end of curve)
- [ ] Test spline smoothness and accuracy

#### Linear Interpolation Fallback
- [ ] Implement 2-point linear interpolation
- [ ] Use linear interpolation when only 2 DOPE points exist
- [ ] Use linear interpolation for distances outside spline range (extrapolation)
- [ ] Add warning when extrapolating beyond known DOPE

#### Blending Algorithm
- [ ] Implement blending function: `α * dopeInterpolated + (1 - α) * solverPrediction`
- [ ] Set default α = 0.7 (favor DOPE)
- [ ] Make α configurable in settings
- [ ] Adjust α based on DOPE density (more DOPE = higher α)
- [ ] Adjust α based on confidence score
- [ ] Display blend ratio in UI ("70% DOPE, 30% solver")

#### Distance Coverage Analysis
- [ ] Calculate DOPE coverage percentage for rifle+ammo combo
- [ ] Identify gaps in DOPE data (missing distance ranges)
- [ ] Suggest distances to practice based on gaps
- [ ] Display DOPE coverage visualization (timeline/graph)

#### Testing
- [ ] Write unit tests for cubic spline with known curves
- [ ] Test linear interpolation accuracy
- [ ] Test blending with various α values
- [ ] Test extrapolation beyond max/min DOPE distances

---

### Environmental Adjustment Engine (ΔDA Modeling)

#### Density Altitude Computation
- [ ] Implement computeDA(temperature, pressure, altitude) function
- [ ] Use standard atmosphere formulas
- [ ] Validate DA calculations against published tables
- [ ] Test with extreme conditions (Death Valley, Mt. Everest)

#### ΔDA Delta Calculation
- [ ] Calculate DA for historical DOPE log: `DA_log = computeDA(envLog)`
- [ ] Calculate DA for current conditions: `DA_now = computeDA(envCurrent)`
- [ ] Calculate delta: `ΔDA = DA_now - DA_log`
- [ ] Store ΔDA with each relevance-scored DOPE entry

#### Solver Integration for Drop per ΔDA
- [ ] Query solver for drop at DA_log
- [ ] Query solver for drop at DA_now
- [ ] Calculate drop delta: `deltaDrop = solverDrop(DA_now) - solverDrop(DA_log)`
- [ ] Apply delta to historical DOPE: `adjustedElevation = actualElevationMil + deltaDrop`

#### DOPE Adjustment Application
- [ ] Apply DA adjustment to all matching DOPE entries
- [ ] Recalculate relevance scores after adjustment
- [ ] Display original vs DA-adjusted elevations in UI
- [ ] Add toggle to view adjustments step-by-step

#### Testing
- [ ] Write unit tests for DA calculations
- [ ] Test ΔDA adjustments with known ballistic tables
- [ ] Validate sea-level DOPE adjusting to 5000ft altitude
- [ ] Test extreme temperature differentials

---

### Wind Scaling Engine

#### Wind Normalization
- [ ] Calculate wind-per-mph: `windPerMph = actualWindMil / loggedWindSpeedMph`
- [ ] Handle zero wind cases (no wind in log)
- [ ] Store normalized wind values for each DOPE entry
- [ ] Test normalization with crosswinds at various angles

#### Current Condition Scaling
- [ ] Scale normalized wind to current conditions: `windPerMph * currentWindEstimateMph`
- [ ] Apply wind direction vector adjustments
- [ ] Handle gusting wind (use average or max)
- [ ] Add wind angle conversion (clock-to-value)

#### Solver Blending for Wind
- [ ] Get solver wind prediction for current conditions
- [ ] Blend DOPE wind with solver wind: `α * DOPEWind + (1 - α) * solverWind`
- [ ] Increase α when abundant DOPE wind data exists
- [ ] Decrease α when wind data is sparse or inconsistent

#### Wind Table Integration
- [ ] Apply DOPE wind adjustments to full wind table (0-20mph)
- [ ] Generate adjusted wind table for various angles
- [ ] Display DOPE-adjusted vs solver-only wind tables
- [ ] Highlight when DOPE significantly differs from solver

#### Testing
- [ ] Write unit tests for wind normalization
- [ ] Test wind scaling with various mph values
- [ ] Test wind angle conversions
- [ ] Validate against known wind drift data

---

### Barrel State Modeling

#### Cold-Bore Deviation Detection

##### Data Collection
- [ ] Add coldBoreShot field to DOPELog schema (boolean)
- [ ] Add shotNumberInSession field to DOPELog schema (integer)
- [ ] Prompt user to mark first shot of session as cold bore
- [ ] Auto-detect cold bore based on time since last shot (> 10 minutes)

##### Cold-Bore Analysis
- [ ] Query DOPE logs WHERE coldBoreShot = true
- [ ] Calculate warm bore reference elevation (mean of shots 2-5)
- [ ] Calculate cold bore bias: `mean(coldBoreElevation - warmBoreElevation)`
- [ ] Calculate cold bore windage bias: `mean(coldBoreWind - warmBoreWind)`
- [ ] Store cold bore bias per rifle+ammo combination

##### UI Display
- [ ] Show cold bore bias banner in range mode: "Expected cold-bore shift: −0.15 MIL elevation"
- [ ] Add cold bore indicator to ballistic solution
- [ ] Offer to apply cold bore correction automatically
- [ ] Track cold bore accuracy over time (did correction help?)

#### Heat Shift Modeling

##### Data Collection
- [ ] Track shot number in current range session
- [ ] Track time between shots
- [ ] Estimate barrel temperature state (cold/warm/hot)

##### Heat Shift Analysis
- [ ] Query DOPE logs for shots 1-20 in sessions
- [ ] Perform linear regression: `POI vs shotIndex`
- [ ] Calculate slope of POI drift
- [ ] Detect significant heat shift (slope > threshold)

##### Heat Shift Prediction
- [ ] Predict POI shift based on current shot number
- [ ] Apply heat shift correction to recommendations
- [ ] Show warning when heat shift detected: "Barrel heating, +0.2 MIL drift expected"

##### Testing
- [ ] Write unit tests for cold bore bias calculation
- [ ] Write unit tests for linear regression heat shift
- [ ] Simulate 20-shot string with known drift
- [ ] Test edge cases (insufficient data, no heat shift)

---

### Confidence Weighting System

#### Confidence Score Calculation
- [ ] Combine factors: # of matching DOPE entries, environmental similarity, recency, group quality, solver agreement
- [ ] Normalize confidence to 0-1 scale
- [ ] Convert to 5-star rating (★☆☆☆ to ★★★★★)
- [ ] Store confidence with each recommendation

#### Confidence Display
- [ ] Show star rating in range session mode
- [ ] Show confidence percentage in calculator
- [ ] Color-code confidence (red < 40%, yellow 40-70%, green > 70%)
- [ ] Add confidence tooltip explaining factors

#### Low Confidence Handling
- [ ] Detect confidence < 40%
- [ ] Show prompt: "Limited historical data. Using solver-heavy prediction."
- [ ] Suggest practicing at this distance to build DOPE
- [ ] Reduce α (blend more solver, less DOPE)

#### High Confidence Display
- [ ] Detect confidence > 80%
- [ ] Show prompt: "High confidence prediction based on N historical shots"
- [ ] Display contributing DOPE entries
- [ ] Show environmental similarity scores

#### Testing
- [ ] Write unit tests for confidence calculation
- [ ] Test confidence with varying amounts of DOPE
- [ ] Test confidence with perfect vs poor environmental matches
- [ ] Test confidence edge cases (zero DOPE, 100 matching logs)

---

### Range Session Mode Implementation

#### Flow Integration
- [ ] Integrate DOPE matching into existing range session flow
- [ ] After user selects rifle + ammo, query DOPE system
- [ ] After environment capture, calculate ΔDA adjustments
- [ ] After solver computes prediction, apply DOPE offsets
- [ ] Display hybrid recommendation to user

#### Hybrid Solution Display
- [ ] Design recommendation card showing:
  - Elevation correction (bold, large font)
  - Windage correction (bold, large font)
  - Confidence rating (stars)
  - Notes section (cold bore shift, DA adjustment, DOPE source)
- [ ] Add expandable details showing:
  - Raw solver prediction
  - DOPE offset applied
  - Environmental adjustments
  - Contributing DOPE logs (count, distances)

#### Real-Time Recalculation
- [ ] After each shot logged, update DOPE database
- [ ] Immediately recalculate recommendation for next shot
- [ ] Show "Updated based on last shot" indicator
- [ ] Animate recommendation changes

#### Solver-Only Toggle
- [ ] Add toggle: "Use DOPE adjustments" (on by default)
- [ ] When off, show only raw solver predictions
- [ ] Allow side-by-side comparison (solver vs DOPE-adjusted)

#### Notes Section
- [ ] Display: "Historically 0.3 MIL flatter at this DA"
- [ ] Display: "Cold-bore shift ~0.2 MIL low"
- [ ] Display: "Based on 5 logs from similar conditions"
- [ ] Display: "No historical data, using solver only"

#### Testing
- [ ] Test full flow with mock DOPE database
- [ ] Test with zero DOPE (solver-only fallback)
- [ ] Test with abundant DOPE (high confidence)
- [ ] Test real-time updates after shot logging

---

### APIs & Module Interfaces

#### Ballistic Engine API
- [ ] Define `BallisticSolution` type (elevation, windage, TOF, velocity, energy)
- [ ] Implement `getLongRangeSolution(profile, ammo, env, distance, angle): BallisticSolution`
- [ ] Add batch prediction: `getBatchSolutions(profile, ammo, env, distances[]): BallisticSolution[]`
- [ ] Add ΔDA support: `getSolutionAtDA(profile, ammo, DA, distance, angle): BallisticSolution`

#### DOPE Adjustment API
- [ ] Define `DOPEAdjustmentRequest` type
- [ ] Define `AdjustedSolution` type (includes confidence, notes, breakdown)
- [ ] Implement `getDOPEAdjustedSolution(request): AdjustedSolution`
- [ ] Add debug mode: `getDOPEAdjustedSolutionDetailed(request): DetailedSolution`
  - Returns: all matching DOPE, scores, offsets, steps

#### Barrel State API
- [ ] Define `BiasVector` type (elevationBias, windageBias, confidence)
- [ ] Implement `getColdBoreBias(rifleId, ammoId): BiasVector`
- [ ] Define `ShiftModel` type (slope, intercept, r-squared)
- [ ] Implement `getHeatShiftTrend(rifleId, ammoId): ShiftModel`
- [ ] Implement `predictHeatShift(rifleId, ammoId, shotNumber): number`

#### Configuration API
- [ ] Define `DOPEConfig` type (weights, alpha, delta, thresholds)
- [ ] Implement `getDOPEConfig(): DOPEConfig`
- [ ] Implement `updateDOPEConfig(config: Partial<DOPEConfig>): void`
- [ ] Store config in AppSettings table
- [ ] Provide sensible defaults

#### Testing
- [ ] Write integration tests for API contracts
- [ ] Mock ballistic solver for DOPE API tests
- [ ] Test error handling (null parameters, invalid IDs)
- [ ] Document all APIs with JSDoc/TSDoc

---

### DOPE System Testing

#### Unit Tests
- [ ] Test DOPE matching query builder (50+ tests)
- [ ] Test relevance scoring (100+ tests covering all factors)
- [ ] Test Gaussian falloff function (10 tests)
- [ ] Test environmental similarity (30 tests)
- [ ] Test offset calculations (40 tests)
- [ ] Test cubic spline interpolation (30 tests)
- [ ] Test linear interpolation (20 tests)
- [ ] Test blending algorithm (25 tests)
- [ ] Test DA calculations (20 tests)
- [ ] Test wind normalization and scaling (40 tests)
- [ ] Test cold bore bias calculation (25 tests)
- [ ] Test heat shift linear regression (30 tests)
- [ ] Test confidence scoring (35 tests)

#### Integration Tests
- [ ] Test end-to-end DOPE adjustment flow
- [ ] Test with zero DOPE (solver-only fallback)
- [ ] Test with single DOPE entry
- [ ] Test with 100+ DOPE entries
- [ ] Test with perfect environmental match
- [ ] Test with extreme environmental differences
- [ ] Test cold bore flow
- [ ] Test multi-shot heat shift flow
- [ ] Test real-time recalculation after shot logging

#### Validation Tests
- [ ] Compare DOPE adjustments to real-world shooting data
- [ ] Validate against published ballistic tables
- [ ] Test with known rifle/ammo combinations (e.g., .308 168gr @ 100-1000yd)
- [ ] Verify DA adjustments match atmospheric models
- [ ] Validate wind scaling against verified data

#### Performance Tests
- [ ] Measure DOPE query performance with 1000+ logs
- [ ] Measure relevance scoring performance (should be < 100ms)
- [ ] Measure interpolation performance
- [ ] Measure end-to-end recommendation calculation time (target: < 200ms)
- [ ] Profile and optimize hot paths

#### UI/UX Tests
- [ ] Test confidence display rendering
- [ ] Test notes section rendering
- [ ] Test solver vs DOPE comparison view
- [ ] Test real-time update animations
- [ ] Test with mock data in various conditions

---

### DOPE System Configuration & Settings

#### User Settings
- [ ] Add DOPE settings screen
- [ ] Add distance delta (Δ) slider (25-100 yards)
- [ ] Add alpha (α) blending slider (0-1, default 0.7)
- [ ] Add relevance weight configuration (advanced)
- [ ] Add toggle: "Enable DOPE adjustments" (default on)
- [ ] Add toggle: "Enable cold bore detection" (default on)
- [ ] Add toggle: "Enable heat shift modeling" (default on)
- [ ] Add confidence threshold slider (minimum confidence to show DOPE)

#### Advanced Configuration
- [ ] Add weight editor for relevance scoring
- [ ] Add sigma parameter for Gaussian falloff
- [ ] Add recency half-life parameter
- [ ] Add barrel state detection thresholds
- [ ] Add "Reset to defaults" button

#### Presets
- [ ] Create "Aggressive" preset (high α, favor DOPE heavily)
- [ ] Create "Balanced" preset (default, α=0.7)
- [ ] Create "Conservative" preset (low α, favor solver)
- [ ] Create "Competition" preset (optimized for match shooting)

---

### Documentation for DOPE System

#### User Documentation
- [ ] Write user guide: "Understanding DOPE-Assisted Aiming"
- [ ] Explain confidence ratings
- [ ] Explain when to trust DOPE vs solver
- [ ] Explain cold bore and heat shift
- [ ] Create tutorial video/walkthrough

#### Developer Documentation
- [ ] Document DOPE matching algorithm in detail
- [ ] Document relevance scoring formulas
- [ ] Document interpolation methods
- [ ] Document environmental adjustment equations
- [ ] Create architecture diagram for DOPE system
- [ ] Add inline code documentation (TSDoc)

---

## Phase 2 Features

### External Device Integration
- [ ] Research Kestrel weather meter Bluetooth API
- [ ] Implement Kestrel device discovery
- [ ] Implement Kestrel data import (temp, pressure, humidity, wind)
- [ ] Research chronograph Bluetooth protocols
- [ ] Implement chronograph device discovery
- [ ] Implement chronograph shot string import
- [ ] Add device pairing management screen
- [ ] Handle device connection errors gracefully

### Advanced Ballistics
- [ ] Enable spin drift in ballistic solver
- [ ] Enable Coriolis effect in ballistic solver
- [ ] Add latitude input for Coriolis calculation
- [ ] Add toggle for advanced ballistics in settings
- [ ] Display advanced corrections separately in calculator
- [ ] Validate advanced corrections with published data

### Cloud Sync
- [ ] Choose cloud sync architecture (iCloud/Google Drive/custom backend)
- [ ] Implement iCloud sync for iOS
- [ ] Implement Google Drive sync for Android
- [ ] Implement conflict resolution strategy
- [ ] Add sync status indicators
- [ ] Add manual sync trigger
- [ ] Implement sync settings (auto/manual, sync interval)
- [ ] Test sync across multiple devices
- [ ] Implement end-to-end encryption for cloud data

### Wallet Pass DOPE Cards
- [ ] Research Apple Wallet pass format
- [ ] Create Wallet pass template for DOPE card
- [ ] Implement pass generation
- [ ] Research Google Wallet pass format
- [ ] Create Google Wallet pass template
- [ ] Implement pass generation for Android
- [ ] Test passes on devices

---

## Phase 3 Features

### Team Sharing
- [ ] Design team/group data structure
- [ ] Implement team creation
- [ ] Implement team member invitations
- [ ] Implement shared DOPE logs
- [ ] Implement shared rifle/ammo profiles
- [ ] Add team leaderboard
- [ ] Add commenting on shared logs

### Match Mode
- [ ] Design match tracking data structure
- [ ] Implement match creation
- [ ] Implement stage tracking
- [ ] Implement score entry
- [ ] Add time tracking for stages
- [ ] Generate match reports
- [ ] Export match results

### AR Shot Spotting
- [ ] Research AR frameworks (ARKit/ARCore)
- [ ] Implement AR camera view
- [ ] Implement target detection
- [ ] Overlay ballistic data on live view
- [ ] Implement digital spotting scope
- [ ] Add range finding via AR

### AI Shot Group Detection
- [ ] Research ML model for shot detection in images
- [ ] Train or acquire shot detection model
- [ ] Implement image preprocessing
- [ ] Implement shot detection
- [ ] Auto-calculate group size from detected shots
- [ ] Validate detection accuracy

---

## Ongoing Maintenance

### Bug Fixes & Updates
- [ ] Set up crash reporting (Sentry, Firebase Crashlytics)
- [ ] Monitor crash reports
- [ ] Triage and fix critical bugs
- [ ] Release patch updates
- [ ] Monitor user reviews
- [ ] Respond to user feedback

### Performance Monitoring
- [ ] Set up performance monitoring
- [ ] Track key metrics (launch time, calculation speed)
- [ ] Identify and fix performance regressions
- [ ] Optimize battery usage

### Compatibility Updates
- [ ] Test with new iOS versions
- [ ] Test with new Android versions
- [ ] Update dependencies
- [ ] Fix deprecation warnings
- [ ] Maintain compatibility with latest 2 OS versions
## Utilities

### Core Utilities
- [x] Unit conversion utilities (29 tests passing)
  - Distance conversions (yards/meters, feet/meters)
  - Velocity conversions (fps/mps)
  - Angular conversions (MIL/MOA)
  - Temperature conversions (F/C)
  - Pressure conversions (inHg/mbar)
  - Weight conversions (grains/grams)
- [x] Validation utilities (57 tests passing)
  - Distance, velocity, BC, bullet weight validation
  - Environmental data validation (temp, humidity, pressure, altitude, wind)
  - Rifle configuration validation (barrel length, zero distance, scope height, click value)
  - Geo-coordinate validation (latitude, longitude)
- [x] Formatting utilities (33 tests passing)
  - Number, distance, velocity, angular formatting
  - Environmental data formatting (temperature, pressure, humidity, wind)
  - Date/time formatting
  - Group size formatting

**Total: 119 unit tests passing with TDD methodology**

---


## State Management

### Zustand Stores
- [x] App store (settings, theme, initialization state)
- [x] Rifle store (rifle profiles, selected rifle)
- [x] Ammo store (ammo profiles, selected ammo)
- [x] DOPE store (DOPE logs, filtering)

### App Initialization
- [x] Database initialization on app start
- [x] Migration runner integration
- [x] Loading state handling
- [x] Error state handling

---
