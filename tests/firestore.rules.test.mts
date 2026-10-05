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
  runTransaction,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  getDoc,
  collectionGroup,
  collection,
  orderBy,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { applySaveIntent, type SaveSource } from '../shared/saves.ts';
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
    projectId: 'demo-earlyworld-catalog-rules',
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
test('username publication and reservation cannot bypass the server moderation queue', async () => {
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
  await assertFails(batch.commit());
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'usernames/early'), { uid: 'alice', createdAt: new Date() });
  });
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
test('comments require server moderation; authors can remove published comments', async () => {
  const db = env.authenticatedContext('alice').firestore(),
    ref = doc(db, 'tracks/t/comments/c');
  await assertFails(setDoc(ref, { uid: 'bob', body: 'fake', createdAt: serverTimestamp() }));
  await assertFails(setDoc(ref, { uid: 'alice', body: '', createdAt: serverTimestamp() }));
  await assertFails(
    setDoc(ref, { uid: 'alice', body: 'That producer tag.', createdAt: serverTimestamp() }),
  );
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), 'tracks/t/comments/c'), {
      uid: 'alice',
      body: 'Approved',
      createdAt: new Date(),
    }),
  );
  await assertFails(
    deleteDoc(doc(env.authenticatedContext('bob').firestore(), 'tracks/t/comments/c')),
  );
  await assertSucceeds(deleteDoc(ref));
});
test('matches and leaderboard bypasses are private; cross-account reads go through server', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/alice/matches/bob'), { score: 1 });
    await setDoc(doc(ctx.firestore(), 'users/alice/rotation/artist_a'), {
      entityId: 'artist_a',
      score: 10,
    });
  });
  const db = env.authenticatedContext('bob').firestore();
  await assertFails(getDoc(doc(db, 'users/alice/matches/bob')));
  await assertFails(
    getDocs(query(collectionGroup(db, 'rotation'), where('entityId', '==', 'artist_a'))),
  );
});

test('ratings are readable only to signed-in listeners and all rating writes are server-only', async () => {
  const path = 'ratings/test-rating';
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), path), {
      uid: 'alice',
      trackId: 't',
      halfStars: 8,
      review: 'A take',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );
  for (const uid of ['alice', 'bob']) {
    const ref = doc(env.authenticatedContext(uid).firestore(), path);
    await (uid === 'alice' ? assertSucceeds : assertFails)(getDoc(ref));
    await assertFails(updateDoc(ref, { halfStars: 10 }));
    await assertFails(deleteDoc(ref));
    await assertFails(
      setDoc(doc(env.authenticatedContext(uid).firestore(), 'ratings/new'), {
        uid,
        trackId: 't',
        halfStars: 10,
      }),
    );
  }
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), path)));
});
test('rating aggregates and pinned favorites cannot be edited directly on legacy profiles/tracks', async () => {
  const client = env.authenticatedContext('alice').firestore();
  for (const field of ['ratingCount', 'reviewCount', 'favoriteTrackIds'])
    await assertFails(
      updateDoc(doc(client, 'users/alice'), {
        [field]: field === 'favoriteTrackIds' ? ['t'] : 100,
      }),
    );
  await assertFails(
    updateDoc(doc(client, 'tracks/t'), { ratingCount: 999, ratingHalfStarSum: 9990 }),
  );
});

test('SoundCloud OAuth tokens and identity mappings are inaccessible to clients', async () => {
  for (const path of ['_integrations/soundcloudOAuth', '_soundcloudTracks/id']) {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), path), { value: 'private-test-value' }),
    );
    for (const context of [env.unauthenticatedContext(), env.authenticatedContext('alice')]) {
      const ref = doc(context.firestore(), path);
      await assertFails(getDoc(ref));
      await assertFails(setDoc(ref, { value: 'modified' }));
    }
  }
});

