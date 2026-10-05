import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MESSAGE_LIMITS,
  conversationMembers,
  dmId,
  groupName,
  inboxStateFor,
  normalizeMessage,
  previewText,
} from '../shared/messages';

test('direct conversation ids are symmetric and reject self or invalid ids', () => {
  assert.equal(dmId('alice', 'bob'), dmId('bob', 'alice'));
  assert.throws(() => dmId('alice', 'alice'));
  assert.throws(() => dmId('alice', 'a/b'));
});

test('members exclude the sender, deduplicate, and respect the group cap', () => {
  assert.deepEqual(conversationMembers('alice', ['bob', 'bob', 'alice', 'carol']), [
    'bob',
    'carol',
  ]);
  assert.throws(() => conversationMembers('alice', ['alice']));
  assert.throws(() => conversationMembers('alice', 'bob'));
  const full = Array.from({ length: MESSAGE_LIMITS.groupMembers }, (_, i) => `u${i}`);
  assert.throws(() => conversationMembers('alice', full));
  assert.equal(conversationMembers('alice', full.slice(1)).length, MESSAGE_LIMITS.groupMembers - 1);
  assert.equal(groupName('  '), null);
  assert.throws(() => groupName('x'.repeat(MESSAGE_LIMITS.groupName + 1)));
});

test('followers and matches reach the inbox; everyone else is a request', () => {
  assert.equal(inboxStateFor({ recipientFollowsSender: true, matched: false }), 'inbox');
  assert.equal(inboxStateFor({ recipientFollowsSender: false, matched: true }), 'inbox');
  assert.equal(inboxStateFor({ recipientFollowsSender: false, matched: false }), 'request');
});

test('messages validate text and shared catalog items and produce bounded previews', () => {
  assert.deepEqual(normalizeMessage({ kind: 'text', body: ' hi ' }), {
    kind: 'text',
    body: 'hi',
    trackId: null,
    releaseId: null,
  });
  assert.throws(() => normalizeMessage({ kind: 'text', body: '  ' }));
  assert.throws(() => normalizeMessage({ kind: 'text', body: 'x'.repeat(1001) }));
  assert.throws(() => normalizeMessage({ kind: 'track', trackId: 'a/b' }));
  assert.throws(() => normalizeMessage({ kind: 'photo', body: 'x' }));
  const track = normalizeMessage({ kind: 'track', trackId: 't1', releaseId: 'ignored' });
  assert.equal(track.releaseId, null);
  assert.equal(previewText(track, 'Deep cut'), 'Shared a track: Deep cut');
  assert.equal(previewText({ kind: 'text', body: 'y'.repeat(200) }).length, 120);
});
