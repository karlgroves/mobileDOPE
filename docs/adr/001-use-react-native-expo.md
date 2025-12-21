# ADR-001: Use React Native with Expo

**Status:** Accepted

**Date:** 2024-01-15

## Context

The Mobile DOPE app needs to run on both iOS and Android platforms. We evaluated several options for cross-platform development:

1. **Native Development** (Swift/Kotlin) - Separate codebases for each platform
2. **Flutter** - Dart-based cross-platform framework
3. **React Native** - JavaScript/TypeScript cross-platform framework
4. **React Native with Expo** - React Native with managed workflow and tooling

Key requirements:
- Cross-platform development (iOS and Android)
- TypeScript support for type safety
- Fast development iteration
- Access to device sensors (GPS, barometer, accelerometer)
- Offline-first capability
- Good performance for real-time calculations
- Strong ecosystem and community support

## Decision

We will use **React Native with Expo** as our development platform.

### Why React Native?

- Strong TypeScript support with excellent type definitions
- Large ecosystem of libraries and components
- Proven performance for mobile applications
- Direct access to native APIs when needed
- JavaScript/TypeScript skills are widely available
- Extensive documentation and community support

### Why Expo?

- Managed workflow simplifies build and deployment
- Built-in access to common device APIs (camera, location, sensors)
- Over-the-air updates capability
- EAS (Expo Application Services) for builds and submissions
- Excellent development experience with hot reload
- Can eject to bare React Native if needed

### Alternatives Considered

**Flutter:**
- Pros: Excellent performance, beautiful UI framework, hot reload
- Cons: Dart language has smaller talent pool, newer ecosystem
- Decision: React Native's ecosystem and TypeScript support were preferred

**Native Development:**
- Pros: Best performance, full platform control
- Cons: Two codebases to maintain, slower development
- Decision: Cross-platform benefits outweighed performance gains

## Consequences

### Positive

- **Single Codebase:** 95%+ code sharing between iOS and Android
- **Rapid Development:** Hot reload and managed workflow accelerate development
- **TypeScript:** Strong typing reduces bugs and improves maintainability
- **Rich Ecosystem:** Access to thousands of npm packages
- **Sensor Access:** Expo provides unified APIs for GPS, barometer, accelerometer
- **Offline Support:** React Native works well for offline-first apps
- **EAS Integration:** Simplified build, submit, and update workflows

### Negative

- **Bundle Size:** Larger app size compared to native (mitigated with Hermes)
- **Native Module Complexity:** Some native features require custom modules
- **Expo Limitations:** Some platform features require ejecting or expo-dev-client
- **Performance:** Slightly slower than pure native for intensive operations

### Risks

- **Breaking Changes:** React Native and Expo update frequently
- **Native Dependencies:** Complex native modules may be harder to integrate
- **Ballistic Performance:** Calculations may need optimization or native module

### Mitigation

- Pin dependency versions to avoid breaking changes
- Use expo-dev-client for custom native code without ejecting
- Implement ballistic calculations in TypeScript first, optimize to native if needed
- Regular performance profiling during development

## Implementation Notes

### Key Dependencies

- `expo` - Managed workflow and SDK
- `react-native` - Core framework
- `typescript` - Type safety
- `expo-sqlite` - Local database
- `expo-location` - GPS and altitude
- `expo-sensors` - Barometer, accelerometer
- `expo-print` - PDF generation
- `expo-file-system` - File operations

### Build Configuration

Using EAS Build with three profiles:
- **Development:** Internal testing with dev client
- **Staging:** Beta testing builds
- **Production:** App store releases

### Future Considerations

If performance becomes an issue for ballistic calculations:
1. Optimize TypeScript implementation first
2. Use React Native's new architecture (Fabric, TurboModules)
3. Write critical paths as native modules (C++/Rust)
4. Consider WebAssembly for compute-intensive operations

## References

- [React Native Documentation](https://reactnative.dev/)
- [Expo Documentation](https://docs.expo.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
