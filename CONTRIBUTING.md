# Contributing to Mobile DOPE

Thank you for your interest in contributing to Mobile DOPE! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Git Flow Process](#git-flow-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Documentation](#documentation)
- [Issue Reporting](#issue-reporting)

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome constructive feedback
- Focus on what is best for the community
- Show empathy towards other contributors
- Respect differing viewpoints and experiences

### Unacceptable Behavior

- Harassment, trolling, or derogatory comments
- Publishing others' private information
- Professional misconduct
- Other conduct that could be considered inappropriate

## Getting Started

### Prerequisites

- **Node.js:** Version 18 or higher
- **npm:** Version 8 or higher
- **Git:** For version control
- **iOS Development** (optional):
  - macOS with Xcode 14+
  - iOS Simulator or physical device
- **Android Development** (optional):
  - Android Studio
  - Android emulator or physical device

### Initial Setup

1. **Fork the repository** on GitHub

2. **Clone your fork:**
   ```bash
   git clone git@github.com:YOUR_USERNAME/mobileDOPE.git
   cd mobileDOPE/app
   ```

3. **Add upstream remote:**
   ```bash
   git remote add upstream git@github.com:karlgroves/mobileDOPE.git
   ```

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Run the app:**
   ```bash
   npm start
   ```

6. **Run tests:**
   ```bash
   npm test
   ```

## Development Workflow

### 1. Choose an Issue

- Browse [open issues](https://github.com/karlgroves/mobileDOPE/issues)
- Look for issues labeled `good first issue` or `help wanted`
- Comment on the issue to indicate you're working on it
- Wait for maintainer approval before starting work

### 2. Create a Feature Branch

```bash
# Update your develop branch
git checkout develop
git pull upstream develop

# Create feature branch
git checkout -b feature/your-feature-name
```

### 3. Make Changes

- Write code following [Coding Standards](#coding-standards)
- Follow [Test-Driven Development](#test-driven-development)
- Update documentation as needed
- Test thoroughly on both iOS and Android (if possible)

### 4. Commit Changes

- Write clear, descriptive commit messages
- Follow [Commit Guidelines](#commit-guidelines)
- Keep commits focused and atomic

### 5. Push and Create PR

```bash
# Push to your fork
git push origin feature/your-feature-name

# Create Pull Request on GitHub
```

## Git Flow Process

This project uses **Git Flow** for branch management.

### Branch Structure

- **main** - Production releases only
- **develop** - Integration branch for features
- **feature/*** - Feature development branches
- **release/*** - Release preparation branches
- **hotfix/*** - Emergency fixes from main

### Creating Feature Branches

```bash
# Always branch from develop
git checkout develop
git pull upstream develop
git checkout -b feature/descriptive-name
```

### Feature Branch Naming

```bash
feature/rifle-profile-sorting      # New feature
feature/ballistic-calc-accuracy    # Enhancement
feature/dope-log-export-csv        # New capability
```

### Merging Features

Features are merged to `develop` via Pull Request:

1. Push feature branch to your fork
2. Open PR against `upstream/develop`
3. Wait for code review and approval
4. Maintainer will merge when ready

### Release Process (Maintainers Only)

```bash
# Create release branch from develop
git checkout -b release/1.0.0 develop

# Finalize version, test, fix bugs
# Update version in package.json, app.config.ts

# Merge to main and develop
git checkout main
git merge --no-ff release/1.0.0
git tag -a v1.0.0 -m "Release 1.0.0"

git checkout develop
git merge --no-ff release/1.0.0

# Delete release branch
git branch -d release/1.0.0
```

## Coding Standards

### TypeScript

- **Strict Mode:** Always enabled
- **No `any` types:** Use proper typing
- **Explicit return types:** For functions
- **Interface over type:** Prefer `interface` for object shapes

**Good:**
```typescript
interface RifleData {
  name: string;
  caliber: string;
  barrelLength: number;
}

function createRifle(data: RifleData): RifleProfile {
  return new RifleProfile(data);
}
```

**Bad:**
```typescript
function createRifle(data: any) {  // ❌ No any
  return new RifleProfile(data);
}
```

### Code Style

- **Indentation:** 2 spaces (enforced by Prettier)
- **Line Length:** 100 characters max
- **Quotes:** Single quotes for strings
- **Semicolons:** Required
- **Trailing Commas:** Use for multi-line arrays/objects

### Naming Conventions

```typescript
// Components: PascalCase
export const RifleProfileCard: React.FC<Props> = () => { ... };

// Functions: camelCase
function calculateElevation(distance: number): number { ... }

// Constants: SCREAMING_SNAKE_CASE
const MAX_DISTANCE_YARDS = 3000;

// Interfaces: PascalCase with descriptive names
interface BallisticSolution { ... }

// Files: Match export name
RifleProfileCard.tsx
calculateElevation.ts
```

### File Organization

```
src/
├── components/        # Reusable UI components
│   ├── Button.tsx
│   └── Card.tsx
├── screens/          # Screen components
│   ├── DashboardScreen.tsx
│   └── RifleListScreen.tsx
├── services/         # Business logic & external services
│   ├── ballistics/
│   └── database/
├── models/           # Data models
│   ├── RifleProfile.ts
│   └── AmmoProfile.ts
├── store/            # Zustand state stores
│   ├── useRifleStore.ts
│   └── useAmmoStore.ts
├── navigation/       # React Navigation setup
├── constants/        # Constants and configuration
└── utils/            # Utility functions
```

### Import Order

```typescript
// 1. React
import React, { useState, useEffect } from 'react';

// 2. React Native
import { View, Text, StyleSheet } from 'react-native';

// 3. External libraries
import { create } from 'zustand';

// 4. Internal modules (absolute imports)
import { RifleProfile } from '../models/RifleProfile';
import { useRifleStore } from '../store/useRifleStore';
import { Button } from '../components/Button';

// 5. Types
import type { RootStackScreenProps } from '../navigation/types';
```

## Testing Requirements

### Test-Driven Development (TDD)

**All new code must follow TDD:**

1. **Write test first** (RED)
2. **Write minimal code to pass** (GREEN)
3. **Refactor** while keeping tests green
4. **Repeat** for next requirement

See [ADR-006](./docs/adr/006-test-driven-development.md) for full TDD guidelines.

### Test Coverage Requirements

- **Ballistic calculations:** 100% coverage (critical)
- **Utilities:** >95% coverage
- **Business logic:** >90% coverage
- **UI components:** >70% coverage
- **Overall project:** >80% coverage

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode (development)
npm test -- --watch

# Run specific test file
npm test -- RifleProfile.test.ts

# Update snapshots
npm test -- -u
```

### Writing Tests

**Example:**

```typescript
// __tests__/unit/utils/conversions.test.ts
describe('yardsToMeters', () => {
  it('should convert yards to meters correctly', () => {
    expect(yardsToMeters(100)).toBeCloseTo(91.44, 2);
    expect(yardsToMeters(0)).toBe(0);
  });

  it('should handle negative values', () => {
    expect(yardsToMeters(-100)).toBeCloseTo(-91.44, 2);
  });
});
```

### Test Structure

```
__tests__/
├── unit/              # Unit tests (isolated functions)
│   ├── ballistics/
│   ├── utils/
│   └── models/
├── integration/       # Integration tests (database, APIs)
│   ├── database/
│   └── services/
└── components/        # Component tests (React)
    └── Button.test.tsx
```

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat:** New feature
- **fix:** Bug fix
- **docs:** Documentation changes
- **style:** Code style changes (formatting, no logic change)
- **refactor:** Code refactoring
- **test:** Adding or updating tests
- **chore:** Build process, dependencies, tooling

### Examples

**Good:**

```
feat(ballistics): add Coriolis effect calculation

Implement Coriolis effect for long-range shooting based on
latitude and hemisphere. Uses simplified model suitable for
ranges up to 2000 yards.

Closes #123
```

```
fix(dope-log): correct timestamp formatting in exports

Fix timezone offset issue causing incorrect timestamps in
exported CSV files. Now uses UTC consistently.

Fixes #456
```

```
docs(adr): create ADR for state management decision

Document decision to use Zustand over Redux, including
rationale, alternatives considered, and consequences.
```

**Bad:**

```
Fixed stuff                    # ❌ Not descriptive
Updated code                   # ❌ Too vague
WIP                           # ❌ Work in progress (shouldn't commit)
feat: everything working now   # ❌ Not specific
```

### Commit Best Practices

- **Atomic commits:** One logical change per commit
- **Complete commits:** Code compiles and tests pass
- **Descriptive:** Explain "why", not just "what"
- **Present tense:** "Add feature" not "Added feature"
- **No WIP commits:** Squash before PR

## Pull Request Process

### Before Creating PR

1. ✅ All tests pass locally
2. ✅ Code follows style guidelines
3. ✅ New tests written for new features
4. ✅ Documentation updated
5. ✅ Commits are clean and atomic
6. ✅ Rebased on latest develop

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issue
Closes #123

## Testing
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Tested on iOS
- [ ] Tested on Android

## Screenshots (if applicable)
[Add screenshots for UI changes]

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
```

### PR Review Process

1. **Automated Checks:**
   - CI/CD pipeline runs tests
   - Linting and type checking
   - Build verification

2. **Code Review:**
   - At least one maintainer approval required
   - Address all review comments
   - Make requested changes

3. **Merge:**
   - Maintainer merges when approved
   - Squash merge for cleaner history
   - Delete feature branch after merge

## Documentation

### Code Comments

**When to comment:**

```typescript
// ✅ Good: Explain WHY, not WHAT
// Use effective gravity approach for angled shots
// This accounts for reduced gravitational effect perpendicular to trajectory
const effectiveGravity = GRAVITY * Math.cos(angleRad);

// ❌ Bad: Obvious what it does
// Multiply gravity by cosine of angle
const effectiveGravity = GRAVITY * Math.cos(angleRad);
```

**Complex algorithms:**

```typescript
/**
 * Calculate ballistic trajectory using Runge-Kutta 4th order integration.
 *
 * RK4 provides excellent accuracy for point-mass trajectory simulation
 * with reasonable computational cost. Time step of 1ms balances accuracy
 * and performance for ranges up to 3000 yards.
 *
 * @param state - Current state (position, velocity)
 * @param dt - Time step in seconds (typically 0.001)
 * @param bc - Ballistic coefficient
 * @param dragModel - 'G1' or 'G7' drag model
 * @returns New state after time step
 */
function rk4Step(
  state: State,
  dt: number,
  bc: number,
  dragModel: 'G1' | 'G7'
): State {
  // ... implementation
}
```

### Documentation Updates

When making changes, update:

- **README.md** - If project setup changes
- **CLAUDE.md** - If architecture/workflow changes
- **API docs** - If public interfaces change
- **ADRs** - For significant architectural decisions
- **Comments** - For complex logic

## Issue Reporting

### Bug Reports

Use the bug report template and include:

- **Description:** Clear, concise description
- **Steps to Reproduce:** Numbered steps
- **Expected Behavior:** What should happen
- **Actual Behavior:** What actually happens
- **Environment:**
  - Device (iPhone 14, Pixel 7, etc.)
  - OS version (iOS 17, Android 13)
  - App version
- **Screenshots:** If applicable
- **Logs:** Error messages or stack traces

### Feature Requests

Use the feature request template and include:

- **Problem Statement:** What problem does this solve?
- **Proposed Solution:** How should it work?
- **Alternatives:** Other approaches considered
- **Use Case:** Who needs this and why?
- **Priority:** Nice-to-have or critical?

### Questions

For questions:

- Check existing documentation first
- Search closed issues
- Use Discussions instead of Issues
- Be specific and provide context

## Development Tips

### Hot Reload

```bash
# Start development server
npm start

# Shake device or press 'r' to reload
# Press 'm' for dev menu
```

### Debugging

```typescript
// Use console.log for quick debugging
console.log('Rifle:', rifle.name, 'BC:', rifle.bc);

// Use React DevTools
// Install: https://reactnative.dev/docs/debugging

// Use debugger
debugger;  // Breaks in debugger when reached
```

### Performance Profiling

```bash
# Profile bundle size
npx expo export --platform ios --dump-sourcemap
npx source-map-explorer www/bundles/*.js

# Profile React rendering
# Enable Profiler in React DevTools
```

### Database Inspection

```typescript
// src/services/database/DatabaseService.ts
async debugDatabase(): Promise<void> {
  const rifles = await db.getAllAsync('SELECT * FROM rifle_profiles');
  console.log('Rifles:', rifles);
}
```

## Resources

### Documentation

- [React Native Docs](https://reactnative.dev/)
- [Expo Docs](https://docs.expo.dev/)
- [TypeScript Docs](https://www.typescriptlang.org/)
- [Zustand Docs](https://github.com/pmndrs/zustand)

### Project Docs

- [Database Schema](./docs/DATABASE_SCHEMA.md)
- [Ballistic Algorithms](./docs/BALLISTIC_ALGORITHMS.md)
- [State Management](./docs/STATE_MANAGEMENT.md)
- [Architecture Decision Records](./docs/adr/)

### Communication

- **Issues:** Bug reports and feature requests
- **Pull Requests:** Code contributions
- **Discussions:** Questions and general discussion

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

## Questions?

If you have questions not covered here:

1. Check the [documentation](./docs/)
2. Search [existing issues](https://github.com/karlgroves/mobileDOPE/issues)
3. Open a new issue with the `question` label

Thank you for contributing to Mobile DOPE! 🎯
