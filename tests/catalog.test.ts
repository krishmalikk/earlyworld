import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeSource } from '../shared/domain';
test('seed catalog has 200 unique published tracks, 40 artists, and sourced producer credits', () => {
  const catalog = JSON.parse(readFileSync('seed/catalog.json', 'utf8'));
  assert.equal(catalog.tracks.length, 200);
  assert.equal(catalog.artists.length, 40);
  assert.ok(catalog.producers.length >= 18);
  const artists = new Set(catalog.artists.map((a: any) => a.id)),
    producers = new Set(catalog.producers.map((p: any) => p.id));
  assert.equal(new Set(catalog.tracks.map((t: any) => normalizeSource(t.sourceUrl).url)).size, 200);
  for (const t of catalog.tracks) {
    assert.ok(artists.has(t.artistId));
    assert.ok(!t.producerId || producers.has(t.producerId));
    assert.ok(t.verifiedAt);
    assert.ok(t.durationSeconds > 0);
    assert.doesNotMatch(t.title, /\b(leaked|unreleased|snippet)\b/i);
    if (t.producerName) assert.ok(t.creditSource);
  }
});
