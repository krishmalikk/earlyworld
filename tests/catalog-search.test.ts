import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogIndex, searchGrams, searchNeedle, searchText } from '../shared/catalog-search';
test('search normalizes accents and punctuation and indexes every substring candidate', () => {
  const original = 'NÜNCA HACER COCAINA — Che / CXO';
  const grams = searchGrams(original),
    text = searchText(original);
  for (let start = 0; start < text.length; start++)
    for (let length = 1; length <= text.length - start; length++) {
      const part = text.slice(start, start + length).trim();
      if (part) assert.ok(grams.includes(searchNeedle(part)), part);
    }
  assert.equal(text, 'nunca hacer cocaina che cxo');
});
test('index includes editorial and shared producer credits, scenes and aliases without community content', () => {
  const indexed = catalogIndex(
    'tracks',
    {
      title: 'Song',
      artistName: 'Singer',
      producerName: 'Editorial',
      credits: { producers: ['Co-producer'] },
      review: 'private text',
      ratingCount: 7,
    },
    ['plugg'],
  );
  assert.deepEqual(indexed.producerNames, ['editorial', 'co producer']);
  assert.ok(indexed.text.includes('co producer'));
  assert.ok(indexed.text.includes('plugg'));
  assert.ok(!JSON.stringify(indexed).includes('private text'));
  assert.ok(!('ratingCount' in indexed));
  assert.equal(catalogIndex('tracks', { sourceStatus: 'unavailable' }).available, false);
});

test('stylized Unicode titles never generate isolated UTF-16 surrogates in Firestore index entries', () => {
  const title = 'ᘜ𝒶ɹв︎𐌀ℵz𐌏 (𝑃r𝗼∂︎. Craves, Other & Gyo)';
  for (const gram of searchGrams(title))
    assert.equal(Buffer.from(gram, 'utf8').toString('utf8'), gram);
  assert.equal(searchNeedle('𐌀𐌏𐌀abc'), '𐌀𐌏𐌀');
  assert.ok(searchGrams(title).includes(searchNeedle('𐌀ℵz')));
});
