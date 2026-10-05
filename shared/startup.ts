/** Keep the welcome screen public without interrupting an existing session or deep link. */
export function startupRedirect({
  signedIn,
  onboardingComplete,
  group,
}: {
  signedIn: boolean;
  onboardingComplete: boolean;
  group?: string;
}): '/' | '/onboarding' | '/(tabs)/matches' | null {
  const landing = !group || group === 'index';
  if (!signedIn) return landing || group === 'auth' || group === 'community' ? null : '/';
  if (!onboardingComplete) return group === 'onboarding' ? null : '/onboarding';
  return landing || group === 'auth' || group === 'onboarding' ? '/(tabs)/matches' : null;
}
