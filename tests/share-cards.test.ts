import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD,
  MOON_SIZE,
  favoriteAverage,
  initials,
  monthStamp,
  moonPositions,
  pickRecap,
  wavePaths,
} from '../shared/share-cards';

const at = (iso: string) => new Date(iso).getTime();
const save = (trackId: string, iso: string, saveCountAtSave: number) => ({
  trackId,
  savedAtMillis: at(iso),
  saveCountAtSave,
});

test('recap picks the rarest save this month, breaking ties by the earliest save', () => {
  const now = new Date('2026-10-20T12:00:00');
  const pick = pickRecap(
    [
      save('late', '2026-10-15T10:00:00', 0),
      save('early', '2026-10-02T10:00:00', 0),
      save('popular', '2026-10-01T10:00:00', 40),
      save('lastMonth', '2026-09-30T10:00:00', 0),
    ],
    now,
  );
  assert.equal(pick?.save.trackId, 'early');
  assert.equal(pick?.monthLabel, 'YOUR OCTOBER');
  assert.equal(pick?.foundAt, 0);
});

test('recap falls back to last month, and is empty without recent saves', () => {
  const now = new Date('2026-10-01T09:00:00');
  const pick = pickRecap(
    [save('sept', '2026-09-12T10:00:00', 3), save('aug', '2026-08-12T10:00:00', 0)],
    now,
  );
  assert.equal(pick?.save.trackId, 'sept');
  assert.equal(pick?.monthLabel, 'YOUR SEPTEMBER');
  assert.equal(pickRecap([save('aug', '2026-08-12T10:00:00', 0)], now), null);
  assert.equal(pickRecap([], now), null);
  // January falls back to the previous year's December.
  assert.equal(
    pickRecap([save('dec', '2025-12-31T23:00:00', 1)], new Date('2026-01-03T09:00:00'))?.monthLabel,
    'YOUR DECEMBER',
  );
});

test('moons stay inside the card and are capped at four', () => {
  assert.equal(moonPositions(0).length, 0);
  assert.equal(moonPositions(9).length, 4);
  for (const m of moonPositions(4)) {
    assert.ok(m.left >= 0 && m.left + MOON_SIZE <= CARD.width);
    assert.ok(m.top >= 0 && m.top + MOON_SIZE <= CARD.height);
  }
});

test('wave paths are well-formed, span the card, and fade line by line', () => {
  const waves = wavePaths({ top: 552 });
  assert.equal(waves.length, 5);
  for (const w of waves) {
    assert.match(w.d, /^M0 [\d.]+( L\d+ [\d.]+)+$/);
    assert.ok(w.d.includes(` L${CARD.width} `));
  }
  assert.ok(waves[0].opacity > waves[4].opacity);
});

test('averages, month stamps and initials format for display', () => {
  assert.equal(favoriteAverage([10, 10, 10, 9]), '4.9');
  assert.equal(favoriteAverage([]), null);
  assert.equal(monthStamp(new Date('2026-10-05T12:00:00')), 'OCT 2026');
  assert.equal(initials('bellsandbags'), 'BE');
  assert.equal(initials('@lil_candy'), 'LC');
});
