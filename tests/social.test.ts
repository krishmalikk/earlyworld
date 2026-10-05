import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligibleAgeBand, normalizePost, assertSubmittable } from '../shared/social';
const post = { kind: 'post', text: ' hello ', scenes: ['plugg'], mediaIds: [], attachment: null };
test('posts validate text, supported scenes, attachment shape and bounded media', () => {
  assert.equal(normalizePost(post).text, 'hello');
  for (const invalid of [
    { ...post, text: 'x'.repeat(1001) },
    { ...post, scenes: ['bad'] },
    { ...post, mediaIds: ['x', 'x'] },
    { ...post, mediaIds: ['a', 'b', 'c', 'd', 'e'] },
    { ...post, attachment: { kind: 'track', id: 'a/b' } },
    { ...post, kind: 'video', mediaIds: ['a', 'b'] },
  ])
    assert.throws(() => normalizePost(invalid));
  assert.throws(() => assertSubmittable(normalizePost({ ...post, text: '' })));
  assert.doesNotThrow(() =>
    assertSubmittable(
      normalizePost({ ...post, text: '', attachment: { kind: 'artist', id: 'a' } }),
    ),
  );
});
test('age eligibility handles boundary values without storing a date of birth', () => {
  assert.equal(eligibleAgeBand(12), null);
  assert.equal(eligibleAgeBand(13), '13-17');
  assert.equal(eligibleAgeBand(18), '18+');
  assert.equal(eligibleAgeBand('13'), null);
  assert.equal(eligibleAgeBand(13.5), null);
});
