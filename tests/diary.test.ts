import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDiary, groupDiary } from '../shared/diary';

const day = (month: number, d: number) => new Date(2026, month - 1, d, 12).getTime();

test('diary merges ratings and saves newest first, showing a rated save once', () => {
  const entries = buildDiary(
    [
      { itemId: 'ski', halfStars: 9, review: 'Hard.', createdAt: day(10, 12) },
      { itemId: 'intro', halfStars: 8, review: '', createdAt: day(10, 3) },
    ],
    [{ itemId: 'tape', halfStars: 7, review: '', createdAt: day(9, 20) }],
    [
      { trackId: 'intro', savedAt: day(9, 28), title: 'intro', artistName: 'che' },
      { trackId: 'supertune', savedAt: day(10, 9), title: 'SUPERTUNE!!', artistName: 'LUCKI' },
    ],
  );
  assert.deepEqual(
    entries.map((e) => [e.key, new Date(e.at).getDate()]),
    [
      ['rating:ski', 12],
      ['save:supertune', 9],
      // Rated on Oct 3 but saved Sept 28: shown once, as the rating, on the earlier date.
      ['rating:intro', 28],
      ['release:tape', 20],
    ],
  );
  assert.equal(entries[0].reviewed, true);
  assert.equal(entries[1].saved, true);
  assert.equal(entries[2].title, 'intro');
});

test('diary groups entries into months with rating and save counts', () => {
  const months = groupDiary(
    buildDiary(
      [{ itemId: 'a', halfStars: 6, review: '', createdAt: day(10, 1) }],
      [],
      [
        { trackId: 'b', savedAt: day(10, 5) },
        { trackId: 'c', savedAt: day(8, 30) },
      ],
    ),
  );
  assert.deepEqual(
    months.map((m) => [m.label, m.ratings, m.saves, m.entries.length]),
    [
      ['October 2026', 1, 1, 2],
      ['August 2026', 0, 1, 1],
    ],
  );
});
