import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextSavers,
  rotationScore,
  tierFor,
  isoWeek,
  matchScores,
  normalizeSource,
  similarity,
  cappedUnion,
} from '../shared/domain';
test('savers: 200th allowed, 201st permanently excludes track, retries cannot append duplicates', () => {
  let state = { savers: Array.from({ length: 199 }, (_, i) => `u${i}`), saversCapped: false };
  state = nextSavers(state.savers, state.saversCapped, 'u199');
  assert.equal(state.savers.length, 200);
  assert.equal(state.saversCapped, false);
  state = nextSavers(state.savers, state.saversCapped, 'u200');
  assert.equal(state.savers.length, 200);
  assert.equal(state.saversCapped, true);
  assert.equal(nextSavers(state.savers.slice(1), true, 'u201').savers.length, 199);
  assert.equal(nextSavers(['me'], false, 'me').append, false);
});
test('rotation multiplies dimensions, rewards depth and decays with 26 week half-life', () => {
  const now = new Date('2026-09-22T12:00:00Z');
  const weeks = [isoWeek(now)];
  assert.equal(rotationScore([2], [], now, now).score, 0);
  assert.equal(rotationScore([], weeks, now, now).score, 0);
  const fresh = rotationScore([2, 3, 4], weeks, now, now).score;
  assert.ok(fresh > rotationScore([200, 200, 200], weeks, now, now).score);
  assert.equal(
    rotationScore([2, 3, 4], weeks, new Date(+now - 26 * 7 * 86400000), now).score,
    fresh / 2,
  );
  assert.deepEqual([9, 10, 25, 60, 150].map(tierFor), [
    null,
    'gold',
    'platinum',
    'multiplatinum',
    'diamond',
  ]);
  assert.equal(isoWeek(new Date('2021-01-01')), '2020-W53');
  assert.equal(cappedUnion([1, 2], 3, 2).length, 2);
});
test('matching excludes capped tracks and self, favors rare overlaps', () => {
  const track = {
    id: 'a',
    title: 'A',
    artistName: 'artist',
    saveCount: 3,
    savers: ['me', 'rare'],
    saversCapped: false,
  };
  const matches = matchScores('me', [
    track,
    { ...track, id: 'b', saveCount: 199, savers: ['me', 'common'] },
    { ...track, id: 'c', savers: ['me', 'excluded'], saversCapped: true },
  ]);
  assert.deepEqual(
    matches.map((m) => m.uid),
    ['rare', 'common'],
  );
});
test('canonical URLs deduplicate platform aliases and reject unsafe hosts', () => {
  assert.equal(
    normalizeSource('https://youtu.be/abcdefghijk?t=15').url,
    normalizeSource('https://www.youtube.com/watch?v=abcdefghijk&list=x').url,
  );
  assert.equal(
    normalizeSource('https://soundcloud.com/a/b/?si=tracking').url,
    'https://soundcloud.com/a/b',
  );
  for (const url of [
    'file:///etc/passwd',
    'https://soundcloud.com.evil.com/a/b',
    'https://user:pass@soundcloud.com/a/b',
    'https://soundcloud.com/a/sets/x',
  ])
    assert.throws(() => normalizeSource(url));
  assert.equal(similarity('Song (feat. Other)', 'song'), 1);
  assert.ok(similarity('Xaviersobased', 'Xavier') < 0.85);
});
