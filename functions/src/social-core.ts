import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getStorage } from 'firebase-admin/storage';
import { Timestamp, type DocumentData, type Transaction } from 'firebase-admin/firestore';
import { authUid, db, FieldValue, hash } from './core';
import {
  validSocialId,
  type SocialPost,
  type PostContent,
  type SocialMedia,
} from '../../shared/social';
export { Timestamp };
export function socialId(value: unknown) {
  if (!validSocialId(value)) throw new HttpsError('invalid-argument', 'Invalid identifier.');
  return value;
}
export function bad(error: unknown): never {
  throw new HttpsError(
    'invalid-argument',
    error instanceof Error ? error.message : 'Check your submission.',
  );
}
export async function socialContext(request: CallableRequest, publishing = false) {
  const uid = authUid(request);
  const [account, user, control] = await Promise.all([
    db.doc(`_socialAccounts/${uid}`).get(),
    db.doc(`users/${uid}`).get(),
    db.doc('_socialControl/config').get(),
  ]);
  if (account.data()?.suspended || account.data()?.deleting)
    throw new HttpsError('permission-denied', 'This account cannot use social features.');
  const admin = request.auth?.token.admin === true;
  const flags = control.data() || {};
  // Posting is open to every onboarded listener for now: no creation switch, email
  // verification or eligibility gate, and posts publish without moderation.
  if (publishing && !user.data()?.onboardingComplete)
    throw new HttpsError('failed-precondition', 'Finish onboarding first.');
  return { uid, admin, flags, user: user.data() || {}, account: account.data() || {} };
}
export function assertAdmin(request: CallableRequest) {
  authUid(request);
  if (request.auth?.token.admin !== true)
    throw new HttpsError('permission-denied', 'Moderators only.');
}
export async function blocked(a: string, b: string) {
  if (a === b) return false;
  const docs = await db.getAll(
    db.doc(`_socialBlocks/${hash(`${a}:${b}`)}`),
    db.doc(`_socialBlocks/${hash(`${b}:${a}`)}`),
  );
  return docs.some((d) => d.exists);
}
/** Remembers lookups for one request, so a page with one author costs one lookup. */
export function perRequest<T>(load: (key: string) => Promise<T>) {
  const known = new Map<string, Promise<T>>();
  return (key: string) => {
    let value = known.get(key);
    if (!value) known.set(key, (value = load(key)));
    return value;
  };
}
/** Whether `viewer` may see this author: no block either way, not suspended or deleting. */
export const authorVisibility = (viewer: string) =>
  perRequest(async (author) => {
    const account = (await db.doc(`_socialAccounts/${author}`).get()).data();
    return !account?.suspended && !account?.deleting && !(await blocked(viewer, author));
  });
export const followsUser = (uid: string) =>
  perRequest(
    async (author) =>
      (await db.doc(`users/${uid}/following/${author}`).get()).data()?.targetType === 'user',
  );
