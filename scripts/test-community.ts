/**
 * Seeds or removes a tagged community of fake listeners for testing.
 *
 *   GCLOUD_PROJECT=<id> npx tsx scripts/test-community.ts plan
 *   GCLOUD_PROJECT=<id> npx tsx scripts/test-community.ts apply --production [--owner EMAIL|UID]
 *   GCLOUD_PROJECT=<id> npx tsx scripts/test-community.ts cleanup --production
 *
 * Every fake account id starts with `test_`; account, profile, rating, comment and
 * conversation documents carry `testFixture: true`. Saves and follows are written like
 * client writes so the deployed triggers keep counters, activity and matches consistent.
 * Cleanup queues the accounts for the deployed account-deletion pipeline.
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import {
  comments,
  highReviews,
  lowReviews,
  midReviews,
  ownerConversations,
  personas,
  releaseReviews,
  sceneLines,
  type Persona,
} from './test-community/content';

const [command = 'plan'] = process.argv.slice(2);
const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) throw Error('Set GCLOUD_PROJECT.');
if (!['plan', 'apply', 'cleanup'].includes(command))
  throw Error('Usage: test-community.ts plan|apply|cleanup [--production] [--owner EMAIL|UID]');
if (
  command !== 'plan' &&
  !process.env.FIRESTORE_EMULATOR_HOST &&
  !process.argv.includes('--production')
)
  throw Error('Writing to a live project requires --production.');
// The Functions modules initialize the Admin SDK from FIREBASE_CONFIG, as in Cloud Functions.
process.env.GOOGLE_CLOUD_PROJECT = projectId;
process.env.FIREBASE_CONFIG ||= JSON.stringify({
  projectId,
  storageBucket: `${projectId}.firebasestorage.app`,
});
const ownerEmail = process.argv.includes('--owner')
  ? process.argv[process.argv.indexOf('--owner') + 1]
  : null;

const DAY = 86400000;
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
/** Deterministic randomness: reruns produce the same community. */
function rng(seed: string) {
  let a = parseInt(hash(seed).slice(0, 8), 16);
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: T[]) => items[Math.floor(next() * items.length)],
    sample: <T>(items: T[], n: number) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy.slice(0, n);
    },
  };
}
const uidOf = (p: Persona) => `test_${p.username}`;
type Track = {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  producerId: string | null;
  producerName: string | null;
  artworkUrl: string;
  saveCount: number;
};
function fill(
  template: string,
  t: { title: string; artistName: string; producerName?: string | null },
) {
  return template
    .replaceAll('{title}', t.title)
    .replaceAll('{artist}', t.artistName)
    .replaceAll('{producer}', t.producerName || '');
}
function voice(p: Persona, text: string) {
  return p.lower ? text.toLowerCase() : text.charAt(0).toUpperCase() + text.slice(1);
}
/** Prefers the least-used lines so the community doesn't repeat itself. */
const usage = new Map<string, number>();
function pickFresh(r: ReturnType<typeof rng>, lines: string[]) {
  const least = Math.min(...lines.map((l) => usage.get(l) || 0));
  const line = r.pick(lines.filter((l) => (usage.get(l) || 0) === least));
  usage.set(line, (usage.get(line) || 0) + 1);
  return line;
}
function review(
  r: ReturnType<typeof rng>,
  p: Persona,
  halfStars: number,
  t: { title: string; artistName: string; producerName?: string | null },
) {
  const pool = halfStars >= 8 ? highReviews : halfStars >= 5 ? midReviews : lowReviews;
  const usable = pool.filter((line) => !line.includes('{producer}') || t.producerName);
  const scene = sceneLines[r.pick(p.scenes)] || [];
  // Some reviews are only a scene reaction; a few add one after the main thought.
  if (halfStars >= 7 && r.next() < 0.15) return voice(p, pickFresh(r, scene));
  let text = fill(pickFresh(r, usable), t);
  if (halfStars >= 7 && r.next() < 0.2) text = `${text}. ${pickFresh(r, scene)}`;
  return voice(p, text);
}

