import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldPath, type DocumentData, type DocumentSnapshot } from 'firebase-admin/firestore';
import { db, rateLimit } from './core';
import { blocked, postDTO, socialContext, Timestamp } from './social-core';
import { postReason, ratingReason, releaseRatingReason, type Taste } from '../../shared/for-you';

// Each page scans this many recent documents per source before filtering for relevance.
const SCAN = 120;
const PAGE = 25;

async function getAll(paths: string[]) {
  const unique = [...new Set(paths)];
  const out = new Map<string, DocumentSnapshot>();
  for (let i = 0; i < unique.length; i += 100) {
    const docs = await db.getAll(...unique.slice(i, i + 100).map((p) => db.doc(p)));
    docs.forEach((d) => out.set(d.ref.path, d));
  }
  return out;
}

async function loadTaste(uid: string, user: DocumentData): Promise<Taste> {
  const [saves, following] = await Promise.all([
    db.collection(`users/${uid}/saves`).orderBy('savedAt', 'desc').limit(500).get(),
    db.collection(`users/${uid}/following`).get(),
  ]);
  const artists = new Map<string, string>(),
    producers = new Map<string, string>();
  for (const s of saves.docs) {
    const d = s.data();
    if (d.artistId) artists.set(d.artistId, d.artistName || '');
    if (d.producerId && !producers.has(d.producerId)) producers.set(d.producerId, '');
  }
  const followed = following.docs.map((f) => ({ id: f.id, type: f.data().targetType }));
  const named = await getAll(
    followed
      .filter((f) => f.type === 'artist' || f.type === 'producer')
      .map((f) => `${f.type === 'artist' ? 'artists' : 'producers'}/${f.id}`)
      .concat([...producers.keys()].map((id) => `producers/${id}`)),
  );
  for (const f of followed) {
    const name = named.get(`${f.type}s/${f.id}`)?.data()?.name || '';
    if (f.type === 'artist') artists.set(f.id, artists.get(f.id) || name);
    if (f.type === 'producer') producers.set(f.id, name);
  }
  for (const id of producers.keys())
    producers.set(id, producers.get(id) || named.get(`producers/${id}`)?.data()?.name || '');
  return {
    uid,
    savedTracks: new Set(saves.docs.map((s) => s.id)),
    favoriteTracks: new Set(user.favoriteTrackIds || []),
    favoriteReleases: new Set(user.favoriteReleaseIds || []),
    artists,
    producers,
    followedUsers: new Set(followed.filter((f) => f.type === 'user').map((f) => f.id)),
    scenes: new Set(user.scenes || []),
  };
}

function serialize(id: string, p: DocumentData) {
  return {
    id,
    ...Object.fromEntries(
      Object.entries(p)
        .filter(([k]) => !k.startsWith('pending') && k !== 'testFixture')
        .map(([k, v]) => [k, v?.toMillis ? { millis: v.toMillis() } : v]),
    ),
  };
}

type Item = {
  type: 'rating' | 'releaseRating' | 'post';
  at: number;
  reason: string;
  data: unknown;
};

/**
 * One page of the personalised feed: reviews and posts from across the community that
 * touch the listener's saves, favorites, artists, producers, follows or scenes, newest
 * first, each with the reason it was chosen.
 */
