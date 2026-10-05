import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
process.env.GCLOUD_PROJECT = 'demo-earlyworld-messages';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Use Firestore emulator.');
const { db } = await import('../functions/src/core.ts');
const api = await import('../functions/src/messages.ts');
const social = await import('../functions/src/social.ts');
const { readCommunity } = await import('../functions/src/social-reads.ts');
const req = (uid: string, data: unknown = {}, admin = false) =>
  ({ auth: { uid, token: { email_verified: true, admin } }, data }) as any;
let n = 0;
const rid = () => `req${++n}`;
const open = (uid: string, memberIds: string[], name?: string) =>
  api.openConversation.run(req(uid, { memberIds, name, requestId: rid() }));
const send = (uid: string, cid: string, body = 'hey', requestId = rid()) =>
  api.sendMessage.run(req(uid, { cid, kind: 'text', body, requestId }));
const row = async (uid: string, cid: string) =>
  (await db.doc(`users/${uid}/conversations/${cid}`).get()).data();
const people = ['alice', 'bob', 'carol', 'dave', 'mod'];
beforeEach(async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-earlyworld-messages/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  await db.doc('_socialControl/config').set({ messaging: true });
  for (const uid of people) {
    await db.doc(`users/${uid}`).set({
      username: uid,
      usernameLower: uid,
      avatarUrl: '',
      onboardingComplete: true,
      scenes: ['plugg'],
    });
    await db.doc(`_socialAccounts/${uid}`).set({ eligible: true, ageBand: '18+' });
  }
  await db.doc('tracks/t').set({ title: 'Rare one' });
});
after(() => db.terminate());

test('a DM is deduplicated, retries are no-ops, and followers land in the inbox', async () => {
  await db.doc('users/bob/following/alice').set({ targetId: 'alice', targetType: 'user' });
  const { id } = await open('alice', ['bob']);
  assert.equal((await open('bob', ['alice'])).id, id);
  assert.equal(await row('bob', id), undefined, 'the recipient sees nothing before a message');
  await send('alice', id, 'hi', 'same');
  await send('alice', id, 'hi', 'same');
  assert.equal((await db.collection(`conversations/${id}/messages`).get()).size, 1);
  const bob = await row('bob', id);
  assert.equal(bob!.state, 'inbox');
  assert.equal(bob!.unread, 1);
  assert.equal(bob!.lastMessage.preview, 'hi');
  assert.equal((await row('alice', id))!.unread, 0);
});

test('matches in either direction reach the inbox; strangers become capped requests', async () => {
  await db.doc('users/carol/matches/alice').set({ score: 1, sharedTracks: [] });
  const matched = await open('alice', ['carol']);
  await send('alice', matched.id);
  assert.equal((await row('carol', matched.id))!.state, 'inbox');

  const stranger = await open('alice', ['dave']);
  for (let i = 0; i < 3; i++) await send('alice', stranger.id);
  assert.equal((await row('dave', stranger.id))!.state, 'request');
  await assert.rejects(send('alice', stranger.id), { code: 'resource-exhausted' });
  await db.doc('users/dave/following/alice').set({ targetId: 'alice', targetType: 'user' });
  await send('alice', stranger.id);
  assert.equal((await row('dave', stranger.id))!.state, 'inbox', 'a follow promotes the request');
  await db.doc('users/dave/following/alice').delete();
  await api.respondToRequest.run(req('dave', { cid: stranger.id, accept: true }));
  await send('alice', stranger.id);
  assert.equal((await row('dave', stranger.id))!.state, 'inbox');
});

test('declined requests stay hidden from the recipient without telling the sender', async () => {
  const { id } = await open('alice', ['dave']);
  await send('alice', id);
  await api.respondToRequest.run(req('dave', { cid: id, accept: false }));
  await send('alice', id);
  assert.equal((await row('dave', id))!.state, 'declined');
});

test('teens and adults cannot start requests with each other, but connected listeners can talk', async () => {
  await db.doc('_socialAccounts/dave').update({ ageBand: '13-17' });
  await assert.rejects(open('alice', ['dave']), { code: 'failed-precondition' });
  await db.doc('users/dave/following/alice').set({ targetId: 'alice', targetType: 'user' });
  const { id } = await open('alice', ['dave']);
  await send('alice', id);
  assert.equal((await row('dave', id))!.state, 'inbox');
});

test('blocking hides the DM and stops new conversations and messages in both directions', async () => {
  const { id } = await open('alice', ['bob']);
  await send('alice', id);
  await social.setUserBlock.run(req('bob', { uid: 'alice', blocked: true }));
  assert.equal((await row('bob', id))!.state, 'declined');
  await assert.rejects(send('alice', id), { code: 'failed-precondition' });
  await assert.rejects(send('bob', id), { code: 'failed-precondition' });
  await assert.rejects(open('alice', ['bob']), { code: 'not-found' });
});

