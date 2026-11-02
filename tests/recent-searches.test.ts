import test from 'node:test';
import assert from 'node:assert/strict';
import { forgetSearch, rememberSearch } from '../shared/recent-searches';
import { shareMessage, shareUrl } from '../shared/links';

test('recent searches keep the newest five, dedupe case-insensitively, ignore short terms', () => {
  let recent: string[] = [];
  for (const term of ['plugg', 'che ', 'Lucki', 'rage', 'jerk', 'p'])
    recent = rememberSearch(recent, term);
  assert.deepEqual(recent, ['jerk', 'rage', 'Lucki', 'che', 'plugg']);
  recent = rememberSearch(recent, 'CHE');
  assert.deepEqual(recent, ['CHE', 'jerk', 'rage', 'Lucki', 'plugg']);
  recent = rememberSearch(recent, 'summrs');
  assert.deepEqual(recent, ['summrs', 'CHE', 'jerk', 'rage', 'Lucki']);
  assert.deepEqual(forgetSearch(recent, 'jerk'), ['summrs', 'CHE', 'rage', 'Lucki']);
});

test('share links use the hosted opener pages and escape the identifier', () => {
  assert.equal(shareUrl('track', 'a b'), 'https://earlyworld-6831c.web.app/track/a%20b');
  assert.equal(shareMessage('user', 'u1'), 'https://earlyworld-6831c.web.app/user/u1');
  assert.match(shareMessage('track', 't1', 'Song'), /^Song on earlyworld\n/);
});
