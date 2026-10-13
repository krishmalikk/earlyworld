/**
 * Seeds or removes tagged test posts written by the fake `test_` listeners.
 *
 *   GCLOUD_PROJECT=<id> npx tsx scripts/test-posts.ts plan --owner USERNAME
 *   GCLOUD_PROJECT=<id> npx tsx scripts/test-posts.ts apply --production --owner USERNAME
 *   GCLOUD_PROJECT=<id> npx tsx scripts/test-posts.ts cleanup --production
 *
 * Posts mention the owner's saved artists and tracks (and other catalog music) so the
 * For You feed has something to match. Each post has a published `_postDrafts` twin, so
 * the account-deletion pipeline removes it with its fake author; `cleanup` also deletes
 * every post tagged `testFixture: true` directly.
 */
import { createHash } from 'node:crypto';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldPath, Timestamp } from 'firebase-admin/firestore';

const [command = 'plan'] = process.argv.slice(2);
const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) throw Error('Set GCLOUD_PROJECT.');
if (!['plan', 'apply', 'cleanup'].includes(command))
  throw Error('Usage: test-posts.ts plan|apply|cleanup [--production] [--owner USERNAME]');
if (
  command !== 'plan' &&
  !process.env.FIRESTORE_EMULATOR_HOST &&
  !process.argv.includes('--production')
)
  throw Error('Writing to a live project requires --production.');
const ownerName = process.argv.includes('--owner')
  ? process.argv[process.argv.indexOf('--owner') + 1]?.replace(/^@/, '').toLowerCase()
  : null;
initializeApp({
  projectId,
  ...(!process.env.FIRESTORE_EMULATOR_HOST ? { credential: applicationDefault() } : {}),
});
const db = getFirestore();
const DAY = 86400000;
const POSTS = 36;

function rng(seed: string) {
  let a = parseInt(createHash('sha256').update(seed).digest('hex').slice(0, 8), 16);
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T>(list: T[]) => list[Math.floor(next() * list.length)],
  };
}

// Original copy in the voice of underground listeners. `{x}` is the mentioned name.
const artistLines = [
  'been running {x} back all week, nobody is doing it like this right now',
  '{x} snippet season again and my phone storage is crying',
  'if {x} drops this weekend I am not leaving my room',
  'hot take: {x} deep cuts > the singles',
  'saw {x} in a basement show last year with like 40 people. remember that',
  '{x} production choices lately are actually so interesting',
];
const trackLines = [
  '{x} on repeat. the beat switch at the end is unreal',
  'whoever has not heard {x} yet, this is your sign',
  '{x} is the kind of song you only find at 3am',
  'played {x} in the car and my friend asked who it was. we are so back',
  '{x} sounds like winter and I mean that as a compliment',
  'the mix on {x} is so muddy and that is exactly why it works',
];
const producerLines = [
  '{x} beats have a sound you can spot in two seconds',
  'every time I see prod. {x} I already know',
];

type Track = { id: string; title: string; artistId: string; artistName: string };

async function testAccounts() {
  const snap = await db
    .collection('users')
    .where(FieldPath.documentId(), '>=', 'test_')
    .where(FieldPath.documentId(), '<', 'test`')
    .get();
  return snap.docs.map((d) => ({ uid: d.id, scenes: (d.data().scenes as string[]) || [] }));
}