test('groups: creator manages members, members can leave, limits and membership are enforced', async () => {
  const { id } = await open('alice', ['bob', 'carol'], 'Plugg heads');
  assert.equal((await row('bob', id))!.name, 'Plugg heads');
  assert.equal((await row('bob', id))!.state, 'request');
  await assert.rejects(
    api.addConversationMembers.run(req('bob', { cid: id, memberIds: ['dave'] })),
    {
      code: 'permission-denied',
    },
  );
  await api.addConversationMembers.run(req('alice', { cid: id, memberIds: ['dave'] }));
  assert.deepEqual((await row('carol', id))!.memberIds, ['alice', 'bob', 'carol', 'dave']);
  await send('dave', id, 'thanks for the add');
  assert.equal((await row('bob', id))!.unread, 1);
  await assert.rejects(send('mod', id), { code: 'not-found' });

  await api.leaveConversation.run(req('alice', { cid: id }));
  const conversation = (await db.doc(`conversations/${id}`).get()).data()!;
  assert.deepEqual(conversation.memberIds, ['bob', 'carol', 'dave']);
  assert.equal(conversation.createdBy, 'bob');
  assert.equal(await row('alice', id), undefined);
  await api.removeConversationMember.run(req('bob', { cid: id, uid: 'dave' }));
  assert.equal(await row('dave', id), undefined);

  const many = Array.from({ length: 20 }, (_, i) => `u${i}`);
  await assert.rejects(open('alice', many), { code: 'invalid-argument' });
});

test('messages require the messaging switch, a member and an existing shared item', async () => {
  const { id } = await open('alice', ['bob']);
  await assert.rejects(
    api.sendMessage.run(
      req('alice', { cid: id, kind: 'track', trackId: 'gone', requestId: rid() }),
    ),
    { code: 'not-found' },
  );
  await api.sendMessage.run(
    req('alice', { cid: id, kind: 'track', trackId: 't', requestId: rid() }),
  );
  assert.equal((await row('bob', id))!.lastMessage.preview, 'Shared a track: Rare one');
  await db.doc('_socialControl/config').set({ messaging: false });
  await assert.rejects(send('alice', id), { code: 'failed-precondition' });
});

test('members can report a message; moderators remove its content', async () => {
  const { id } = await open('alice', ['bob']);
  const { id: message } = await send('alice', id, 'something bad');
  const report = { kind: 'message', id: message, conversationId: id, reason: 'Harassment' };
  await assert.rejects(social.reportSocialContent.run(req('carol', report)), { code: 'not-found' });
  await social.reportSocialContent.run(req('bob', report));
  const queue = await social.listModeration.run(req('mod', { reports: true }, true));
  assert.equal(queue.items[0].content.body, 'something bad');
  await api.removeReportedMessage.run(req('mod', { cid: id, id: message }, true));
  const removed = (await db.doc(`conversations/${id}/messages/${message}`).get()).data()!;
  assert.equal(removed.removed, true);
  assert.equal(removed.body, '');
});

test('username search returns approved, visible listeners only', async () => {
  await db
    .doc('users/bobby')
    .set({ username: '', usernameLower: 'bobby', onboardingComplete: true });
  await db
    .doc('users/bobcat')
    .set({ username: 'bobcat', usernameLower: 'bobcat', onboardingComplete: true });
  await social.setUserBlock.run(req('bobcat', { uid: 'alice', blocked: true }));
  const { items } = await api.searchUsers.run(req('alice', { query: '@Bob' }));
  assert.deepEqual(
    items.map((p: { id: string }) => p.id),
    ['bob'],
  );
});

test('followers, followed listeners, batched profiles and scene suggestions are owner scoped', async () => {
  const at = (ms: number) => new Date(1700000000000 + ms);
  await db
    .doc('users/bob/following/alice')
    .set({ targetId: 'alice', targetType: 'user', followedAt: at(1) });
  await db
    .doc('users/carol/following/alice')
    .set({ targetId: 'alice', targetType: 'user', followedAt: at(2) });
  await db
    .doc('users/alice/following/dave')
    .set({ targetId: 'dave', targetType: 'user', followedAt: at(3) });
  await db
    .doc('users/alice/following/artist')
    .set({ targetId: 'artist', targetType: 'artist', followedAt: at(4) });
  const followers = await readCommunity.run(req('alice', { kind: 'followers' }));
  assert.deepEqual(
    followers.items.map((p: { id: string }) => p.id),
    ['carol', 'bob'],
  );
  const following = await readCommunity.run(req('alice', { kind: 'followingUsers' }));
  assert.deepEqual(
    following.items.map((p: { id: string }) => p.id),
    ['dave'],
  );
  await social.setUserBlock.run(req('alice', { uid: 'carol', blocked: true }));
  const profiles = await readCommunity.run(
    req('alice', { kind: 'profiles', uids: ['bob', 'carol'] }),
  );
  assert.deepEqual(
    profiles.items.map((p: { id: string }) => p.id),
    ['bob'],
  );
  const suggested = await readCommunity.run(req('alice', { kind: 'suggestedListeners' }));
  const ids = suggested.items.map((p: { id: string }) => p.id);
  assert.ok(ids.includes('bob') && !ids.includes('carol') && !ids.includes('dave'));
});

test('account deletion removes sent messages and leaves every conversation', async () => {
  const { deleteAccountBatch } = await import('../functions/src/social-account.ts');
  const { id } = await open('alice', ['bob', 'carol']);
  await send('alice', id);
  await send('bob', id);
  await db.doc('_accountDeletion/alice').set({ stage: 0, complete: false });
  for (let i = 0; i < 30; i++) await deleteAccountBatch('alice');
  const messages = await db.collection(`conversations/${id}/messages`).get();
  assert.deepEqual(
    messages.docs.map((d) => d.data().uid),
    ['bob'],
  );
  assert.deepEqual((await row('bob', id))!.memberIds, ['bob', 'carol']);
});
