import type { ExpoConfig } from 'expo/config';
// Keep aligned with colors.bg in shared/brand.ts; Expo config loads outside Metro.
const brandBackground = '#050710';
const config: ExpoConfig = {
  name: 'earlyworld',
  slug: 'earlyworld',
  version: '0.1.0',
  scheme: 'earlyworld',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  icon: './assets/brand/earlyworld-logo.png',
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
    [
      'expo-splash-screen',
      {
        // Expo 57 leaves stale storyboard constraints when image is omitted.
        // A transparent drawable keeps the native launch screen logo-free.
        image: './assets/brand/launch-blank.png',
        imageWidth: 1,
        backgroundColor: brandBackground,
      },
    ],
    'expo-status-bar',
    'expo-font',
    'expo-image',
    ['expo-video', { supportsBackgroundPlayback: false, supportsPictureInPicture: false }],
    'expo-router',
    'expo-dev-client',
    ['@react-native-firebase/app', { ios: { disableSPM: true } }],
    '@react-native-firebase/auth',
    '@react-native-firebase/crashlytics',
    ['@react-native-firebase/analytics', { ios: { withoutAdIdSupport: true } }],
    ['expo-build-properties', { ios: { useFrameworks: 'static' } }],
    ['expo-image-picker', { photosPermission: 'Choose photos and videos to share on earlyworld.' }],
  ],
  extra: process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {},
};
export default config;
