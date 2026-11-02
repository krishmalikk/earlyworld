import test from 'node:test';
import assert from 'node:assert/strict';
import { RecentCache } from '../src/data/recent-cache';

test('the cache evicts the least recently used entry and clears on demand', () => {
  const cache = new RecentCache<number>(2);
  cache.set('a', 1);
  cache.set('b', 2);
  assert.equal(cache.get('a'), 1);
  cache.set('c', 3);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a'), 1);
  cache.delete('a');
  assert.equal(cache.get('a'), undefined);
  cache.clear();
  assert.equal(cache.get('c'), undefined);
});
