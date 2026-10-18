import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
  FieldPath,
  type DocumentData,
  type DocumentSnapshot,
  type Query,
} from 'firebase-admin/firestore';
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

type Source = 'rating' | 'releaseRating' | 'post';
type Position = [number, number, string];
type FeedCursor = { v: 2; until: number; positions: Record<Source, Position | null> };
const sources: Source[] = ['rating', 'releaseRating', 'post'];
function readFeedCursor(value: unknown): FeedCursor {
  if (value == null || (typeof value === 'number' && Number.isSafeInteger(value) && value > 0))
    return {
      v: 2,
      until: value == null ? Date.now() + 1 : (value as number),
      positions: { rating: null, releaseRating: null, post: null },
    };
  try {
    if (typeof value !== 'string' || value.length > 2048) throw Error();
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as FeedCursor;
    if (
      parsed.v !== 2 ||
      !Number.isSafeInteger(parsed.until) ||
      parsed.until <= 0 ||
      !parsed.positions
    )
      throw Error();
    for (const source of sources) {
      const p = parsed.positions[source];
      if (
        p !== null &&
        (!Array.isArray(p) ||
          p.length !== 3 ||
          !Number.isSafeInteger(p[0]) ||
          p[0] < 0 ||
          !Number.isInteger(p[1]) ||
          p[1] < 0 ||
          p[1] >= 1e9 ||
          typeof p[2] !== 'string' ||
          !/^[a-zA-Z0-9_-]{1,128}$/.test(p[2]))
      )
        throw Error();
    }
    return parsed;
  } catch {
    throw new HttpsError('invalid-argument', 'Invalid page cursor.');
  }
}
type Item = {
  id: string;
  position: Position;
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
  const cursorState = readFeedCursor(r.data?.cursor);
  const until = Timestamp.fromMillis(cursorState.until);
  const taste = await loadTaste(c.uid, c.user);
  const specs = [
    ['rating', 'ratings', 'createdAt'],
    ['releaseRating', 'releaseRatings', 'createdAt'],
    ['post', 'posts', 'publishedAt'],
  ] as const;
  const [ratings, releaseRatings, posts] = await Promise.all(
    specs.map(async ([source, collection, field]) => {
      let q: Query = db.collection(collection);
      if (source === 'post') q = q.where('status', '==', 'published');
      q = q.where(field, '<', until).orderBy(field, 'desc').orderBy(FieldPath.documentId(), 'desc');
      const after = cursorState.positions[source];
      if (after) q = q.startAfter(new Timestamp(after[0], after[1]), after[2]);
      return q.limit(SCAN).get();
    }),
  );
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
    candidates.push({
      id: d.id,
      position: [p.createdAt.seconds, p.createdAt.nanoseconds, d.id],
      type: 'rating',
      at: p.createdAt?.toMillis() || 0,
      reason: reason || '',
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
    candidates.push({
      id: d.id,
      position: [p.createdAt.seconds, p.createdAt.nanoseconds, d.id],
      type: 'releaseRating',
      at: p.createdAt?.toMillis() || 0,
      reason: reason || '',
      data: serialize(d.id, p),
    });
  }
  for (const d of posts.docs) {
    const p = d.data();

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
    candidates.push({
      id: d.id,
      position: [p.publishedAt.seconds, p.publishedAt.nanoseconds, d.id],
      type: 'post',
      at: p.publishedAt?.toMillis() || 0,
      reason: reason || '',
      data: { id: d.id, p },
    });
  }

  candidates.sort(
    (a, b) =>
      b.position[0] - a.position[0] ||
      b.position[1] - a.position[1] ||
      (a.type < b.type ? 1 : a.type > b.type ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
  );
  const counts = { rating: 0, releaseRating: 0, post: 0 };
  const sizes = { rating: ratings.size, releaseRating: releaseRatings.size, post: posts.size };
  const visible = new Map<string, boolean>();
  const items: Item[] = [];
  let last = 0;
  let hasMore = false;
  for (const item of candidates) {
    cursorState.positions[item.type] = item.position;
    counts[item.type]++;
    last = item.at;
    const boundary = counts[item.type] === SCAN;
    if (
      !item.reason ||
      (item.type === 'post' && (item.data as { p: DocumentData }).p.purpose === 'profile')
    ) {
      if (boundary) {
        hasMore = true;
        break;
      }
      continue;
    }
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
    if (!visible.get(author)) {
      if (boundary) {
        hasMore = true;
        break;
      }
      continue;
    }
    if (item.type === 'post') {
      const { id, p } = item.data as { id: string; p: DocumentData };
      item.data = await postDTO(id, p, c.uid);
    }
    items.push(item);
    if (items.length === PAGE || boundary) {
      hasMore = true;
      break;
    }
  }
  hasMore =
    hasMore && sources.some((source) => counts[source] < sizes[source] || sizes[source] === SCAN);
  // Old installed clients expect a number. Updated clients request the tie-safe cursor.
  const cursor = !hasMore
    ? null
    : r.data?.cursorVersion === 2
      ? Buffer.from(JSON.stringify(cursorState)).toString('base64url')
      : last;
  return { items: items.map(({ id: _id, position: _position, ...item }) => item), cursor };
});
