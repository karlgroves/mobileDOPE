import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const env = process.env.APP_ENV || 'development';

  return {
    ...config,
    name: env === 'production' ? 'Mobile DOPE' : `Mobile DOPE (${env})`,
    slug: 'mobiledope',
    version: '1.0.0',
    orientation: 'portrait',
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
      bundleIdentifier:
        env === 'production'
          ? 'com.mobiledope.app'
          : `com.mobiledope.app.${env}`,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1a1a1a',
      },
      package:
        env === 'production'
          ? 'com.mobiledope.app'
          : `com.mobiledope.app.${env}`,
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
  };
};
