import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
// Web SDK is ONLY an emulator test driver; the native application never imports it.
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  getDoc,
  collectionGroup,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
let env: RulesTestEnvironment;
const baseUser = {
  username: '',
  usernameLower: '',
  avatarUrl: '',
  bio: '',
  saveCount: 0,
  followerCount: 0,
  onboardingComplete: false,
  onboardingStep: 1,
  scenes: [],
};
const baseTrack = {
  title: 'Deep cut',
  artistId: 'artist_a',
  artistName: 'Artist',
  producerId: 'producer_p',
  producerName: 'Producer',
  artworkUrl: '',
  saveCount: 0,
  savers: [],
  saversCapped: false,
  geniusStatus: 'pending',
  credits: null,
};
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-earlyworld',
    firestore: { rules: await readFile('firestore.rules', 'utf8') },
  });
});
after(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'tracks/t'), baseTrack);
    await setDoc(doc(ctx.firestore(), 'users/alice'), { ...baseUser, createdAt: new Date() });
    await setDoc(doc(ctx.firestore(), 'users/bob'), { ...baseUser, createdAt: new Date() });
  });
});
for (const path of ['rotation/artist_a', 'engagementStats/artist_a', 'matches/bob'])
  test(`anti-cheat: own ${path} cannot be created, changed, or deleted`, async () => {
    const ref = doc(env.authenticatedContext('alice').firestore(), `users/alice/${path}`);
    await assertFails(setDoc(ref, { score: 999, tier: 'diamond' }));
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), `users/alice/${path}`), { score: 10, tier: 'gold' }),
    );
    await assertFails(updateDoc(ref, { score: 999 }));
    await assertFails(deleteDoc(ref));
  });
test('track counters and Genius credits are server-only', async () => {
  const ref = doc(env.authenticatedContext('alice').firestore(), 'tracks/t');
  for (const data of [
    { saveCount: 999 },
    { savers: ['alice'] },
    { saversCapped: false },
    { geniusStatus: 'matched' },
    { credits: { producers: ['fake'] } },
  ])
    await assertFails(updateDoc(ref, data));
  await assertFails(
    setDoc(doc(env.authenticatedContext('alice').firestore(), 'tracks/new'), baseTrack),
  );
});
test('valid owner save succeeds, spoofed denormalized credit and other-user write fail', async () => {
  const db = env.authenticatedContext('alice').firestore();
  const save = {
    trackId: 't',
    savedAt: serverTimestamp(),
    title: 'Deep cut',
    artistId: 'artist_a',
    artistName: 'Artist',
    producerId: 'producer_p',
    producerName: 'Producer',
    artworkUrl: '',
    saveCountAtSave: 0,
  };
  await assertFails(setDoc(doc(db, 'users/bob/saves/t'), save));
  await assertFails(setDoc(doc(db, 'users/alice/saves/t'), { ...save, producerName: 'Imposter' }));
  await assertSucceeds(setDoc(doc(db, 'users/alice/saves/t'), save));
  await assertFails(updateDoc(doc(db, 'users/alice/saves/t'), { title: 'Changed' }));
  await assertSucceeds(deleteDoc(doc(db, 'users/alice/saves/t')));
});
test('username reservation is atomic, exclusive, and immutable', async () => {
  const db = env.authenticatedContext('alice').firestore();
  await assertFails(
    setDoc(doc(db, 'usernames/early'), { uid: 'alice', createdAt: serverTimestamp() }),
  );
  const batch = writeBatch(db);
  batch.set(doc(db, 'usernames/early'), { uid: 'alice', createdAt: serverTimestamp() });
  batch.update(doc(db, 'users/alice'), {
    username: 'early',
    usernameLower: 'early',
    onboardingStep: 2,
  });
  await assertSucceeds(batch.commit());
  const other = env.authenticatedContext('bob').firestore(),
    second = writeBatch(other);
  second.set(doc(other, 'usernames/early'), { uid: 'bob', createdAt: serverTimestamp() });
  second.update(doc(other, 'users/bob'), {
    username: 'early',
    usernameLower: 'early',
    onboardingStep: 2,
  });
  await assertFails(second.commit());
  await assertFails(updateDoc(doc(db, 'usernames/early'), { uid: 'bob' }));
  await assertFails(deleteDoc(doc(db, 'usernames/early')));
});
test('client cannot finish onboarding, mint counters, or add arbitrary profile score', async () => {
  const ref = doc(env.authenticatedContext('alice').firestore(), 'users/alice');
  for (const data of [
    { onboardingComplete: true },
    { saveCount: 100 },
    { followerCount: 20 },
    { score: 150 },
    { onboardingStep: 5 },
  ])
    await assertFails(updateDoc(ref, data));
});
test('new account defaults validated and signed-out catalog is readable', async () => {
  const db = env.authenticatedContext('charlie').firestore();
  await assertSucceeds(
    setDoc(doc(db, 'users/charlie'), { ...baseUser, createdAt: serverTimestamp() }),
  );
  await assertFails(
    setDoc(doc(env.authenticatedContext('cheater').firestore(), 'users/cheater'), {
      ...baseUser,
      createdAt: serverTimestamp(),
      onboardingComplete: true,
    }),
  );
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'tracks/t')));
});
test('comments validate ownership, body, and deletion', async () => {
  const db = env.authenticatedContext('alice').firestore(),
    ref = doc(db, 'tracks/t/comments/c');
  await assertFails(setDoc(ref, { uid: 'bob', body: 'fake', createdAt: serverTimestamp() }));
  await assertFails(setDoc(ref, { uid: 'alice', body: '', createdAt: serverTimestamp() }));
  await assertSucceeds(
    setDoc(ref, { uid: 'alice', body: 'That producer tag.', createdAt: serverTimestamp() }),
  );
  await assertFails(
    deleteDoc(doc(env.authenticatedContext('bob').firestore(), 'tracks/t/comments/c')),
  );
  await assertSucceeds(deleteDoc(ref));
});
test('private matches stay private while leaderboard collection-group reads work', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/alice/matches/bob'), { score: 1 });
    await setDoc(doc(ctx.firestore(), 'users/alice/rotation/artist_a'), {
      entityId: 'artist_a',
      score: 10,
    });
  });
  const db = env.authenticatedContext('bob').firestore();
  await assertFails(getDoc(doc(db, 'users/alice/matches/bob')));
  const result = await assertSucceeds(
    getDocs(query(collectionGroup(db, 'rotation'), where('entityId', '==', 'artist_a'))),
  );
  assert.equal(result.size, 1);
});
