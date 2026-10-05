import test from 'node:test';
import assert from 'node:assert/strict';
import { artworkSources } from '../shared/artwork';

test('small Retina covers use 500px; large covers try 1080px then 500px then original', () => {
  const uri = 'https://i1.sndcdn.com/artworks-track-id-large.jpg';
  assert.deepEqual(artworkSources(uri, 52 * 3), [uri.replace('large', 't500x500'), uri]);
  assert.deepEqual(artworkSources(uri, 300 * 3), [
    uri.replace('large', 't1080x1080'),
    uri.replace('large', 't500x500'),
    uri,
  ]);
});

test('artwork resolution preserves image format and avoids duplicate fallback requests', () => {
  const uri = 'https://i2.sndcdn.com/avatars-producer-t500x500.png';
  assert.deepEqual(artworkSources(uri, 276), [uri]);
  assert.deepEqual(artworkSources(uri, 700), [uri.replace('t500x500', 't1080x1080'), uri]);
});

test('other providers, signed URLs, unknown paths, and original assets remain untouched', () => {
  for (const uri of [
    'https://images.genius.com/cover-large.jpg',
    'https://i1.sndcdn.com.evil.example/artworks-test-large.jpg',
    'https://i1.sndcdn.com/artworks-test-large.jpg?signature=abc',
    'https://i1.sndcdn.com/artworks-test-original.jpg',
    'https://i1.sndcdn.com/other-large.jpg',
    'file:///local-cover.png',
    'invalid',
  ])
    assert.deepEqual(artworkSources(uri, 900), [uri]);
  assert.deepEqual(artworkSources(null, 900), []);
  assert.deepEqual(artworkSources('', 900), []);
});
