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
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1a1a1a',
      },
      package: env === 'production' ? 'com.mobiledope.app' : `com.mobiledope.app.${env}`,
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
    plugins: ['expo-sqlite'],
  };
};
