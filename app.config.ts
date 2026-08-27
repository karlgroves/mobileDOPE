import { ExpoConfig, ConfigContext } from 'expo/config';

// Single source of truth for the user-facing version: `npm version` bumps
// package.json, and the app picks it up here automatically (see CHANGELOG.md).
import { version } from './package.json';

export default ({ config }: ConfigContext): ExpoConfig => {
  const env = process.env.APP_ENV || 'development';

  return {
    ...config,
    name: env === 'production' ? 'Mobile DOPE' : `Mobile DOPE (${env})`,
    slug: 'mobiledope',
    version,
    orientation: 'default',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#1a1a1a',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: env === 'production' ? 'com.mobiledope.app' : `com.mobiledope.app.${env}`,
      infoPlist: {
        // Required whenever `Location.requestForegroundPermissionsAsync()` is called.
        // Without it iOS terminates the app at the request and App Store review
        // rejects the build. See issue #44.
        //
        // The app asks for full accuracy because it reads *altitude* from the fix --
        // altitude drives the density-altitude term in the ballistic solution. The
        // horizontal position is deliberately discarded down to one decimal place
        // before anything is stored (src/utils/geoPrecision.ts).
        NSLocationWhenInUseUsageDescription:
          'Mobile DOPE uses your location to read altitude for density-altitude ' +
          'calculations and an approximate latitude for the Coriolis correction. ' +
          'Latitude is rounded to about 11 km before it is saved, longitude is never ' +
          'recorded, and everything stays on this device unless you export it yourself.',
      },
      // The app has no network layer, collects no identifiers and does no tracking.
      config: {
        usesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1a1a1a',
      },
      package: env === 'production' ? 'com.mobiledope.app' : `com.mobiledope.app.${env}`,
      // Declared explicitly rather than inherited from the autolinked modules, so the
      // manifest is auditable from this file alone. Only foreground location is
      // requested -- there is no background location use.
      // Fully qualified so they de-duplicate against the names the expo-location
      // plugin contributes; bare names would appear twice in the merged manifest.
      permissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
      blockedPermissions: [
        // expo-image-picker is a dependency but is not used anywhere in `src/`. Left
        // unblocked, autolinking would add CAMERA and media permissions that the app
        // never exercises -- a broader manifest than the app can justify.
        'android.permission.CAMERA',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_EXTERNAL_STORAGE',
        // No audio capture anywhere in the app.
        'android.permission.RECORD_AUDIO',
        // Drawing over other apps: contributed by autolinked modules, never used.
        'android.permission.SYSTEM_ALERT_WINDOW',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      env,
      isDevelopment: env === 'development',
      isStaging: env === 'staging',
      isProduction: env === 'production',
    },
    // expo-sharing became a required config plugin in SDK 55; `expo install --fix`
    // reports it as missing because this config is dynamic (app.config.ts) and cannot
    // be written automatically.
    //
    // expo-location carries the plugin form so the purpose string reaches both
    // platforms from one place. expo-document-picker needs no plugin or usage
    // description (UIDocumentPickerViewController is user-driven and grants access to
    // the chosen file only). expo-image-picker is deliberately absent: nothing in
    // `src/` uses it, and declaring camera/photo purpose strings for a capability the
    // app never invokes is both a review risk and an unearned permission.
    plugins: [
      'expo-sqlite',
      'expo-sharing',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Mobile DOPE uses your location to read altitude for density-altitude ' +
            'calculations and an approximate latitude for the Coriolis correction. ' +
            'Latitude is rounded to about 11 km before it is saved, longitude is ' +
            'never recorded, and everything stays on this device unless you export ' +
            'it yourself.',
          // The plugin seeds the "Always" variants unless they are explicitly
          // disabled. This app has no background location code path, so declaring
          // them would ask for access it never uses.
          locationAlwaysPermission: false,
          locationAlwaysAndWhenInUsePermission: false,
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false,
        },
      ],
      // Deletes the placeholder usage descriptions Expo's iOS template seeds for
      // camera, photo library, microphone, motion and background location -- none of
      // which this app has code to use. Must run last so it applies after the merge.
      './plugins/withTrimmedIosPermissions',
    ],
  };
};
