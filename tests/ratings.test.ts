import { test } from 'node:test';
import assert from 'node:assert/strict';
import { averageRating, validHalfStars } from '../shared/ratings';
import { mergeFeedEntries } from '../shared/feed';
test('ratings accept all half-star steps and never present an unrated song as zero stars', () => {
  for (let i = 1; i <= 10; i++) assert.equal(validHalfStars(i), true);
  for (const value of [0, 11, 1.5, NaN, Infinity, '5', null])
    assert.equal(validHalfStars(value), false);
  assert.equal(averageRating(), null);
  assert.equal(averageRating(1, 1), '0.5');
  assert.equal(averageRating(3, 25), '4.2');
});
test('feed preserves two opinions on one song, stable edits, deduplication, and pagination', () => {
  const a = { key: 'rating:a', trackId: 'track', at: 3, review: 'First' };
  const b = { key: 'rating:b', trackId: 'track', at: 2, review: 'Second' };
  const release = { key: 'track:track', trackId: 'track', at: 4, review: '' };
  assert.deepEqual(
    mergeFeedEntries(
      [
        [a, b],
        [release, release],
      ],
      25,
    ).map((r) => r.key),
    ['track:track', 'rating:a', 'rating:b'],
  );
  assert.deepEqual(
    mergeFeedEntries([[{ ...a, review: 'Edited' }, b], [release]], 2).map((r) => r.key),
    ['track:track', 'rating:a'],
  );
  assert.deepEqual(
    mergeFeedEntries([[b], [release]], 25).map((r) => r.key),
    ['track:track', 'rating:b'],
  );
});

test('rating-only feed filters before pagination so older opinions remain reachable', () => {
  const release = { key: 'track:new', at: 50, rating: false };
  const first = { key: 'rating:a', at: 3, rating: true };
  const second = { key: 'rating:b', at: 2, rating: true };
  const streams = [[release], [first, second]];
  assert.deepEqual(
    mergeFeedEntries(streams, 1, (entry) => entry.rating),
    [first],
  );
  assert.deepEqual(
    mergeFeedEntries(streams, 2, (entry) => entry.rating),
    [first, second],
  );
  assert.deepEqual(
    mergeFeedEntries([[release]], 25, (entry) => entry.rating),
    [],
  );
  assert.deepEqual(mergeFeedEntries(streams, 1), [release]);
});