export const readForYou = onCall(async (r) => {
  const c = await socialContext(r);
  await rateLimit(c.uid, 'communityRead', 1200);
  const before = r.data?.cursor == null ? Date.now() + 1 : Number(r.data.cursor);
  if (!Number.isFinite(before) || before <= 0)
    throw new HttpsError('invalid-argument', 'Invalid page cursor.');
  const until = Timestamp.fromMillis(before);
  const taste = await loadTaste(c.uid, c.user);
  const [ratings, releaseRatings, posts] = await Promise.all([
    db
      .collection('ratings')
      .where('createdAt', '<', until)
      .orderBy('createdAt', 'desc')
      .limit(SCAN)
      .get(),
    db
      .collection('releaseRatings')
      .where('createdAt', '<', until)
      .orderBy('createdAt', 'desc')
      .limit(SCAN)
      .get(),
    db
      .collection('posts')
      .where('status', '==', 'published')
      .where('publishedAt', '<', until)
      .orderBy('publishedAt', 'desc')
      .orderBy(FieldPath.documentId(), 'desc')
      .limit(SCAN)
      .get(),
  ]);
  const catalog = await getAll([
    ...ratings.docs.map((d) => `tracks/${d.data().trackId}`),
    ...releaseRatings.docs.map((d) => `releases/${d.data().releaseId}`),
    ...posts.docs.flatMap((d) => {
      const a = d.data().attachment;
      return a?.kind === 'track'
        ? [`tracks/${a.id}`]
        : a?.kind === 'release'
          ? [`releases/${a.id}`]
          : [];
    }),
  ]);

  // Only the time range every full scan covered is complete; older items wait for the next page.
  const scans = [
    { snap: ratings, field: 'createdAt' },
    { snap: releaseRatings, field: 'createdAt' },
    { snap: posts, field: 'publishedAt' },
  ];
  const floor = Math.max(
    0,
    ...scans
      .filter((s) => s.snap.size === SCAN)
      .map((s) => s.snap.docs.at(-1)!.data()[s.field]?.toMillis() || 0),
  );
  const candidates: Item[] = [];
  for (const d of ratings.docs) {
    const p = d.data(),
      track = catalog.get(`tracks/${p.trackId}`)?.data();
    const reason = ratingReason(taste, {
      authorUid: p.uid,
      trackId: p.trackId,
      artistId: track?.artistId,
      artistName: track?.artistName,
      producerId: track?.producerId,
      producerName: track?.producerName,
      hasReview: !!p.review,
    });
    if (reason)
      candidates.push({
        type: 'rating',
        at: p.createdAt?.toMillis() || 0,
        reason,
        data: serialize(d.id, p),
      });
  }
  for (const d of releaseRatings.docs) {
    const p = d.data(),
      release = catalog.get(`releases/${p.releaseId}`)?.data();
    const reason = releaseRatingReason(taste, {
      authorUid: p.uid,
      releaseId: p.releaseId,
      artistId: release?.artistId,
      artistName: release?.artistName,
      hasReview: !!p.review,
    });
    if (reason)
      candidates.push({
        type: 'releaseRating',
        at: p.createdAt?.toMillis() || 0,
        reason,
        data: serialize(d.id, p),
      });
  }
  for (const d of posts.docs) {
    const p = d.data();
    if (p.purpose === 'profile') continue;
    const a = p.attachment,
      attached = a
        ? catalog.get(`${a.kind === 'track' ? 'tracks' : 'releases'}/${a.id}`)?.data()
        : null;
    const reason = postReason(taste, {
      authorUid: p.uid,
      attachment: a || null,
      scenes: p.scenes || [],
      attachedArtistId: attached?.artistId,
      attachedArtistName: attached?.artistName,
    });
    if (reason)
      candidates.push({
        type: 'post',
        at: p.publishedAt?.toMillis() || 0,
        reason,
        data: { id: d.id, p },
      });
  }

  candidates.sort((a, b) => b.at - a.at);
  const visible = new Map<string, boolean>();
  const items: Item[] = [];
  let last = 0;
  for (const item of candidates) {
    if (item.at <= floor) break;
    const author =
      item.type === 'post'
        ? (item.data as { p: DocumentData }).p.uid
        : (item.data as { uid: string }).uid;
    if (!visible.has(author)) {
      const account = (await db.doc(`_socialAccounts/${author}`).get()).data();
      visible.set(
        author,
        !account?.suspended && !account?.deleting && !(await blocked(c.uid, author)),
      );
    }
    if (!visible.get(author)) continue;
    if (item.type === 'post') {
      const { id, p } = item.data as { id: string; p: DocumentData };
      item.data = await postDTO(id, p, c.uid, c.flags.playback === true || c.admin);
    }
    items.push(item);
    last = item.at;
    if (items.length === PAGE) break;
  }
  const cursor = items.length === PAGE ? last : floor > 0 ? floor : null;
  return { items, cursor };
});