async function main() {
  const core = await import('../functions/src/core');
  const { db, FieldValue, Timestamp } = core;
  // Resolve from the Functions package so Auth shares the app that core.ts initialized.
  const { getAuth } = createRequire(resolve('functions/package.json'))(
    'firebase-admin/auth',
  ) as typeof import('firebase-admin/auth');

  if (command === 'cleanup') return cleanup(db);

  // Catalog: tracks by artists in each scene, staples shared across personas so matches form.
  const artists = await db.collection('artists').get();
  const byScene = new Map<string, string[]>();
  for (const a of artists.docs)
    for (const scene of a.data().scenes || [])
      byScene.set(scene, [...(byScene.get(scene) || []), a.id]);
  const sceneTracks = new Map<string, Track[]>();
  for (const scene of new Set(personas.flatMap((p) => p.scenes))) {
    const ids = rng(scene).sample(byScene.get(scene) || [], 30);
    if (!ids.length) continue;
    const snap = await db.collection('tracks').where('artistId', 'in', ids).limit(400).get();
    const tracks = snap.docs
      .filter((d) => d.data().sourceStatus !== 'unavailable')
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Track, 'id'>) }));
    // Prefer credited tracks so producer details show up throughout the app.
    tracks.sort((a, b) => Number(!!b.producerName) - Number(!!a.producerName));
    sceneTracks.set(scene, tracks);
  }
  const staples = new Map(
    [...sceneTracks].map(([scene, tracks]) => [
      scene,
      rng(`staples:${scene}`).sample(tracks.slice(0, 120), 18),
    ]),
  );
  const releases = await db.collection('releases').get();

  let owner: { uid: string; saves: string[] } | null = null;
  if (ownerEmail) {
    const ownerUid = ownerEmail.includes('@')
      ? (await getAuth().getUserByEmail(ownerEmail)).uid
      : ownerEmail;
    const saves = await db.collection(`users/${ownerUid}/saves`).get();
    owner = { uid: ownerUid, saves: saves.docs.map((d) => d.id) };
  }

  const now = Date.now();
  const plans = personas.map((p, index) => {
    const r = rng(p.username);
    const saved = new Map<string, Track>();
    for (const scene of p.scenes) {
      for (const t of r.sample(staples.get(scene) || [], r.int(5, 8))) saved.set(t.id, t);
      for (const t of r.sample(sceneTracks.get(scene) || [], r.int(4, 7))) saved.set(t.id, t);
    }
    const ownerShared = owner && index % 4 === 0 ? r.sample(owner.saves, 3) : [];
    const savedList = [...saved.values()];
    const rated = r.sample(savedList, Math.min(savedList.length, r.int(7, 13)));
    const ratings = rated.map((t) => {
      const halfStars = r.next() < 0.7 ? r.int(8, 10) : r.next() < 0.75 ? r.int(5, 7) : r.int(2, 4);
      return { track: t, halfStars, review: r.next() < 0.55 ? review(r, p, halfStars, t) : '' };
    });
    const sceneArtists = new Set(p.scenes.flatMap((s) => byScene.get(s) || []));
    const releasePool = releases.docs.filter((d) => sceneArtists.has(d.data().artistId));
    const releaseRatings = r.sample(releasePool, r.int(1, 3)).map((d) => {
      const halfStars = r.int(6, 10);
      return {
        id: d.id,
        halfStars,
        review:
          r.next() < 0.6 ? voice(p, fill(pickFresh(r, releaseReviews), d.data() as Track)) : '',
      };
    });
    const commented = r.sample(savedList, r.int(2, 5)).map((t) => ({
      track: t,
      body: voice(
        p,
        fill(
          pickFresh(
            r,
            comments.filter((c) => !c.includes('{producer}') || t.producerName),
          ),
          t,
        ),
      ),
    }));
    const joined = now - r.int(25, 45) * DAY;
    return {
      persona: p,
      uid: uidOf(p),
      joined,
      saved: savedList,
      ownerShared,
      ratings,
      releaseRatings,
      commented,
      artistFollows: r.sample([...sceneArtists], r.int(5, 8)),
      favorites: [...ratings]
        .sort((a, b) => b.halfStars - a.halfStars)
        .slice(0, 4)
        .map((x) => x.track.id),
      r,
    };
  });
  // Listeners follow people who share a scene, plus a couple of wildcards.
  const follows = new Map<string, string[]>();
  for (const plan of plans) {
    const peers = plans.filter(
      (o) => o !== plan && o.persona.scenes.some((s) => plan.persona.scenes.includes(s)),
    );
    const others = plans.filter((o) => o !== plan && !peers.includes(o));
    follows.set(plan.uid, [
      ...plan.r.sample(peers, plan.r.int(3, 6)).map((o) => o.uid),
      ...plan.r.sample(others, plan.r.int(0, 2)).map((o) => o.uid),
      ...(owner && plan.r.next() < 0.3 ? [owner.uid] : []),
    ]);
  }

  console.log(
    JSON.stringify(
      {
        project: projectId,
        owner: owner ? 'found' : 'none',
        accounts: plans.length,
        saves: plans.reduce((n, p) => n + p.saved.length + p.ownerShared.length, 0),
        ratings: plans.reduce((n, p) => n + p.ratings.length, 0),
        reviews: plans.reduce((n, p) => n + p.ratings.filter((x) => x.review).length, 0),
        releaseRatings: plans.reduce((n, p) => n + p.releaseRatings.length, 0),
        comments: plans.reduce((n, p) => n + p.commented.length, 0),
        follows: [...follows.values()].reduce((n, f) => n + f.length, 0),
        followersOfOwner: [...follows.values()].filter((f) => owner && f.includes(owner.uid))
          .length,
        sampleReviews: plans.slice(0, 3).flatMap((p) =>
          p.ratings
            .filter((x) => x.review)
            .slice(0, 2)
            .map((x) => `@${p.persona.username} ${x.halfStars / 2}★ ${x.review}`),
        ),
      },
      null,
      2,
    ),
  );
  if (command === 'plan') return;

  const tag = { testFixture: true };
  for (const plan of plans) {
    const { persona: p, uid, joined } = plan;
    const userRef = db.doc(`users/${uid}`);
    if ((await userRef.get()).exists) {
      console.log(`skip @${p.username}: already seeded`);
      continue;
    }
    const taken = (await db.doc(`usernames/${p.username}`).get()).data();
    if (taken && taken.uid !== uid) {
      console.log(`skip @${p.username}: username belongs to a real account`);
      continue;
    }
    const batch = db.batch();
    batch.set(userRef, {
      username: p.username,
      usernameLower: p.username,
      avatarUrl: '',
      bio: p.bio,
      createdAt: Timestamp.fromMillis(joined),
      saveCount: 0,
      followerCount: 0,
      onboardingComplete: true,
      onboardingStep: 6,
      onboardingCompletedAt: Timestamp.fromMillis(joined + 600000),
      lastActiveAt: Timestamp.fromMillis(now - plan.r.int(0, 3) * DAY),
      scenes: p.scenes,
      favoriteTrackIds: plan.favorites,
      ...tag,
    });
    batch.set(db.doc(`usernames/${p.username}`), {
      uid,
      createdAt: Timestamp.fromMillis(joined),
      ...tag,
    });
    batch.set(db.doc(`_socialAccounts/${uid}`), {
      eligible: true,
      ageBand: '18+',
      country: 'US',
      ...tag,
    });
    await batch.commit();

    // Saves and follows mirror client writes; deployed triggers reconcile counters.
    const extra = plan.ownerShared.length
      ? (await db.getAll(...plan.ownerShared.map((id) => db.doc(`tracks/${id}`))))
          .filter((d) => d.exists)
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Track, 'id'>) }))
      : [];
    const writes = db.batch();
    [...plan.saved, ...extra].forEach((t, i) =>
      writes.set(db.doc(`users/${uid}/saves/${t.id}`), {
        trackId: t.id,
        savedAt: Timestamp.fromMillis(joined + DAY + i * plan.r.int(2, 9) * 3600000),
        title: t.title,
        artistId: t.artistId,
        artistName: t.artistName,
        producerId: t.producerId ?? null,
        producerName: t.producerName ?? null,
        artworkUrl: t.artworkUrl || '',
        saveCountAtSave: t.saveCount || 0,
      }),
    );
    for (const artistId of plan.artistFollows)
      writes.set(db.doc(`users/${uid}/following/${artistId}`), {
        targetId: artistId,
        targetType: 'artist',
        followedAt: Timestamp.fromMillis(joined + 300000),
      });
    await writes.commit();

    // Ratings replicate setTrackRating's aggregates; reviews are published directly.
    for (const [i, x] of plan.ratings.entries())
      await rate(
        db,
        FieldValue,
        Timestamp,
        'track',
        uid,
        x.track.id,
        x.halfStars,
        x.review,
        joined + ((i + 2) * DAY) / 2,
      );
    for (const [i, x] of plan.releaseRatings.entries())
      await rate(
        db,
        FieldValue,
        Timestamp,
        'release',
        uid,
        x.id,
        x.halfStars,
        x.review,
        joined + (i + 3) * DAY,
      );
    const notes = db.batch();
    plan.commented.forEach((c, i) =>
      notes.set(
        db.doc(`tracks/${c.track.id}/comments/${hash(`${uid}:${c.track.id}`).slice(0, 24)}`),
        {
          uid,
          body: c.body,
          createdAt: Timestamp.fromMillis(joined + (i + 4) * DAY),
          ...tag,
        },
      ),
    );
    await notes.commit();
    console.log(`seeded @${p.username}`);
  }
  // User follows after every profile exists, so follower counts resolve.
  const followBatch = db.batch();
  for (const [uid, targets] of follows)
    for (const target of targets)
      followBatch.set(db.doc(`users/${uid}/following/${target}`), {
        targetId: target,
        targetType: 'user',
        followedAt: Timestamp.fromMillis(now - rng(uid + target).int(1, 20) * DAY),
      });
  await followBatch.commit();

  if (owner) await seedOwnerInbox(db, Timestamp, owner.uid, plans);

  console.log('Waiting for save triggers before computing matches…');
  await new Promise((resolve) => setTimeout(resolve, 45000));
  const { computeMatchesFor } = await import('../functions/src/matching');
  for (const plan of plans) await computeMatchesFor(plan.uid);
  if (owner) await computeMatchesFor(owner.uid);
  console.log('Done.');
}

