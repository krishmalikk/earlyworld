import { existsSync, readFileSync } from 'node:fs';
import type { ExpoConfig } from 'expo/config';
// Keep aligned with colors.bg in shared/brand.ts; Expo config loads outside Metro.
const brandBackground = '#050710';
const plistPath = process.env.GOOGLE_SERVICES_PLIST || './GoogleService-Info.plist';
// Google Sign-In's iOS callback scheme is the plist's REVERSED_CLIENT_ID; nothing is invented here.
const googleUrlScheme = existsSync(plistPath)
  ? readFileSync(plistPath, 'utf8').match(
      /<key>REVERSED_CLIENT_ID<\/key>\s*<string>([^<]+)<\/string>/,
    )?.[1]
  : undefined;
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
    googleServicesFile: plistPath,
    supportsTablet: false,
    usesAppleSignIn: true,
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
    'expo-router',
    'expo-dev-client',
    ['@react-native-firebase/app', { ios: { disableSPM: true } }],
    '@react-native-firebase/auth',
    '@react-native-firebase/crashlytics',
    ['@react-native-firebase/analytics', { ios: { withoutAdIdSupport: true } }],
    ['expo-build-properties', { ios: { useFrameworks: 'static' } }],
    // Share cards save with write-only access; expo-image-picker below keeps the library prompt copy.
    ['expo-media-library', { savePhotosPermission: 'Save your earlyworld share cards to Photos.' }],
    ['expo-image-picker', { photosPermission: 'Choose photos to share on earlyworld.' }],
    'expo-apple-authentication',
    ...(googleUrlScheme
      ? [
          ['@react-native-google-signin/google-signin', { iosUrlScheme: googleUrlScheme }] as [
            string,
            object,
          ],
        ]
      : []),
  ],
  // Cloud builds don't receive .env, and EAS needs this ID before it can load project variables.
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID || 'df812fe5-0560-46e5-afc9-eb63c5f41793' },
  },
};
export default config;