test('save retries use current metadata, preserve timestamps, and allow more than five saves', async () => {
  const db = env.authenticatedContext('alice').firestore();
  const save = (id: string, desired: boolean) =>
    runTransaction(db, (tx) =>
      applySaveIntent(
        {
          get: async (path) => (await tx.get(doc(db, path))).data() as SaveSource | undefined,
          set: (path, value) => {
            tx.set(doc(db, path), value);
          },
          delete: (path) => {
            tx.delete(doc(db, path));
          },
        },
        'alice',
        id,
        desired,
        serverTimestamp(),
      ),
    );
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (let n = 0; n < 6; n++)
      await setDoc(doc(ctx.firestore(), `tracks/retry${n}`), {
        ...baseTrack,
        title: `Current title ${n}`,
        producerId: null,
        producerName: null,
      });
  });
  for (let n = 0; n < 6; n++) await assertSucceeds(save(`retry${n}`, true));
  const ref = doc(db, 'users/alice/saves/retry0');
  const before = (await getDoc(ref)).data()!;
  // Reproduce the old setDoc-on-existing-document permission error.
  await assertFails(setDoc(ref, { ...before, savedAt: serverTimestamp() }));
  await Promise.all([assertSucceeds(save('retry0', true)), assertSucceeds(save('retry0', true))]);
  const after = (await getDoc(ref)).data()!;
  assert.equal(after.savedAt.toMillis(), before.savedAt.toMillis());
  assert.equal(after.title, 'Current title 0');
  assert.equal(after.producerId, null);
  for (let n = 0; n < 6; n++)
    assert.ok((await getDoc(doc(db, `users/alice/saves/retry${n}`))).exists());
  await assertSucceeds(save('retry0', false));
  await assertSucceeds(save('retry0', false));
  assert.equal((await getDoc(ref)).exists(), false);
  await assert.rejects(save('missing-track', true), /no longer available/);
});

test('producer credits are signed-in readable and server-owned', async () => {
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), 'producers/p/productions/1'), { title: 'Credit' }),
  );
  await assertSucceeds(
    getDoc(doc(env.authenticatedContext('alice').firestore(), 'producers/p/productions/1')),
  );
  await assertFails(
    getDoc(doc(env.unauthenticatedContext().firestore(), 'producers/p/productions/1')),
  );
  await assertFails(
    setDoc(doc(env.authenticatedContext('alice').firestore(), 'producers/p/productions/2'), {
      title: 'Fake credit',
    }),
  );
  await assertFails(
    deleteDoc(doc(env.authenticatedContext('alice').firestore(), 'producers/p/productions/1')),
  );
});

test('release metadata, opinions, and favorites are server-owned and signed-in readable', async () => {
  const signed = env.authenticatedContext('alice').firestore();
  const anonymous = env.unauthenticatedContext().firestore();
  for (const path of ['releases/album', 'releaseRatings/opinion']) {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), path), { uid: 'alice', title: 'Album', halfStars: 8 }),
    );
    await assertSucceeds(getDoc(doc(signed, path)));
    await assertFails(getDoc(doc(anonymous, path)));
    await assertFails(setDoc(doc(signed, path), { halfStars: 10 }));
    await assertFails(deleteDoc(doc(signed, path)));
  }
  await assertFails(updateDoc(doc(signed, 'users/alice'), { favoriteReleaseIds: ['album'] }));
  await assertFails(
    updateDoc(doc(signed, 'users/alice'), { releaseRatingCount: 99, releaseReviewCount: 99 }),
  );
  await assertFails(getDoc(doc(signed, '_releaseSync/artist')));
});

test('catalog search, queue controls, jobs, and provider snapshots are private and server-owned', async () => {
  const signed = env.authenticatedContext('alice').firestore();
  const anonymous = env.unauthenticatedContext().firestore();
  for (const path of [
    '_catalogSearch/tracks_t',
    '_catalogControl/search',
    '_catalogControl/genius',
    '_catalogJobs/t',
    '_catalogReindex/a',
    '_providerMetadata/t/sources/soundcloud',
  ]) {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), path), { marker: true }),
    );
    await assertFails(getDoc(doc(signed, path)));
    await assertFails(getDoc(doc(anonymous, path)));
    await assertFails(setDoc(doc(signed, path), { enabled: true }));
    await assertFails(deleteDoc(doc(signed, path)));
  }
});

