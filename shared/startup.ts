/** Only new password accounts need the prompt; Google and Apple confirm the address themselves. */
export function shouldPromptEmail({
  step,
  providers,
  emailVerified,
  dismissed,
}: {
  step: number;
  providers: string[];
  emailVerified: boolean;
  dismissed: boolean;
}) {
  return step === 1 && providers.includes('password') && !emailVerified && !dismissed;
}
/** Keep the welcome screen public without interrupting an existing session or deep link. */
export function startupRedirect({
  signedIn,
  onboardingComplete,
  group,
}: {
  signedIn: boolean;
  onboardingComplete: boolean;
  group?: string;
}): '/' | '/onboarding' | '/(tabs)' | null {
  const landing = !group || group === 'index';
  if (!signedIn) return landing || group === 'auth' || group === 'community' ? null : '/';
  if (!onboardingComplete)
    return group === 'onboarding' || group === 'community' ? null : '/onboarding';
  return landing || group === 'auth' || group === 'onboarding' ? '/(tabs)' : null;
}
