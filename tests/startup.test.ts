import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldPromptEmail, startupRedirect } from '../shared/startup';

test('signed-out visitors can open welcome and auth but not account screens', () => {
  const state = { signedIn: false, onboardingComplete: false };
  for (const group of [undefined, 'index', 'auth', 'community'])
    assert.equal(startupRedirect({ ...state, group }), null);
  for (const group of ['(tabs)', 'track', 'onboarding', 'settings'])
    assert.equal(startupRedirect({ ...state, group }), '/');
});

test('returning users skip welcome and keep their signed-in deep links', () => {
  const state = { signedIn: true, onboardingComplete: true };
  for (const group of [undefined, 'index', 'auth', 'onboarding'])
    assert.equal(startupRedirect({ ...state, group }), '/(tabs)');
  for (const group of ['(tabs)', 'track', 'entity', 'user', 'release', 'settings', 'community'])
    assert.equal(startupRedirect({ ...state, group }), null);
});

test('incomplete accounts resume onboarding instead of seeing welcome again', () => {
  const state = { signedIn: true, onboardingComplete: false };
  for (const group of [undefined, 'index', 'auth', '(tabs)'])
    assert.equal(startupRedirect({ ...state, group }), '/onboarding');
  assert.equal(startupRedirect({ ...state, group: 'onboarding' }), null);
  assert.equal(startupRedirect({ ...state, group: 'community' }), null);
  for (const group of ['settings', 'post', 'user'])
    assert.equal(startupRedirect({ ...state, group }), '/onboarding');
});

test('only new unverified password accounts see the email prompt, once', () => {
  const state = { step: 1, providers: ['password'], emailVerified: false, dismissed: false };
  assert.equal(shouldPromptEmail(state), true);
  assert.equal(shouldPromptEmail({ ...state, emailVerified: true }), false);
  assert.equal(shouldPromptEmail({ ...state, dismissed: true }), false);
  assert.equal(shouldPromptEmail({ ...state, step: 2 }), false);
  for (const provider of ['google.com', 'apple.com'])
    assert.equal(shouldPromptEmail({ ...state, providers: [provider] }), false);
});
