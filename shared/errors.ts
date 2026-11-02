const OFFLINE = 'You appear to be offline. Check your connection and try again.';
const GENERIC = 'Something went wrong. Try again.';
const BAD_LOGIN = 'That email or password is incorrect.';
/** Plain wording for provider codes. These are normal outcomes, so they are not crash reports. */
const expected: Record<string, string> = {
  'auth/invalid-credential': BAD_LOGIN,
  'auth/invalid-login-credentials': BAD_LOGIN,
  'auth/wrong-password': BAD_LOGIN,
  'auth/user-not-found': BAD_LOGIN,
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/email-already-in-use': 'That email already has an account. Sign in instead.',
  'auth/weak-password': 'Use a stronger password with at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': OFFLINE,
  'auth/user-disabled': 'This account has been disabled. Contact support for help.',
  'auth/requires-recent-login': 'Sign out and sign in again to continue.',
  'auth/account-exists-with-different-credential':
    'This email already has an earlyworld account. Sign in with your password or the method you used before.',
  'firestore/unavailable': OFFLINE,
  'firestore/deadline-exceeded': OFFLINE,
  'storage/canceled': 'Upload cancelled.',
  'storage/retry-limit-exceeded': OFFLINE,
  NETWORK_ERROR: OFFLINE,
};
/** Provider codes that point at a bug or misconfiguration, so they stay in crash reports. */
const reported: Record<string, string> = {
  'firestore/permission-denied': 'You don’t have access to that.',
  'storage/unauthorized': 'You don’t have access to that.',
  internal: GENERIC,
  unknown: GENERIC,
};
const transport = new Set(['unavailable', 'deadline-exceeded']);
const written = /[.!?]$/;

/** The message to show, and whether the error deserves a crash report. */
export function describeError(error: unknown): { message: string; report: boolean } {
  if (!(error instanceof Error)) return { message: GENERIC, report: true };
  const raw = String((error as { code?: unknown }).code ?? '');
  const code = raw.replace(/^functions\//, '');
  const message = error.message.replace(/^\[[^\]]+\]\s*/, '');
  if (expected[code]) return { message: expected[code], report: false };
  if (reported[code]) return { message: reported[code], report: true };
  // Our callables write their own sentences; a bare status means the request never finished.
  if (transport.has(code))
    return written.test(message) ? { message, report: false } : { message: OFFLINE, report: false };
  if (/^(auth|firestore|storage)\//.test(code)) return { message: GENERIC, report: true };
  if (code) return { message, report: !written.test(message) };
  // Plain Error is this app's own validation; anything else is a real bug.
  return error.name === 'Error' ? { message, report: false } : { message: GENERIC, report: true };
}