export async function visiblePost(uid: string, id: string) {
  const d = await db.doc(`posts/${socialId(id)}`).get();
  const p = d.data();
  if (
    !p ||
    p.status !== 'published' ||
    (await blocked(uid, p.uid)) ||
    (await db.doc(`_socialAccounts/${p.uid}`).get()).data()?.suspended
  )
    throw new HttpsError('not-found', 'Post unavailable.');
  return d;
}
export async function resolveAttachment(content: PostContent) {
  if (!content.attachment) return content;
  const kind = { track: 'tracks', release: 'releases', artist: 'artists', producer: 'producers' }[
    content.attachment.kind
  ];
  const d = await db.doc(`${kind}/${content.attachment.id}`).get();
  if (!d.exists) throw new HttpsError('not-found', 'The attached catalog item is unavailable.');
  return {
    ...content,
    attachment: { ...content.attachment, label: d.data()!.title || d.data()!.name },
  };
}
export async function quota(tx: Transaction, uid: string, action: string, max: number, amount = 1) {
  const ref = db.doc(
    `_socialQuotas/${hash(`${uid}:${action}:${new Date().toISOString().slice(0, 10)}`)}`,
  );
  const snap = await tx.get(ref);
  if ((snap.data()?.count || 0) + amount > max)
    throw new HttpsError(
      'resource-exhausted',
      'Today’s limit has been reached. Try again tomorrow.',
    );
  return () =>
    tx.set(ref, {
      count: (snap.data()?.count || 0) + amount,
      expiresAt: Timestamp.fromMillis(Date.now() + 2 * 86400000),
    });
}
/** Refreshes the owner's screens. Staying per-account keeps busy transactions from contending. */
export function touchSocial(tx: Transaction, uid: string) {
  tx.set(
    db.doc(`users/${uid}/socialState/current`),
    { changedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}
export type NoticeType = 'follow' | 'like' | 'comment' | 'match' | 'published';
/** Keys are deterministic so retried events replace their notice, and undoing removes it. */
export const noticeRef = (uid: string, key: string) =>
  db.doc(`users/${uid}/notifications/${hash(key)}`);
export function notify(
  tx: Transaction,
  uid: string,
  key: string,
  notice: { type: NoticeType; actorUid: string; postId?: string },
) {
  // Your own activity is not news, except a post finishing its photo processing.
  if (uid === notice.actorUid && notice.type !== 'published') return;
  tx.set(noticeRef(uid, key), { ...notice, createdAt: FieldValue.serverTimestamp() });
}
export const COMMUNITY_REFRESH_MS = 60000;
/**
 * Every signed-in client refetches its mounted community data when this document changes,
 * so routine activity signals it at most once a minute. Screens also refresh on focus.
 * Safety changes (suspension, deletion) write it directly and take effect at once.
 */
export async function invalidateCommunity(now = Date.now()) {
  const ref = db.doc('socialState/current');
  const last = (await ref.get()).data()?.changedAt?.toMillis() || 0;
  if (now - last >= COMMUNITY_REFRESH_MS)
    await ref.set({ changedAt: FieldValue.serverTimestamp() });
}
export async function mediaDTO(id: string): Promise<SocialMedia> {
  const snap = await db.doc(`_socialMedia/${id}`).get(),
    m = snap.data();
  if (!m) return { id, kind: 'photo', status: 'failed' };
  const result: SocialMedia = { id, kind: m.kind, status: m.status };
  if (m.status !== 'ready') return result;
  const signed = async (path: string) =>
    (
      await getStorage()
        .bucket()
        .file(path)
        .getSignedUrl({ action: 'read', expires: Date.now() + 5 * 60000 })
    )[0];
  if (m.thumbnailPath) result.thumbnailUrl = await signed(m.thumbnailPath);
  result.url = await signed(m.displayPath);
  if (m.width) result.width = m.width;
  if (m.height) result.height = m.height;
  return result;
}
export async function postDTO(
  id: string,
  p: DocumentData,
  uid: string,
  privateView = false,
): Promise<SocialPost> {
  const [author, like, bookmark] = await db.getAll(
    db.doc(`users/${p.uid}`),
    db.doc(`posts/${id}/likes/${uid}`),
    db.doc(`users/${uid}/postBookmarks/${id}`),
  );
  const avatar = author.data()?.avatarMediaId ? await mediaDTO(author.data()!.avatarMediaId) : null;
  return {
    id,
    uid: p.uid,
    kind: p.kind,
    text: p.text,
    scenes: p.scenes || [],
    attachment: p.attachment || null,
    mediaIds: p.mediaIds || [],
    version: p.version || 1,
    status: p.status,
    author: {
      username: author.data()?.username || 'Listener',
      avatarUrl: avatar?.url || author.data()?.avatarUrl || '',
    },
    publishedAt: p.publishedAt?.toMillis() || 0,
    updatedAt: p.updatedAt?.toMillis() || 0,
    likeCount: p.likeCount || 0,
    commentCount: p.commentCount || 0,
    liked: like.exists,
    bookmarked: bookmark.exists,
    media: await Promise.all((p.mediaIds || []).map((m: string) => mediaDTO(m))),
    ...(privateView && p.reason ? { reason: p.reason } : {}),
  };
}
export function readCursor(value: unknown): [Timestamp, string] | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new HttpsError('invalid-argument', 'Invalid page cursor.');
  const exact = /^v2:(\d{1,12}):(\d{1,9}):([a-zA-Z0-9_-]{1,128})$/.exec(value);
  if (exact) {
    try {
      return [new Timestamp(Number(exact[1]), Number(exact[2])), exact[3]];
    } catch {
      throw new HttpsError('invalid-argument', 'Invalid page cursor.');
    }
  }
  // Existing clients and saved cursors can still use the original millisecond form.
  if (!/^\d{1,16}(?:\.\d+)?:[a-zA-Z0-9_-]{1,128}$/.test(value))
    throw new HttpsError('invalid-argument', 'Invalid page cursor.');
  const [at, id] = value.split(':');
  try {
    return [Timestamp.fromMillis(Number(at)), id];
  } catch {
    throw new HttpsError('invalid-argument', 'Invalid page cursor.');
  }
}
export const makeCursor = (at: Timestamp, id: string) => `v2:${at.seconds}:${at.nanoseconds}:${id}`;

export async function followedPage(
  uid: string,
  base: import('firebase-admin/firestore').Query,
  authorField: string,
  timeField: string,
  cursor: unknown[] | null = null,
) {
  const follows = await db
    .collection(`users/${uid}/following`)
    .where('targetType', '==', 'user')
    .get();
  const ids = [...new Set([uid, ...follows.docs.map((d) => d.id)])];
  const pages = [];
  // Serialize groups to bound concurrent requests; each group contributes at most one page.
  for (let i = 0; i < ids.length; i += 30) {
    let query = base.where(authorField, 'in', ids.slice(i, i + 30));
    if (cursor) query = query.startAfter(...cursor);
    pages.push(await query.limit(25).get());
  }
  // Stop at the first full group's scan boundary: its unseen rows may precede
  // older rows from another group, including after visibility filtering.
  const boundaries = new Set(pages.filter((p) => p.size === 25).map((p) => p.docs[24].ref.path));
  const merged = pages
    .flatMap((p) => p.docs)
    .sort(
      (a, b) =>
        (b.data()[timeField]?.seconds || 0) - (a.data()[timeField]?.seconds || 0) ||
        (b.data()[timeField]?.nanoseconds || 0) - (a.data()[timeField]?.nanoseconds || 0) ||
        (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
    );
  const boundary = merged.findIndex((d) => boundaries.has(d.ref.path));
  const docs = merged.slice(0, Math.min(250, boundary < 0 ? merged.length : boundary + 1));
  return {
    docs,
    size:
      pages.some((p) => p.size === 25) || pages.reduce((n, p) => n + p.size, 0) > 250
        ? 250
        : docs.length,
  };
}
