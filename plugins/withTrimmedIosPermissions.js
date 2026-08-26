// Expo loads config plugins through Node's `require` during `prebuild`, before any
// bundler is involved, so this file must be CommonJS. ESM here fails to load.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withInfoPlist } = require('expo/config-plugins');

/**
 * Remove iOS usage descriptions for capabilities this app has no code to use.
 *
 * Expo's bare iOS template seeds placeholder strings -- "Allow $(PRODUCT_NAME) to
 * access your camera" -- for camera, photo library, microphone, motion and
 * background location. `prebuild` merges that template with `app.config.ts`, and a
 * key set to `false` in `ios.infoPlist` is dropped rather than deleted, so the
 * placeholders survive into the built app.
 *
 * A shipped Info.plist that advertises capabilities the binary never invokes is
 * both a review question and a promise the app cannot keep. This deletes them
 * after the merge, which is the only point at which they exist.
 *
 * `NSLocationWhenInUseUsageDescription` is deliberately NOT in this list -- it is
 * the one permission the app genuinely uses, and its string is set in
 * `app.config.ts`. See issue #44.
 *
 * @param {import('expo/config').ExpoConfig} config
 * @returns {import('expo/config').ExpoConfig}
 */
const withTrimmedIosPermissions = (config) =>
  withInfoPlist(config, (modConfig) => {
    const unearned = [
      // Foreground location only: there is no background location code path.
      'NSLocationAlwaysUsageDescription',
      'NSLocationAlwaysAndWhenInUseUsageDescription',
      // expo-image-picker is an unused dependency; nothing in src/ opens a camera
      // or the photo library.
      'NSCameraUsageDescription',
      'NSPhotoLibraryUsageDescription',
      'NSPhotoLibraryAddUsageDescription',
      // No audio capture anywhere in the app.
      'NSMicrophoneUsageDescription',
      // expo-sensors is a dependency but no sensor is read.
      'NSMotionUsageDescription',
    ];

    for (const key of unearned) {
      delete modConfig.modResults[key];
    }

    return modConfig;
  });

module.exports = withTrimmedIosPermissions;
