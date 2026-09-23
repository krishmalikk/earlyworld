import type { ExpoConfig } from 'expo/config';
const config: ExpoConfig = {
  name: 'earlyworld',
  slug: 'earlyworld',
  version: '0.1.0',
  scheme: 'earlyworld',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  ios: {
    bundleIdentifier: process.env.IOS_BUNDLE_ID || 'com.earlyworld.app',
    googleServicesFile: process.env.GOOGLE_SERVICES_PLIST || './GoogleService-Info.plist',
    supportsTablet: false,
  },
  android: {
    package: process.env.ANDROID_PACKAGE || 'com.earlyworld.app',
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
  },
  plugins: [
    'expo-status-bar',
    'expo-font',
    'expo-router',
    'expo-dev-client',
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    '@react-native-firebase/crashlytics',
    ['@react-native-firebase/analytics', { ios: { withoutAdIdSupport: true } }],
    ['expo-build-properties', { ios: { useFrameworks: 'static' } }],
    ['expo-image-picker', { photosPermission: 'Choose your earlyworld profile photo.' }],
  ],
  extra: process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {},
};
export default config;
