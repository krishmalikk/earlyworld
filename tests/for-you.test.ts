import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postReason, ratingReason, releaseRatingReason, type Taste } from '../shared/for-you';

const taste: Taste = {
  uid: 'me',
  savedTracks: new Set(['saved', 'fav']),
  favoriteTracks: new Set(['fav']),
  favoriteReleases: new Set(['tape']),
  artists: new Map([['lucki', 'LUCKI']]),
  producers: new Map([['icey', 'Yung Icey']]),
  followedUsers: new Set(['friend']),
  scenes: new Set(['plugg']),
};
const review = { authorUid: 'stranger', hasReview: true };

test('track reviews surface for favorites, saves, artists and producers, most specific first', () => {
  assert.equal(
    ratingReason(taste, { ...review, trackId: 'fav' }),
    'Review of one of your favorite tracks',
  );
  assert.equal(ratingReason(taste, { ...review, trackId: 'saved' }), 'Review of a track you saved');
  assert.equal(
    ratingReason(taste, { ...review, trackId: 'other', artistId: 'lucki' }),
    'Review of LUCKI, who you listen to',
  );
  assert.equal(
    ratingReason(taste, { ...review, trackId: 'other', producerId: 'icey' }),
    'Review of a Yung Icey production',
  );
  assert.equal(ratingReason(taste, { ...review, trackId: 'other', artistId: 'nobody' }), null);
});

test('bare star ratings only come from people you follow, and your own never show', () => {
  assert.equal(
    ratingReason(taste, { authorUid: 'stranger', trackId: 'saved', hasReview: false }),
    null,
  );
  assert.equal(
    ratingReason(taste, { authorUid: 'friend', trackId: 'other', hasReview: false }),
    'From someone you follow',
  );
  assert.equal(ratingReason(taste, { authorUid: 'me', trackId: 'fav', hasReview: true }), null);
});

test('release reviews match favorite releases and saved artists', () => {
  assert.equal(
    releaseRatingReason(taste, { ...review, releaseId: 'tape' }),
    'Review of one of your favorite releases',
  );
  assert.equal(
    releaseRatingReason(taste, { ...review, releaseId: 'x', artistId: 'lucki' }),
    'Review of a LUCKI release',
  );
  assert.equal(releaseRatingReason(taste, { ...review, releaseId: 'x' }), null);
});

test('posts surface by mention, then follow, then shared scene', () => {
  const post = { authorUid: 'stranger', scenes: [] as string[] };
  assert.equal(
    postReason(taste, { ...post, attachment: { kind: 'artist', id: 'lucki', label: 'LUCKI' } }),
    'Mentions LUCKI, who you listen to',
  );
  assert.equal(
    postReason(taste, {
      ...post,
      attachment: { kind: 'track', id: 'new', label: 'Purple Heart Ski' },
      attachedArtistId: 'lucki',
    }),
    'Mentions Purple Heart Ski by LUCKI, who you listen to',
  );
  assert.equal(
    postReason(taste, { ...post, attachment: { kind: 'track', id: 'saved', label: 'intro' } }),
    'Mentions intro, a track you saved',
  );
  assert.equal(
    postReason(taste, { authorUid: 'friend', scenes: [], attachment: null }),
    'From someone you follow',
  );
  assert.equal(
    postReason(taste, { ...post, scenes: ['rage', 'plugg'], attachment: null }),
    'From the plugg scene',
  );
  assert.equal(postReason(taste, { ...post, scenes: ['rage'], attachment: null }), null);
});