async function plan() {
  if (!ownerName) throw Error('Pass --owner USERNAME so posts can mention their music.');
  const reservation = (await db.doc(`usernames/${ownerName}`).get()).data();
  const ownerUid: string | undefined = reservation?.uid;
  if (!ownerUid) throw Error(`No account owns @${ownerName}.`);
  const authors = await testAccounts();
  if (!authors.length) throw Error('No test_ accounts. Run the test-community seeder first.');
  const saves = await db.collection(`users/${ownerUid}/saves`).limit(200).get();
  const saved: Track[] = saves.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Track, 'id'>) }));
  const artists = new Map(saved.map((t) => [t.artistId, t.artistName]));
  const moreByArtists: Track[] = [];
  const artistIds = [...artists.keys()];
  for (let i = 0; i < artistIds.length; i += 30) {
    const snap = await db
      .collection('tracks')
      .where('artistId', 'in', artistIds.slice(i, i + 30))
      .limit(60)
      .get();
    moreByArtists.push(
      ...snap.docs
        .filter((d) => !saves.docs.some((s) => s.id === d.id))
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Track, 'id'>) })),
    );
  }
  const elsewhere = (
    await db.collection('tracks').orderBy('saveCount', 'desc').limit(80).get()
  ).docs
    .filter((d) => !artists.has(d.data().artistId))
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Track, 'id'>) }));
  const producers = new Map<string, string>();
  for (const s of saves.docs) {
    const pid = s.data().producerId;
    if (pid && !producers.has(pid))
      producers.set(pid, (await db.doc(`producers/${pid}`).get()).data()?.name || '');
  }
  const r = rng(`posts:${ownerUid}`);
  const now = Date.now();
  return Array.from({ length: POSTS }, (_, i) => {
    const author = r.pick(authors);
    const roll = r.next();
    let attachment: { kind: string; id: string; label: string }, text: string;
    if (roll < 0.35 && artists.size) {
      const id = r.pick(artistIds);
      attachment = { kind: 'artist', id, label: artists.get(id)! };
      text = r.pick(artistLines);
    } else if (roll < 0.6 && saved.length) {
      const t = r.pick(saved);
      attachment = { kind: 'track', id: t.id, label: t.title };
      text = r.pick(trackLines);
    } else if (roll < 0.75 && moreByArtists.length) {
      const t = r.pick(moreByArtists);
      attachment = { kind: 'track', id: t.id, label: t.title };
      text = r.pick(trackLines);
    } else if (roll < 0.82 && producers.size) {
      const [id, name] = r.pick([...producers.entries()].filter(([, n]) => n));
      attachment = { kind: 'producer', id, label: name };
      text = r.pick(producerLines);
    } else {
      const t = r.pick(elsewhere.length ? elsewhere : saved);
      attachment = { kind: 'track', id: t.id, label: t.title };
      text = r.pick(trackLines);
    }
    return {
      id: `test_post_${String(i + 1).padStart(2, '0')}`,
      uid: author.uid,
      text: text.replace('{x}', attachment.label),
      attachment,
      scenes: author.scenes.slice(0, 2),
      at: now - r.int(1, 10 * 24) * (DAY / 24),
    };
  });
}

async function main() {
  if (command === 'cleanup') {
    const posts = await db.collection('posts').where('testFixture', '==', true).get();
    const drafts = await db.collection('_postDrafts').where('testFixture', '==', true).get();
    const batch = db.batch();
    [...posts.docs, ...drafts.docs].forEach((d) => batch.delete(d.ref));
    await batch.commit();
    console.log(`Removed ${posts.size} posts and ${drafts.size} drafts.`);
    return;
  }
  const rows = await plan();
  const kinds = rows.reduce<Record<string, number>>((n, p) => {
    n[p.attachment.kind] = (n[p.attachment.kind] || 0) + 1;
    return n;
  }, {});
  console.log(JSON.stringify({ posts: rows.length, attachments: kinds }, null, 2));
  for (const p of rows.slice(0, 6)) console.log(`  ${p.uid}: ${p.text}`);
  if (command === 'plan') return;
  const batch = db.batch();
  for (const p of rows) {
    const content = {
      kind: 'post',
      text: p.text,
      scenes: p.scenes,
      attachment: p.attachment,
      mediaIds: [],
    };
    const stamp = Timestamp.fromMillis(p.at);
    batch.set(db.doc(`posts/${p.id}`), {
      ...content,
      uid: p.uid,
      version: 1,
      status: 'published',
      publishedAt: stamp,
      updatedAt: stamp,
      likeCount: 0,
      commentCount: 0,
      testFixture: true,
    });
    batch.set(db.doc(`_postDrafts/${p.id}`), {
      ...content,
      uid: p.uid,
      version: 1,
      status: 'published',
      createdAt: stamp,
      updatedAt: stamp,
      testFixture: true,
    });
  }
  await batch.commit();
  console.log(`Wrote ${rows.length} posts to ${projectId}.`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
