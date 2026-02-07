# MobileDOPE App

React Native mobile application for the DOPE (motorsports/racing) platform, built with Expo.

## Tech Stack

- React Native with Expo
- TypeScript
- SQLite (local database with migrations)
- React Navigation
- TanStack React Query for data fetching
- Zustand for state management
- React Native Gesture Handler
- AsyncStorage for settings persistence

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI
- iOS Simulator (macOS) or Android Emulator

### Installation

```bash
npm install
```

### Development

```bash
npx expo start
```

## Project Structure

```
src/
├── components/     # Reusable UI components
├── constants/      # Theme and configuration constants
├── contexts/       # React Context providers (Theme)
├── db/             # SQLite database and migrations
├── navigation/     # React Navigation setup
├── services/       # Analytics, database, queue processing
├── state/          # Zustand store, React Query, preferences
└── utils/          # Device info and utility functions
```

## Features

- Local SQLite database with migration runner
- Theme support (light, dark, night vision modes)
- Deep linking support (`mobiledope://`)
- Offline queue processing
- Analytics integration
- Error boundary handling