async function rate(
  db: FirebaseFirestore.Firestore,
  FieldValue: typeof FirebaseFirestore.FieldValue,
  Timestamp: typeof FirebaseFirestore.Timestamp,
  kind: 'track' | 'release',
  uid: string,
  itemId: string,
  halfStars: number,
  review: string,
  at: number,
) {
  const collection = kind === 'track' ? 'ratings' : 'releaseRatings';
  const ref = db.doc(`${collection}/${hash(`${uid}:${itemId}`)}`),
    itemRef = db.doc(`${kind === 'track' ? 'tracks' : 'releases'}/${itemId}`),
    userRef = db.doc(`users/${uid}`);
  await db.runTransaction(async (tx) => {
    const [old, item] = await Promise.all([tx.get(ref), tx.get(itemRef)]);
    if (old.exists || !item.exists) return;
    tx.set(ref, {
      uid,
      [kind === 'track' ? 'trackId' : 'releaseId']: itemId,
      halfStars,
      review,
      createdAt: Timestamp.fromMillis(at),
      updatedAt: Timestamp.fromMillis(at),
      testFixture: true,
    });
    tx.update(itemRef, {
      ratingCount: FieldValue.increment(1),
      ratingHalfStarSum: FieldValue.increment(halfStars),
    });
    const prefix = kind === 'track' ? '' : 'release';
    tx.update(userRef, {
      [prefix ? 'releaseRatingCount' : 'ratingCount']: FieldValue.increment(1),
      ...(review
        ? { [prefix ? 'releaseReviewCount' : 'reviewCount']: FieldValue.increment(1) }
        : {}),
    });
  });
}

