import test from 'node:test';
import assert from 'node:assert/strict';
import { describeError } from '../shared/errors';

const coded = (code: string, message: string) => Object.assign(new Error(message), { code });

test('expected provider failures read plainly and stay out of crash reports', () => {
  for (const code of ['auth/wrong-password', 'auth/invalid-credential', 'auth/user-not-found'])
    assert.deepEqual(describeError(coded(code, `[${code}] The supplied auth credential is bad`)), {
      message: 'That email or password is incorrect.',
      report: false,
    });
  for (const code of ['auth/network-request-failed', 'firestore/unavailable', 'NETWORK_ERROR']) {
    const result = describeError(coded(code, 'raw provider text'));
    assert.match(result.message, /offline/);
    assert.equal(result.report, false);
  }
});

test('server-written callable messages are kept; bare statuses are not shown', () => {
  for (const code of ['failed-precondition', 'functions/failed-precondition'])
    assert.deepEqual(describeError(coded(code, 'Finish onboarding first.')), {
      message: 'Finish onboarding first.',
      report: false,
    });
  assert.deepEqual(describeError(coded('unavailable', 'SoundCloud metadata is unavailable.')), {
    message: 'SoundCloud metadata is unavailable.',
    report: false,
  });
  assert.match(describeError(coded('functions/unavailable', 'UNAVAILABLE')).message, /offline/);
  assert.deepEqual(describeError(coded('internal', 'INTERNAL')), {
    message: 'Something went wrong. Try again.',
    report: true,
  });
});

test('misconfiguration and real bugs stay reported without showing raw text', () => {
  assert.equal(describeError(coded('firestore/permission-denied', 'raw')).report, true);
  assert.deepEqual(describeError(coded('auth/operation-not-allowed', '[x] raw')), {
    message: 'Something went wrong. Try again.',
    report: true,
  });
  assert.deepEqual(describeError(new TypeError('undefined is not a function')), {
    message: 'Something went wrong. Try again.',
    report: true,
  });
  assert.equal(describeError('thrown string').report, true);
  assert.equal(describeError(coded('DEVELOPER_ERROR', 'Sign-in misconfigured')).report, true);
});

test('app validation errors keep their wording and are not crashes', () => {
  assert.deepEqual(describeError(new Error('Choose photos under 15 MB.')), {
    message: 'Choose photos under 15 MB.',
    report: false,
  });
});
