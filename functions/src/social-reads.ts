import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldPath, Timestamp, type Query, type DocumentData } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { db, FieldValue, hash, rateLimit } from './core';
import {
  canView,
  followedPage,
  makeCursor,
  publicProfile,
  readCursor,
  socialContext,
  socialId,
} from './social-core';

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
  const kind = r.data?.kind;
  if (
    r.data?.following &&
    (!['ratings', 'releaseRatings', 'activity'].includes(kind) || r.data?.highest)
  )
    throw new HttpsError('invalid-argument', 'Following activity uses chronological pages.');
  const author = r.data?.uid ? socialId(r.data.uid) : null;
  if (author && !(await canView(uid, author)))
    throw new HttpsError('not-found', 'Profile unavailable.');
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

  if (kind === 'profile') {
    if (!author) throw new HttpsError('invalid-argument', 'Choose a profile.');
    const d = await db.doc(`users/${author}`).get();
    if (!d.exists) throw new HttpsError('not-found', 'Profile unavailable.');
    return { items: [await publicProfile(d.id, d.data()!)], cursor: null };
  }
  if (kind === 'profiles') {
    // Batched identities for inbox and member lists; unavailable listeners are omitted.
    const ids = r.data?.uids;
    if (!Array.isArray(ids) || ids.length > 30)
      throw new HttpsError('invalid-argument', 'Choose up to 30 profiles.');
    const unique = [...new Set(ids.map(socialId))];
    const docs = unique.length ? await db.getAll(...unique.map((id) => db.doc(`users/${id}`))) : [];
    const items = [];
    for (const d of docs)
      if (d.exists && d.data()!.onboardingComplete && (await canView(uid, d.id)))
        items.push(await publicProfile(d.id, d.data()!));
    return { items, cursor: null };
  }
  if (kind === 'followers' || kind === 'followingUsers') {
    // Owner-only relationship lists used to start conversations.
    let q: Query =
      kind === 'followers'
        ? db
            .collectionGroup('following')
            .where('targetId', '==', uid)
            .where('targetType', '==', 'user')
        : db.collection(`users/${uid}/following`).where('targetType', '==', 'user');
    q = q.orderBy('followedAt', 'desc');
    if (r.data?.cursor != null) {
      if (typeof r.data.cursor !== 'string' || !/^\d{1,16}$/.test(r.data.cursor))
        throw new HttpsError('invalid-argument', 'Invalid cursor.');
      q = q.startAfter(Timestamp.fromMillis(Number(r.data.cursor)));
    }
    const page = await q.limit(25).get();
    const ids = page.docs.map((d) => (kind === 'followers' ? d.ref.parent.parent!.id : d.id));
    const users = ids.length ? await db.getAll(...ids.map((id) => db.doc(`users/${id}`))) : [];
    const items = [];
    for (const d of users)
      if (d.exists && d.data()!.onboardingComplete && (await canView(uid, d.id)))
        items.push(await publicProfile(d.id, d.data()!));
    const last = page.docs.at(-1)?.data().followedAt;
    return { items, cursor: page.size === 25 && last ? String(last.toMillis()) : null };
  }
  if (kind === 'suggestedListeners') {
    // Cold-start suggestions: listeners sharing a scene whom the viewer doesn't already follow.
    const me = (await db.doc(`users/${uid}`).get()).data();
    const scenes: string[] = (me?.scenes || []).slice(0, 10);
    if (!scenes.length) return { items: [], cursor: null };
    const [candidates, following] = await Promise.all([
      db.collection('users').where('scenes', 'array-contains-any', scenes).limit(60).get(),
      db.collection(`users/${uid}/following`).where('targetType', '==', 'user').get(),
    ]);
    const followed = new Set(following.docs.map((d) => d.id));
    const items = [];
    for (const d of candidates.docs) {
      const p = d.data();
      if (d.id === uid || followed.has(d.id) || !p.onboardingComplete || !p.username) continue;
      if (!(await canView(uid, d.id))) continue;
      items.push(await publicProfile(d.id, p));
      if (items.length === 10) break;
    }
    return { items, cursor: null };
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
    if (who && !(await canView(uid, who))) continue;
    if (
      r.data?.following &&
      who !== uid &&
      (await db.doc(`users/${uid}/following/${who}`).get()).data()?.targetType !== 'user'
    )
      continue;
    items.push({ id: d.id, ...serialize(p) });
    if (items.length === 25) break;
  }
  return { items, cursor: docs.size === 250 || items.length === 25 ? cursor : null };
});
// Small invalidation records keep server-authorized pages current without exposing documents.
const invalidate = async () => {
  await db.doc('socialState/current').set({ changedAt: FieldValue.serverTimestamp() });
};
export const communityRatingChanged = onDocumentWritten('ratings/{id}', invalidate);
export const communityReleaseRatingChanged = onDocumentWritten('releaseRatings/{id}', invalidate);
export const communityProfileChanged = onDocumentWritten('users/{uid}', invalidate);
export const communityActivityChanged = onDocumentWritten('activity/{id}', invalidate);
export const communityDiscussionChanged = onDocumentWritten(
  'tracks/{track}/comments/{id}',
  invalidate,
);
