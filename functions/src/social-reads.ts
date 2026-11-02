import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldPath, type Query, type DocumentData } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { db, hash, rateLimit } from './core';
import { searchText } from '../../shared/catalog-search';
import {
  authorVisibility,
  followedPage,
  followsUser,
  invalidateCommunity,
  makeCursor,
  mediaDTO,
  readCursor,
  socialContext,
  socialId,
} from './social-core';

/** Name and avatar for list rows; blocked, suspended, deleting and missing accounts are left out. */
async function rowProfiles(viewer: string, ids: string[], completeOnly = false) {
  if (!ids.length) return [];
  const [profiles, accounts, blocks] = await Promise.all([
    db.getAll(...ids.map((id) => db.doc(`users/${id}`))),
    db.getAll(...ids.map((id) => db.doc(`_socialAccounts/${id}`))),
    db.getAll(
      ...ids.flatMap((id) => [
        db.doc(`_socialBlocks/${hash(`${viewer}:${id}`)}`),
        db.doc(`_socialBlocks/${hash(`${id}:${viewer}`)}`),
      ]),
    ),
  ]);
  const rows = await Promise.all(
    ids.map(async (id, i) => {
      const p = profiles[i].data(),
        account = accounts[i].data(),
        hidden = id !== viewer && (blocks[i * 2].exists || blocks[i * 2 + 1].exists);
      if (!p || hidden || account?.suspended || account?.deleting) return [];
      if (completeOnly && !p.onboardingComplete) return [];
      const avatar = p.avatarMediaId ? await mediaDTO(p.avatarMediaId) : null;
      return [{ id, username: p.username || '', avatarUrl: avatar?.url || p.avatarUrl || '' }];
    }),
  );
  return rows.flat();
}
function serialize(p: DocumentData) {
  return Object.fromEntries(
    Object.entries(p)
      .filter(([k]) => !k.startsWith('pending'))
      .map(([k, v]) => [k, v?.toMillis ? { millis: v.toMillis() } : v]),
  );
}
/** All cross-account community reads are authorized here, not by client filtering. */
export const readCommunity = onCall(async (r) => {
  const { uid } = await socialContext(r);
  await rateLimit(uid, 'communityRead', 1200);
  const visible = authorVisibility(uid),
    follows = followsUser(uid);
  const kind = r.data?.kind;
  if (
    r.data?.search != null &&
    (kind !== 'saves' || typeof r.data.search !== 'string' || r.data.search.length > 100)
  )
    throw new HttpsError('invalid-argument', 'Saved-track search must be at most 100 characters.');
  const needle = kind === 'saves' ? searchText(r.data?.search || '') : '';
  if (
    r.data?.following &&
    (!['ratings', 'releaseRatings', 'activity'].includes(kind) || r.data?.highest)
  )
    throw new HttpsError('invalid-argument', 'Following activity uses chronological pages.');
  const author = r.data?.uid ? socialId(r.data.uid) : null;
  if (author && !(await visible(author))) throw new HttpsError('not-found', 'Profile unavailable.');
  if (kind === 'reviewSubmission') {
    const collection = r.data?.release === true ? 'releaseRatings' : 'ratings';
    const id = hash(`review:${collection}:${uid}:${socialId(r.data?.itemId)}`);
    const draft = await db.doc(`_textSubmissions/${id}`).get();
    return { items: draft.exists ? [{ id, ...serialize(draft.data()!) }] : [], cursor: null };
  }
  if (kind === 'blockedUsers') {
    // This owner-only management view exposes identity, never blocked content.
    let q = db.collection(`users/${uid}/blockedUsers`).orderBy(FieldPath.documentId());
    if (r.data?.cursor != null) q = q.startAfter(socialId(r.data.cursor));
    const docs = await q.limit(26).get();
    const page = docs.docs.slice(0, 25);
    const items = await Promise.all(
      page.map(async (entry) => {
        const [profile, account] = await db.getAll(
          db.doc(`users/${entry.id}`),
          db.doc(`_socialAccounts/${entry.id}`),
        );
        const unavailable =
          !profile.exists || account.data()?.suspended || account.data()?.deleting;
        // Published username only. Pending profile revisions live elsewhere.
        return { id: entry.id, username: unavailable ? null : profile.data()?.username || null };
      }),
    );
    return { items, cursor: docs.size > 25 ? page[page.length - 1].id : null };
  }

  if (kind === 'profiles') {
    // Rows need only a name and avatar; one batched read replaces a request per row.
    const requested = r.data?.uids;
    if (!Array.isArray(requested) || !requested.length || requested.length > 30)
      throw new HttpsError('invalid-argument', 'Choose up to 30 profiles.');
    return { items: await rowProfiles(uid, [...new Set(requested.map(socialId))]), cursor: null };
  }
  if (kind === 'listeners') {
    const name = typeof r.data?.name === 'string' ? r.data.name.trim().replace(/^@/, '') : '';
    const prefix = name.toLowerCase();
    if (!/^[a-z0-9_]{2,20}$/.test(prefix))
      throw new HttpsError('invalid-argument', 'Search with at least two username characters.');
    const after = r.data?.cursor == null ? null : socialId(r.data.cursor);
    const base = db.collection('usernames').orderBy(FieldPath.documentId());
    const names = await (after ? base.startAfter(after) : base.startAt(prefix))
      .endAt(`${prefix}\uf8ff`)
      .limit(26)
      .get();
    const page = names.docs.slice(0, 25);
    const ids = [...new Set(page.map((d) => d.data().uid as string))].filter((id) => id !== uid);
    return {
      items: await rowProfiles(uid, ids, true),
      cursor: names.size > 25 ? page[page.length - 1].id : null,
    };
  }
  if (kind === 'followers' || kind === 'following') {
    if (!author) throw new HttpsError('invalid-argument', 'Choose a profile.');
    const targetType = r.data?.targetType ?? 'user';
    if (kind === 'followers' && targetType !== 'user')
      throw new HttpsError('invalid-argument', 'Followers are listeners.');
    if (!['user', 'artist', 'producer'].includes(targetType))
      throw new HttpsError('invalid-argument', 'Unknown follow type.');
    const after = readCursor(r.data?.cursor);
    // Newest follows first; `followedAt` is required by the rules on every follow.
    let q: Query =
      kind === 'following'
        ? db
            .collection(`users/${author}/following`)
            .where('targetType', '==', targetType)
            .orderBy('followedAt', 'desc')
            .orderBy(FieldPath.documentId(), 'desc')
        : db
            .collectionGroup('following')
            .where('targetId', '==', author)
            .orderBy('followedAt', 'desc')
            .orderBy(FieldPath.documentId(), 'desc');
    if (after)
      q = q.startAfter(
        after[0],
        kind === 'following' ? after[1] : db.doc(`users/${after[1]}/following/${author}`),
      );
    const docs = await q.limit(26).get();
    const page = docs.docs.slice(0, 25);
    const ids = page.map((d) => (kind === 'following' ? d.id : d.ref.parent.parent!.id));
    const last = page[page.length - 1];
    const cursor =
      docs.size > 25 && last ? makeCursor(last.data().followedAt, ids[ids.length - 1]) : null;
    if (targetType !== 'user') {
      // Artists and producers are public catalog records; no block or suspension checks apply.
      const docsById = await db.getAll(...ids.map((id) => db.doc(`${targetType}s/${id}`)));
      return {
        items: docsById.flatMap((d) =>
          d.exists
            ? [{ id: d.id, name: d.data()!.name || '', imageUrl: d.data()!.imageUrl || '' }]
            : [],
        ),
        cursor,
      };
    }
    return { items: await rowProfiles(uid, ids), cursor };
  }
  if (kind === 'profile') {
    if (!author) throw new HttpsError('invalid-argument', 'Choose a profile.');
    const d = await db.doc(`users/${author}`).get();
    if (!d.exists) throw new HttpsError('not-found', 'Profile unavailable.');
    const p = d.data()!;
    const avatar = p.avatarMediaId ? await mediaDTO(p.avatarMediaId) : null;
    const keys = [
      'username',
      'bio',
      'avatarUrl',
      'saveCount',
      'followerCount',
      'ratingCount',
      'reviewCount',
      'releaseRatingCount',
      'releaseReviewCount',
      'favoriteTrackIds',
      'favoriteReleaseIds',
      'scenes',
      'onboardingComplete',
    ];
    const following = await db
      .collection(`users/${author}/following`)
      .where('targetType', '==', 'user')
      .count()
      .get();
    return {
      items: [
        {
          id: d.id,
          followingCount: following.data().count,
          ...Object.fromEntries(keys.filter((k) => p[k] !== undefined).map((k) => [k, p[k]])),
          ...(avatar?.url ? { avatarUrl: avatar.url } : {}),
        },
      ],
      cursor: null,
    };
  }
  let q: Query,
    field = 'createdAt';
  if (kind === 'ratings' || kind === 'releaseRatings') {
    q = db.collection(kind);
    if (author) q = q.where('uid', '==', author);
    else if (!r.data?.following)
      q = q.where(kind === 'ratings' ? 'trackId' : 'releaseId', '==', socialId(r.data?.itemId));
    if (r.data?.highest === true) {
      q = q.where('halfStars', '>=', 8).orderBy('halfStars', 'desc');
      field = 'updatedAt';
    }
  } else if (kind === 'trackComments') {
    q = db.collection(`tracks/${socialId(r.data?.itemId)}/comments`);
  } else if (kind === 'activity' && r.data?.following) {
    q = db.collection('activity');
    field = 'savedAt';
  } else if (kind === 'saves' && author) {
    q = db.collection(`users/${author}/saves`);
    field = 'savedAt';
  } else if (kind === 'leaders') {
    q = db.collectionGroup('rotation').where('entityId', '==', socialId(r.data?.itemId));
    field = 'score';
  } else if ((kind === 'rotation' || kind === 'leaders') && author) {
    q = db.collection(`users/${author}/rotation`);
    field = 'score';
  } else if (kind === 'textSubmissions') {
    q = db.collection('_textSubmissions').where('uid', '==', uid);
  } else throw new HttpsError('invalid-argument', 'Unknown community view.');
  const ascending = kind === 'trackComments';
  q = q
    .orderBy(field, ascending ? 'asc' : 'desc')
    .orderBy(FieldPath.documentId(), ascending ? 'asc' : 'desc');
  if (r.data?.cursor) {
    if (r.data.highest || kind === 'rotation' || kind === 'leaders') {
      const parts = String(r.data.cursor).split('|');
      if (!/^\d+(\.\d+)?$/.test(parts[0]))
        throw new HttpsError('invalid-argument', 'Invalid cursor.');
      const rest = readCursor(parts[1]);
      if (!rest) throw new HttpsError('invalid-argument', 'Invalid cursor.');
      q = q.startAfter(
        Number(parts[0]),
        ...(kind === 'rotation' || kind === 'leaders' ? [rest[1]] : rest),
      );
    } else if (!r.data?.following) q = q.startAfter(...readCursor(r.data.cursor)!);
  }
  const docs = r.data?.following
      ? await followedPage(
          uid,
          q,
          kind === 'activity' ? 'actorUid' : 'uid',
          field,
          readCursor(r.data?.cursor),
        )
      : await q.limit(250).get(),
    items = [];
  let cursor = null;
  for (const d of docs.docs) {
    const p = d.data(),
      who = p.uid || p.actorUid || author;
    cursor =
      kind === 'rotation' || kind === 'leaders'
        ? `${p.score}|0:${d.id}`
        : `${r.data?.highest ? `${p.halfStars}|` : ''}${makeCursor(p[field], d.id)}`;
    // The library owner was authorized above. Search the complete saved metadata,
    // not just the client's currently loaded catalog references.
    if (
      kind === 'saves' &&
      needle &&
      !searchText(
        [p.title, p.artistName, p.producerName].filter((v) => typeof v === 'string').join(' '),
      ).includes(needle)
    )
      continue;
    if (who && kind !== 'saves' && !(await visible(who))) continue;
    if (r.data?.following && who !== uid && !(await follows(who))) continue;
    // Owner-only view: preview a pending profile photo before it is approved.
    const photo =
      kind === 'textSubmissions' && p.status === 'pending' && p.photoMediaId
        ? await mediaDTO(p.photoMediaId)
        : null;
    items.push({ id: d.id, ...serialize(p), ...(photo?.url ? { photoUrl: photo.url } : {}) });
    if (items.length === 25) break;
  }
  return { items, cursor: docs.size === 250 || items.length === 25 ? cursor : null };
});
// Small invalidation records keep server-authorized pages current without exposing documents.
const invalidate = () => invalidateCommunity();
const PUBLIC_PROFILE_FIELDS = [
  'username',
  'bio',
  'avatarUrl',
  'avatarMediaId',
  'scenes',
  'favoriteTrackIds',
  'favoriteReleaseIds',
];
/** Counters and bookkeeping change constantly; only what listeners see is worth signaling. */
export const publicProfileChanged = (before?: DocumentData, after?: DocumentData) =>
  PUBLIC_PROFILE_FIELDS.some(
    (key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]),
  );
export const communityRatingChanged = onDocumentWritten('ratings/{id}', invalidate);
export const communityReleaseRatingChanged = onDocumentWritten('releaseRatings/{id}', invalidate);
export const communityProfileChanged = onDocumentWritten('users/{uid}', async (event) => {
  if (publicProfileChanged(event.data?.before.data(), event.data?.after.data()))
    await invalidateCommunity();
});
export const communityActivityChanged = onDocumentWritten('activity/{id}', invalidate);
export const communityPostChanged = onDocumentWritten('posts/{id}', invalidate);
export const communityPostCommentChanged = onDocumentWritten('_postComments/{id}', invalidate);
export const communityDiscussionChanged = onDocumentWritten(
  'tracks/{track}/comments/{id}',
  invalidate,
);
