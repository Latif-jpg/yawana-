const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const plugins: (string | [string, Record<string, unknown>])[] = [
  'expo-router',
  'expo-dev-client',
  [
    'expo-location',
    {
      locationWhenInUsePermission:
        'Yawana utilise votre position pour detecter automatiquement votre zone et vous proposer des alertes locales pertinentes.',
      isAndroidBackgroundLocationEnabled: false,
    },
  ],
];

if (googleMapsApiKey) {
  plugins.push([
    'react-native-maps',
    {
      androidGoogleMapsApiKey: googleMapsApiKey,
      iosGoogleMapsApiKey: googleMapsApiKey,
    },
  ]);
}

export default {
  name: 'Yawana',
  slug: 'market-radar',
  version: '1.0.0',
  description: 'Suivi des prix sur les marches du Burkina Faso.',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#000000',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.marketradar.bf.app',
    ...(googleMapsApiKey
      ? {
          config: {
            googleMapsApiKey,
          },
        }
      : {}),
  },
  android: {
    package: 'com.marketradar.bf.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#000000',
    },
    ...(googleMapsApiKey
      ? {
          config: {
            googleMaps: {
              apiKey: googleMapsApiKey,
            },
          },
        }
      : {}),
  },
  web: {
    favicon: './assets/favicon.png',
  },
  scheme: 'marketradar',
  extra: {
    eas: {
      projectId: '6c0520c0-efda-4d97-9afd-2f56d987bffb',
    },
  },
  plugins,
};