/** A match DM, a stranger's request and a group so the owner's Inbox has every state. */
async function seedOwnerInbox(
  db: FirebaseFirestore.Firestore,
  Timestamp: typeof FirebaseFirestore.Timestamp,
  ownerUid: string,
  plans: { uid: string; persona: Persona; saved: Track[] }[],
) {
  const [matchPlan, strangerPlan, a, b, c] = [plans[0], plans[12], plans[1], plans[10], plans[18]];
  const start = Date.now() - 2 * DAY;
  async function conversation(
    id: string,
    type: 'dm' | 'group',
    memberIds: string[],
    name: string | null,
    lines: [string, string | { share: true }][],
    ownerState: 'inbox' | 'request',
  ) {
    const ref = db.doc(`conversations/${id}`);
    if ((await ref.get()).exists) return;
    const batch = db.batch();
    let last = null as null | {
      senderId: string;
      preview: string;
      at: FirebaseFirestore.Timestamp;
    };
    lines.forEach(([sender, content], i) => {
      const at = Timestamp.fromMillis(start + i * 7 * 60000);
      const plan = plans.find((p) => p.uid === sender)!;
      const track = typeof content === 'string' ? null : plan.saved[0];
      const body = typeof content === 'string' ? voice(plan.persona, content) : '';
      batch.set(ref.collection('messages').doc(hash(`${id}:${i}`).slice(0, 40)), {
        uid: sender,
        kind: track ? 'track' : 'text',
        body,
        trackId: track?.id || null,
        releaseId: null,
        createdAt: at,
        testFixture: true,
      });
      last = { senderId: sender, preview: track ? `Shared a track: ${track.title}` : body, at };
    });
    const shared = { type, memberIds, name, createdBy: memberIds[1] };
    batch.set(ref, {
      ...shared,
      lastMessage: last,
      lastMessageAt: last!.at,
      createdAt: Timestamp.fromMillis(start),
      testFixture: true,
    });
    for (const m of memberIds)
      batch.set(db.doc(`users/${m}/conversations/${id}`), {
        ...shared,
        state: m === ownerUid ? ownerState : 'inbox',
        lastMessage: last,
        lastMessageAt: last!.at,
        unread: m === ownerUid ? lines.filter(([s]) => s !== m).length : 0,
        readAt: m === ownerUid ? null : last!.at,
        requestCount: 0,
        testFixture: true,
      });
    await batch.commit();
  }
  const dm = (x: string) => `dm_${[ownerUid, x].sort().join('_')}`;
  await conversation(
    dm(matchPlan.uid),
    'dm',
    [ownerUid, matchPlan.uid],
    null,
    ownerConversations.match.map((l) => [matchPlan.uid, l]),
    'inbox',
  );
  await conversation(
    dm(strangerPlan.uid),
    'dm',
    [ownerUid, strangerPlan.uid],
    null,
    ownerConversations.request.map((l) => [strangerPlan.uid, l]),
    'request',
  );
  const roles: Record<string, string> = { a: a.uid, b: b.uid, c: c.uid };
  await conversation(
    `g_test_${hash(ownerUid).slice(0, 20)}`,
    'group',
    [ownerUid, a.uid, b.uid, c.uid],
    ownerConversations.group.name,
    ownerConversations.group.lines.map(([role, l]) => [roles[role], l]),
    'request',
  );
}

