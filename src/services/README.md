# Services

This directory contains business logic and service modules.

## Planned Services

- **database/** - SQLite database operations
  - `DatabaseService.ts` - Database initialization and connection
  - `RifleProfileRepository.ts` - Rifle profile CRUD operations
  - `AmmoProfileRepository.ts` - Ammo profile CRUD operations
  - `DOPELogRepository.ts` - DOPE log CRUD operations
  - `EnvironmentRepository.ts` - Environment snapshot operations
  - `migrations/` - Database migration files

- **ballistics/** - Ballistic calculation engine
  - `BallisticEngine.ts` - Main ballistic solver
  - `AtmosphericModel.ts` - Atmospheric calculations
  - `DragModels.ts` - G1/G7 drag models
  - `TrajectoryCalculator.ts` - Trajectory calculations
  - `WindTable.ts` - Wind correction tables

- **sensors/** - Device sensor integration
  - `SensorService.ts` - Access device sensors
  - `LocationService.ts` - GPS and altitude
  - `BarometerService.ts` - Barometric pressure

- **export/** - Data export functionality
  - `PDFExportService.ts` - PDF generation
  - `CSVExportService.ts` - CSV export
  - `JSONExportService.ts` - JSON import/export
