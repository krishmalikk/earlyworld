import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
/** Only bounded operational measurements. Never pass text, identifiers, eligibility, or URLs. */
export function socialEvent(
  name: 'social_upload_complete' | 'social_upload_failed',
  value?: number,
) {
  void (async () => {
    try {
      await logEvent(
        getAnalytics(),
        name,
        value === undefined ? {} : { milliseconds: Math.max(0, Math.round(value)) },
      );
    } catch {
      /* Never interrupt the app for telemetry. */
    }
  })();
}