async function cleanup(db: FirebaseFirestore.Firestore) {
  const fakes = (
    await db.collection('_socialAccounts').where('testFixture', '==', true).get()
  ).docs.map((d) => d.id);
  console.log(`Removing ${fakes.length} test accounts…`);
  // Conversations first: they also live in real members' inboxes.
  const conversations = await db.collection('conversations').where('testFixture', '==', true).get();
  for (const c of conversations.docs) {
    await db.recursiveDelete(c.ref);
    for (const m of c.data().memberIds as string[])
      await db.doc(`users/${m}/conversations/${c.id}`).delete();
  }
  const matches = await db.collectionGroup('matches').get();
  for (const m of matches.docs) if (m.id.startsWith('test_')) await m.ref.delete();
  // Hide the accounts now; the deployed deletion pipeline reverses saves, follows, ratings
  // and comments, waits for triggers to settle, then removes the profiles.
  for (const uid of fakes) {
    await db
      .doc(`_socialAccounts/${uid}`)
      .set({ deleting: true, suspended: true }, { merge: true });
    const job = db.doc(`_accountDeletion/${uid}`);
    if (!(await job.get()).exists) await job.set({ stage: 0, complete: false, testFixture: true });
  }
  console.log(
    'Queued. The processAccountDeletions scheduler finishes in roughly 1–2 hours; rerun cleanup to check progress.',
  );
  const done = await db.getAll(...fakes.map((uid) => db.doc(`_accountDeletion/${uid}`)));
  console.log(`${done.filter((d) => d.data()?.complete).length}/${fakes.length} complete.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