test('private social state cannot be read or published directly, including admin clients', async () => {
  for (const path of [
    'posts/p',
    '_postDrafts/p',
    '_socialMedia/m',
    '_postComments/c',
    '_moderation/m',
    '_socialReports/r',
    '_socialAccounts/alice',
    'users/alice/postBookmarks/p',
  ]) {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), path), { uid: 'alice', status: 'pending' }),
    );
    for (const client of [
      env.authenticatedContext('alice'),
      env.authenticatedContext('bob'),
      env.authenticatedContext('mod', { admin: true }),
    ]) {
      await assertFails(getDoc(doc(client.firestore(), path)));
      await assertFails(setDoc(doc(client.firestore(), path), { status: 'published' }));
    }
  }
});
test('profile text and avatars cannot bypass moderation; blocking prevents new follows', async () => {
  const client = env.authenticatedContext('alice').firestore();
  await assertFails(updateDoc(doc(client, 'users/alice'), { bio: 'Direct publication' }));
  await assertFails(
    updateDoc(doc(client, 'users/alice'), { avatarUrl: 'https://example.com/photo.jpg' }),
  );
  await assertFails(getDoc(doc(client, 'users/bob')));
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), 'users/alice/blockedBy/bob'), { uid: 'bob' }),
  );
  await assertFails(
    setDoc(doc(client, 'users/alice/following/bob'), {
      targetId: 'bob',
      targetType: 'user',
      followedAt: serverTimestamp(),
    }),
  );
});
test('conversations and messages are readable by current members only and never client-written', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'conversations/c'), { type: 'dm', memberIds: ['alice', 'bob'] });
    await setDoc(doc(db, 'conversations/c/messages/m'), { uid: 'alice', body: 'hi' });
  });
  const alice = env.authenticatedContext('alice').firestore(),
    carol = env.authenticatedContext('carol').firestore();
  await assertSucceeds(getDoc(doc(alice, 'conversations/c')));
  await assertSucceeds(
    getDocs(query(collection(alice, 'conversations/c/messages'), orderBy('createdAt', 'desc'))),
  );
  await assertFails(getDoc(doc(carol, 'conversations/c')));
  await assertFails(getDoc(doc(carol, 'conversations/c/messages/m')));
  await assertFails(
    setDoc(doc(alice, 'conversations/c/messages/x'), { uid: 'alice', body: 'direct' }),
  );
  await assertFails(
    updateDoc(doc(alice, 'conversations/c'), { memberIds: ['alice', 'bob', 'carol'] }),
  );
  await env.withSecurityRulesDisabled((ctx) =>
    updateDoc(doc(ctx.firestore(), 'conversations/c'), { memberIds: ['bob'] }),
  );
  await assertFails(getDoc(doc(alice, 'conversations/c/messages/m')));
});
test('inbox rows are owner-read and the owner may only mark them read', async () => {
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), 'users/alice/conversations/c'), {
      state: 'request',
      unread: 3,
      readAt: null,
      memberIds: ['alice', 'bob'],
    }),
  );
  const alice = env.authenticatedContext('alice').firestore(),
    bob = env.authenticatedContext('bob').firestore(),
    ref = doc(alice, 'users/alice/conversations/c');
  await assertFails(getDoc(doc(bob, 'users/alice/conversations/c')));
  await assertSucceeds(getDoc(ref));
  await assertFails(updateDoc(ref, { unread: 1, readAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { unread: 0, readAt: serverTimestamp(), state: 'inbox' }));
  await assertSucceeds(updateDoc(ref, { unread: 0, readAt: serverTimestamp() }));
  await assertFails(deleteDoc(ref));
  await assertFails(
    setDoc(doc(alice, 'users/alice/conversations/new'), { state: 'inbox', unread: 0 }),
  );
});
