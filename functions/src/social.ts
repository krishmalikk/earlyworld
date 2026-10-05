import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldPath, type Query } from 'firebase-admin/firestore';
import { db, FieldValue, hash, rateLimit, requiredText } from './core';
import {
  SOCIAL_POLICY_VERSION,
  SOCIAL_LIMITS,
  eligibleAgeBand,
  normalizePost,
  assertSubmittable,
} from '../../shared/social';
import {
  assertAdmin,
  bad,
  followedPage,
  blocked,
  makeCursor,
  postDTO,
  mediaDTO,
  quota,
  readCursor,
  resolveAttachment,
  socialContext,
  socialId,
  Timestamp,
  touchSocial,
  visiblePost,
} from './social-core';

export const getSocialStatus = onCall(async (r) => {
  const c = await socialContext(r);
  return {
    creation: c.admin || c.flags.creation === true,
    publication: c.flags.publication === true,
    playback: c.flags.playback === true,
    admin: c.admin,
    eligible: c.account.eligible === true,
    supportEmail: c.flags.supportEmail || 'earlyworldofficial@gmail.com',
    policyVersion: SOCIAL_POLICY_VERSION,
  };
});
export const setSocialEligibility = onCall(async (r) => {
  const { uid } = await socialContext(r);
  const band = eligibleAgeBand(r.data?.age);
  if (!band || r.data?.country !== 'US' || r.data?.agreed !== true)
    throw new HttpsError(
      'failed-precondition',
      'The initial community is available to US listeners aged 13 and older who accept the community rules.',
    );
  await db.doc(`_socialAccounts/${uid}`).set(
    {
      eligible: true,
      ageBand: band,
      country: 'US',
      policyVersion: SOCIAL_POLICY_VERSION,
      agreedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { eligible: true };
});
export const savePostDraft = onCall(async (r) => {
  const { uid } = await socialContext(r, true),
    id = socialId(r.data?.id);
  if (id.startsWith('profile_'))
    throw new HttpsError('invalid-argument', 'Reserved draft identifier.');
  let content;
  try {
    content = normalizePost(r.data?.content);
  } catch (e) {
    bad(e);
  }
  content = await resolveAttachment(content!);
  await rateLimit(uid, 'postDraft', 120);
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`_postDrafts/${id}`),
      [old, published, ...media] = await Promise.all([
        tx.get(ref),
        tx.get(db.doc(`posts/${id}`)),
        ...content.mediaIds.map((m) => tx.get(db.doc(`_socialMedia/${m}`))),
      ]);
    if (
      (old.exists && old.data()!.uid !== uid) ||
      (published.exists && published.data()!.uid !== uid)
    )
      throw new HttpsError('permission-denied', 'Not your post.');
    if (old.data()?.status === 'deleted' || published.data()?.status === 'deleted')
      throw new HttpsError('failed-precondition', 'This post was deleted.');
    if (
      media.some(
        (m) =>
          !m.exists ||
          m.data()!.uid !== uid ||
          m.data()!.postId !== id ||
          m.data()!.kind !== (content.kind === 'video' ? 'video' : 'photo'),
      )
    )
      throw new HttpsError('invalid-argument', 'Choose your own uploaded media.');
    if (
      published.exists &&
      (JSON.stringify(published.data()!.mediaIds) !== JSON.stringify(content.mediaIds) ||
        published.data()!.kind !== content.kind)
    )
      throw new HttpsError(
        'failed-precondition',
        'Published media cannot be replaced. Create another post.',
      );
    if (
      old.exists &&
      JSON.stringify(normalizePost(old.data())) === JSON.stringify(normalizePost(content))
    )
      return;
    const version = (old.data()?.version || published.data()?.version || 0) + 1;
    tx.delete(db.doc(`_moderation/post_${id}`));
    tx.set(ref, {
      ...content,
      uid,
      version,
      status: 'draft',
      createdAt: old.data()?.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    touchSocial(tx, uid);
  });
  return { id };
});
export const authorizePostUpload = onCall(async (r) => {
  const { uid, flags, admin } = await socialContext(r, true);
  if (!admin && flags.uploads !== true)
    throw new HttpsError('failed-precondition', 'Media uploads are not available yet.');
  const postId = socialId(r.data?.postId),
    id = socialId(r.data?.id),
    kind = r.data?.kind;
  const bytes = r.data?.bytes,
    mime = r.data?.mime;
  if (
    !['photo', 'video'].includes(kind) ||
    !Number.isInteger(bytes) ||
    bytes <= 0 ||
    bytes > (kind === 'video' ? SOCIAL_LIMITS.videoBytes : SOCIAL_LIMITS.photoBytes) ||
    typeof mime !== 'string' ||
    !(kind === 'video' ? /^video\/(mp4|quicktime)$/ : /^image\/(jpeg|png|webp|heic|heif)$/).test(
      mime,
    )
  )
    throw new HttpsError('invalid-argument', 'Unsupported file or file too large.');
  const path = `social-staging/${uid}/${postId}/${id}`;
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`_socialMedia/${id}`),
      [draft, old, post] = await Promise.all([
        tx.get(db.doc(`_postDrafts/${postId}`)),
        tx.get(ref),
        tx.get(db.doc(`posts/${postId}`)),
      ]);
    if (draft.data()?.uid !== uid || draft.data()?.status !== 'draft' || post.exists)
      throw new HttpsError('failed-precondition', 'Save a new draft before uploading.');
    if (old.exists) {
      if (old.data()!.uid !== uid || old.data()!.postId !== postId)
        throw new HttpsError('permission-denied', 'Upload unavailable.');
      return;
    }
    const charge = await quota(
      tx,
      uid,
      kind === 'video' ? 'videoUpload' : 'photoUpload',
      kind === 'video' ? SOCIAL_LIMITS.videosDaily : 40,
    );
    charge();
    tx.create(ref, {
      uid,
      postId,
      kind,
      bytes,
      mime,
      path,
      status: 'authorized',
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 86400000),
    });
    touchSocial(tx, uid);
  });
  return { id, path, status: (await db.doc(`_socialMedia/${id}`).get()).data()?.status };
});
export const submitPost = onCall(async (r) => {
  const { uid } = await socialContext(r, true),
    id = socialId(r.data?.id);
  if (r.data?.rightsConfirmed !== true)
    throw new HttpsError('invalid-argument', 'Confirm you have permission to share this content.');
  return db.runTransaction(async (tx) => {
    const ref = db.doc(`_postDrafts/${id}`),
      d = await tx.get(ref),
      p = d.data();
    if (!p || p.uid !== uid) throw new HttpsError('not-found', 'Draft unavailable.');
    if (['pending', 'processing', 'published'].includes(p.status)) return { status: p.status };
    if (p.status !== 'draft' && p.status !== 'rejected')
      throw new HttpsError('failed-precondition', 'Save the draft first.');
    try {
      assertSubmittable(normalizePost(p));
    } catch (e) {
      bad(e);
    }
    const media = await Promise.all(
      p.mediaIds.map((m: string) => tx.get(db.doc(`_socialMedia/${m}`))),
    );
    if (
      media.some(
        (m) =>
          !m.exists ||
          m.data()!.uid !== uid ||
          m.data()!.postId !== id ||
          ['failed', 'authorized'].includes(m.data()!.status),
      )
    )
      throw new HttpsError('failed-precondition', 'Finish uploading all media first.');
    const charge = await quota(tx, uid, 'submission', SOCIAL_LIMITS.submissionsDaily);
    const status = media.every((m) => m.data()!.status === 'ready') ? 'pending' : 'processing';
    charge();
    tx.update(ref, {
      status,
      rightsConfirmedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (status === 'pending')
      tx.set(db.doc(`_moderation/post_${id}`), {
        kind: 'post',
        targetId: id,
        uid,
        version: p.version,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      });
    touchSocial(tx, uid);
    return { status };
  });
});
export const getPost = onCall(async (r) => {
  const c = await socialContext(r),
    id = socialId(r.data?.id);
  if (r.data?.own === true) {
    const draft = await db.doc(`_postDrafts/${id}`).get();
    if (!draft.exists || draft.data()!.uid !== c.uid || draft.data()!.status === 'deleted')
      throw new HttpsError('not-found', 'Draft unavailable.');
    const pub = await db.doc(`posts/${id}`).get();
    return postDTO(
      id,
      { ...draft.data()!, publishedAt: pub.data()?.publishedAt },
      c.uid,
      c.flags.playback === true || c.admin,
      true,
    );
  }
  const d = await visiblePost(c.uid, id);
  return postDTO(id, d.data()!, c.uid, c.flags.playback === true);
});
export const listPosts = onCall(async (r) => {
  const c = await socialContext(r),
    mode = r.data?.mode || 'explore';
  await rateLimit(c.uid, 'socialRead', 600);
  if (!['explore', 'following', 'profile', 'own', 'bookmarks'].includes(mode))
    throw new HttpsError('invalid-argument', 'Unknown feed.');
  if (mode === 'bookmarks') {
    let bookmarks: Query = db
      .collection(`users/${c.uid}/postBookmarks`)
      .orderBy('createdAt', 'desc')
      .orderBy(FieldPath.documentId(), 'desc');
    const cursor = readCursor(r.data?.cursor);
    if (cursor) bookmarks = bookmarks.startAfter(...cursor);
    const docs = await bookmarks.limit(25).get(),
      items = [];
    for (const d of docs.docs) {
      const p = await db.doc(`posts/${d.id}`).get();
      if (p.data()?.status !== 'published') continue;
      const account = (await db.doc(`_socialAccounts/${p.data()!.uid}`).get()).data();
      if ((await blocked(c.uid, p.data()!.uid)) || account?.suspended || account?.deleting)
        continue;
      items.push(await postDTO(p.id, p.data()!, c.uid, c.flags.playback === true));
    }
    const last = docs.docs.at(-1);
    return {
      items,
      cursor: docs.size === 25 ? makeCursor(last!.data().createdAt, last!.id) : null,
    };
  }
  const owner = mode === 'own';
  const field = owner ? 'updatedAt' : 'publishedAt';
  let q: Query = db.collection(owner ? '_postDrafts' : 'posts');
  if (owner) q = q.where('uid', '==', c.uid);
  else q = q.where('status', '==', 'published');
  if (mode === 'profile') q = q.where('uid', '==', socialId(r.data?.uid));
  if (r.data?.kind) {
    if (!['post', 'video'].includes(r.data.kind))
      throw new HttpsError('invalid-argument', 'Invalid type.');
    q = q.where('kind', '==', r.data.kind);
  }
  if (r.data?.scene)
    q = q.where('scenes', 'array-contains', requiredText(r.data.scene, 'scene', 80));
  q = q.orderBy(field, 'desc').orderBy(FieldPath.documentId(), 'desc');
  const cursor = readCursor(r.data?.cursor);
  if (cursor && mode !== 'following') q = q.startAfter(...cursor);
  const snapshot =
    mode === 'following'
      ? await followedPage(c.uid, q, 'uid', 'publishedAt', cursor)
      : await q.limit(250).get();
  const items = [];
  let scanned = null;
  for (const d of snapshot.docs) {
    const p = d.data();
    scanned = makeCursor(p[field], d.id);
    if (p.purpose === 'profile') continue;
    if (p.status === 'deleted' || (!owner && (await blocked(c.uid, p.uid)))) continue;
    const account = (await db.doc(`_socialAccounts/${p.uid}`).get()).data();
    if (account?.suspended || account?.deleting) continue;
    if (
      mode === 'following' &&
      p.uid !== c.uid &&
      (await db.doc(`users/${c.uid}/following/${p.uid}`).get()).data()?.targetType !== 'user'
    )
      continue;
    if (
      mode === 'bookmarks' &&
      !(await db.doc(`users/${c.uid}/postBookmarks/${d.id}`).get()).exists
    )
      continue;
    items.push(await postDTO(d.id, p, c.uid, c.flags.playback === true || c.admin, owner));
    if (items.length === 25) break;
  }
  return {
    items,
    cursor: scanned && (snapshot.size === 250 || items.length === 25) ? scanned : null,
  };
});
export const setPostInteraction = onCall(async (r) => {
  const { uid } = await socialContext(r),
    id = socialId(r.data?.id),
    kind = r.data?.kind;
  if (!['like', 'bookmark'].includes(kind) || typeof r.data?.active !== 'boolean')
    throw new HttpsError('invalid-argument', 'Invalid action.');
  await visiblePost(uid, id);
  await rateLimit(uid, 'postInteraction', 120);
  await db.runTransaction(async (tx) => {
    const post = db.doc(`posts/${id}`),
      ref =
        kind === 'like'
          ? post.collection('likes').doc(uid)
          : db.doc(`users/${uid}/postBookmarks/${id}`);
    const [p, old] = await Promise.all([tx.get(post), tx.get(ref)]);
    const author = p.data()?.uid;
    if (author) {
      const [a, b, account] = await Promise.all([
        tx.get(db.doc(`_socialBlocks/${hash(`${uid}:${author}`)}`)),
        tx.get(db.doc(`_socialBlocks/${hash(`${author}:${uid}`)}`)),
        tx.get(db.doc(`_socialAccounts/${author}`)),
      ]);
      if (a.exists || b.exists || account.data()?.suspended)
        throw new HttpsError('not-found', 'Post unavailable.');
    }
    if (p.data()?.status !== 'published') throw new HttpsError('not-found', 'Post unavailable.');
    if (old.exists === r.data.active) return;
    if (r.data.active) tx.set(ref, { uid, postId: id, createdAt: FieldValue.serverTimestamp() });
    else tx.delete(ref);
    if (kind === 'like')
      tx.update(post, {
        likeCount: Math.max(0, (p.data()?.likeCount || 0) + (r.data.active ? 1 : -1)),
      });
    touchSocial(tx, uid);
  });
  return { ok: true };
});
export const createPostComment = onCall(async (r) => {
  const { uid } = await socialContext(r, true),
    postId = socialId(r.data?.postId),
    id = hash(`${uid}:${socialId(r.data?.requestId)}`),
    body = requiredText(r.data?.body, 'comment', 1000);
  await visiblePost(uid, postId);
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`_postComments/${id}`),
      old = await tx.get(ref);
    if (old.exists) return;
    const post = await tx.get(db.doc(`posts/${postId}`));
    if (post.data()?.status !== 'published') throw new HttpsError('not-found', 'Post unavailable.');
    const author = post.data()!.uid;
    const [a, b] = await Promise.all([
      tx.get(db.doc(`_socialBlocks/${hash(`${uid}:${author}`)}`)),
      tx.get(db.doc(`_socialBlocks/${hash(`${author}:${uid}`)}`)),
    ]);
    if (a.exists || b.exists) throw new HttpsError('not-found', 'Post unavailable.');
    const charge = await quota(tx, uid, 'comments', 20);
    charge();
    tx.create(ref, {
      uid,
      postId,
      body,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.doc(`_moderation/comment_${id}`), {
      kind: 'comment',
      uid,
      targetId: id,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });
    touchSocial(tx, uid);
  });
  return { id, status: 'pending' };
});
export const listPostComments = onCall(async (r) => {
  const { uid } = await socialContext(r),
    postId = socialId(r.data?.postId);
  await visiblePost(uid, postId);
  let q: Query = db
    .collection('_postComments')
    .where('postId', '==', postId)
    .orderBy('createdAt')
    .orderBy(FieldPath.documentId());
  const cursor = readCursor(r.data?.cursor);
  if (cursor) q = q.startAfter(...cursor);
  const snap = await q.limit(250).get(),
    items = [];
  let next = null;
  for (const d of snap.docs) {
    const p = d.data();
    const account = (await db.doc(`_socialAccounts/${p.uid}`).get()).data();
    next = makeCursor(p.createdAt, d.id);
    if (
      (p.status !== 'approved' && p.uid !== uid) ||
      ['suspended', 'deleting'].some((key) => account?.[key]) ||
      (await blocked(uid, p.uid)) ||
      p.status === 'deleted'
    )
      continue;
    const a = (await db.doc(`users/${p.uid}`).get()).data();
    items.push({
      id: d.id,
      uid: p.uid,
      body: p.body,
      status: p.status,
      createdAt: p.createdAt.toMillis(),
      author: { username: a?.username || 'Listener', avatarUrl: a?.avatarUrl || '' },
      ...(p.uid === uid && p.reason ? { reason: p.reason } : {}),
    });
    if (items.length === 25) break;
  }
  return { items, cursor: next && (snap.size === 250 || items.length === 25) ? next : null };
});
export const deleteSocialContent = onCall(async (r) => {
  const { uid, admin } = await socialContext(r),
    id = socialId(r.data?.id),
    comment = r.data?.kind === 'comment';
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`${comment ? '_postComments' : '_postDrafts'}/${id}`),
      d = await tx.get(ref),
      p = d.data();
    if (!p) return;
    if (p.uid !== uid && !admin) throw new HttpsError('permission-denied', 'Not your content.');
    const publicRef = db.doc(`posts/${comment ? p.postId : id}`),
      pub = await tx.get(publicRef);
    if (p.status === 'deleted') return;
    tx.update(ref, { status: 'deleted', updatedAt: FieldValue.serverTimestamp() });
    tx.delete(db.doc(`_moderation/${comment ? 'comment' : 'post'}_${id}`));
    if (comment && p.status === 'approved' && pub.exists)
      tx.update(publicRef, { commentCount: Math.max(0, (pub.data()!.commentCount || 0) - 1) });
    if (!comment) {
      if (pub.exists) tx.update(publicRef, { status: 'deleted' });
      tx.set(db.doc(`_socialCleanup/${id}`), {
        uid: p.uid,
        postId: id,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    touchSocial(tx, p.uid);
  });
  return { ok: true };
});
export const reportSocialContent = onCall(async (r) => {
  const { uid } = await socialContext(r);
  const kind = r.data?.kind,
    id = socialId(r.data?.id);
  if (!['post', 'comment', 'profile', 'rating', 'releaseRating', 'trackComment'].includes(kind))
    throw new HttpsError('invalid-argument', 'Invalid report target.');
  const reason = requiredText(r.data?.reason, 'reason', 500);
  await rateLimit(uid, 'report', 20);
  const target = await reportTarget(kind, id, r.data?.trackId);
  if (!target.uid) throw new HttpsError('not-found', 'Content unavailable.');
  await db.doc(`_socialReports/${hash(`${uid}:${kind}:${id}`)}`).set({
    uid,
    subjectUid: target.uid,
    kind,
    targetId: id,
    trackId: r.data?.trackId ? socialId(r.data.trackId) : null,
    reason,
    status: 'open',
    createdAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});
export const setUserBlock = onCall(async (r) => {
  const { uid } = await socialContext(r),
    target = socialId(r.data?.uid);
  if (target === uid || typeof r.data?.blocked !== 'boolean')
    throw new HttpsError('invalid-argument', 'Invalid block.');
  const batch = db.batch(),
    ref = db.doc(`_socialBlocks/${hash(`${uid}:${target}`)}`);
  if (r.data.blocked) {
    batch.set(ref, { uid, target, createdAt: FieldValue.serverTimestamp() });
    batch.set(db.doc(`users/${uid}/blockedUsers/${target}`), { target });
    batch.set(db.doc(`users/${target}/blockedBy/${uid}`), { uid });
    batch.delete(db.doc(`users/${uid}/following/${target}`));
    batch.delete(db.doc(`users/${target}/following/${uid}`));
    batch.delete(db.doc(`users/${uid}/matches/${target}`));
    batch.delete(db.doc(`users/${target}/matches/${uid}`));
  } else {
    batch.delete(ref);
    batch.delete(db.doc(`users/${uid}/blockedUsers/${target}`));
    batch.delete(db.doc(`users/${target}/blockedBy/${uid}`));
  }
  batch.set(
    db.doc(`users/${uid}/socialState/current`),
    { changedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  batch.set(
    db.doc(`users/${target}/socialState/current`),
    { changedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  await batch.commit();
  return { ok: true };
});
export const listModeration = onCall(async (r) => {
  assertAdmin(r);
  const reports = r.data?.reports === true;
  let q: Query = db
    .collection(reports ? '_socialReports' : '_moderation')
    .where('status', '==', reports ? 'open' : 'pending')
    .orderBy('createdAt')
    .orderBy(FieldPath.documentId());
  const cursor = readCursor(r.data?.cursor);
  if (cursor) q = q.startAfter(...cursor);
  const snap = await q.limit(25).get();
  const items = await Promise.all(
    snap.docs.map(async (d) => {
      const m = d.data();
      if (reports) {
        const target = await reportTarget(m.kind, m.targetId, m.trackId);
        return { id: d.id, ...m, subjectUid: target.uid, content: target.content };
      }
      let content: unknown = null;
      if (m.kind === 'post') {
        const p = await db.doc(`_postDrafts/${m.targetId}`).get();
        if (p.exists) content = await postDTO(p.id, p.data()!, r.auth!.uid, true, true);
      } else
        content =
          (
            await db
              .doc(`${m.kind === 'comment' ? '_postComments' : '_textSubmissions'}/${m.targetId}`)
              .get()
          ).data() || null;
      if (
        content &&
        typeof content === 'object' &&
        'photoMediaId' in content &&
        typeof content.photoMediaId === 'string'
      )
        content = { ...content, photo: await mediaDTO(content.photoMediaId, false) };
      return { id: d.id, ...m, content };
    }),
  );
  const last = snap.docs.at(-1);
  return { items, cursor: snap.size === 25 ? makeCursor(last!.data().createdAt, last!.id) : null };
});
export const moderateSocialContent = onCall(async (r) => {
  assertAdmin(r);
  const id = socialId(r.data?.id),
    approve = r.data?.approve === true,
    reason = approve ? '' : requiredText(r.data?.reason, 'reason', 500);
  const config = (await db.doc('_socialControl/config').get()).data() || {};
  if (approve && config.publication !== true)
    throw new HttpsError(
      'failed-precondition',
      'Publication is disabled. Complete the launch checklist before enabling it.',
    );
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`_moderation/${id}`),
      m = (await tx.get(ref)).data();
    if (!m || m.status !== 'pending') return;
    const draftRef = db.doc(
        `${m.kind === 'post' ? '_postDrafts' : m.kind === 'comment' ? '_postComments' : '_textSubmissions'}/${m.targetId}`,
      ),
      draft = await tx.get(draftRef),
      p = draft.data();
    if (!p || p.status !== 'pending' || (m.version && p.version !== m.version))
      throw new HttpsError('failed-precondition', 'Submission changed. Refresh the queue.');
    const account = await tx.get(db.doc(`_socialAccounts/${p.uid}`));
    if (approve && (account.data()?.suspended || account.data()?.deleting))
      throw new HttpsError('failed-precondition', 'Account is suspended or being deleted.');
    if (m.kind === 'post') {
      const publicRef = db.doc(`posts/${m.targetId}`),
        old = await tx.get(publicRef);
      if (approve) {
        const content = { ...normalizePost(p), attachment: p.attachment || null };
        tx.set(publicRef, {
          ...content,
          uid: p.uid,
          version: p.version,
          status: 'published',
          publishedAt: old.data()?.publishedAt || FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          likeCount: old.data()?.likeCount || 0,
          commentCount: old.data()?.commentCount || 0,
        });
      }
      tx.update(draftRef, {
        status: approve ? 'published' : 'rejected',
        reason,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else if (m.kind === 'comment') {
      const postRef = db.doc(`posts/${p.postId}`),
        post = await tx.get(postRef);
      if (approve && post.data()?.status !== 'published')
        throw new HttpsError('failed-precondition', 'Post no longer available.');
      if (approve) {
        const author = post.data()!.uid;
        const restrictions = await tx.getAll(
          db.doc(`_socialBlocks/${hash(`${p.uid}:${author}`)}`),
          db.doc(`_socialBlocks/${hash(`${author}:${p.uid}`)}`),
          db.doc(`_socialAccounts/${author}`),
        );
        if (
          restrictions[0].exists ||
          restrictions[1].exists ||
          restrictions[2].data()?.suspended ||
          restrictions[2].data()?.deleting
        )
          throw new HttpsError('failed-precondition', 'This conversation is no longer available.');
      }
      tx.update(draftRef, { status: approve ? 'approved' : 'rejected', reason });
      if (approve) tx.update(postRef, { commentCount: (post.data()!.commentCount || 0) + 1 });
    } else {
      const target = db.doc(p.targetPath),
        existing = await tx.get(target);
      if (approve && !existing.exists && p.kind !== 'trackComment')
        throw new HttpsError('failed-precondition', 'Content no longer exists.');
      const userRef = db.doc(`users/${p.uid}`),
        user = await tx.get(userRef);
      const photo = p.photoMediaId ? await tx.get(db.doc(`_socialMedia/${p.photoMediaId}`)) : null;
      if (approve && p.photoMediaId && photo?.data()?.status !== 'ready')
        throw new HttpsError('failed-precondition', 'Wait for the photo to finish processing.');
      if (approve) {
        if (p.kind === 'review') {
          const countField = p.targetPath.startsWith('releaseRatings/')
            ? 'releaseReviewCount'
            : 'reviewCount';
          if (existing.data()?.pendingReviewVersion !== p.version)
            throw new HttpsError('failed-precondition', 'Review changed.');
          tx.update(target, {
            review: p.body,
            pendingReviewVersion: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          tx.update(userRef, {
            [countField]:
              (user.data()?.[countField] || 0) +
              Number(!!p.body) -
              Number(!!existing.data()?.review),
          });
        } else if (p.kind === 'trackComment')
          tx.set(target, { uid: p.uid, body: p.body, createdAt: FieldValue.serverTimestamp() });
        else
          tx.update(target, {
            ...p.fields,
            ...(p.photoMediaId ? { avatarMediaId: p.photoMediaId, avatarUrl: '' } : {}),
          });
      }
      tx.update(draftRef, { status: approve ? 'approved' : 'rejected', reason });
    }
    tx.update(ref, {
      status: approve ? 'approved' : 'rejected',
      reason,
      moderator: r.auth!.uid,
      decidedAt: FieldValue.serverTimestamp(),
    });
    touchSocial(tx, p.uid);
  });
  return { ok: true };
});
export const resolveSocialReport = onCall(async (r) => {
  assertAdmin(r);
  await db.doc(`_socialReports/${socialId(r.data?.id)}`).update({
    status: 'resolved',
    moderator: r.auth!.uid,
    resolution: requiredText(r.data?.resolution, 'resolution', 500),
    resolvedAt: FieldValue.serverTimestamp(),
  });
  console.info({ event: 'social_report_resolved' });
  return { ok: true };
});
export const suspendSocialAccount = onCall(async (r) => {
  assertAdmin(r);
  const uid = socialId(r.data?.uid);
  if (uid === r.auth!.uid) throw new HttpsError('invalid-argument', 'Cannot suspend yourself.');
  await db
    .doc(`_socialAccounts/${uid}`)
    .set({ suspended: r.data?.suspended === true, moderator: r.auth!.uid }, { merge: true });
  await db.doc('socialState/current').set({ changedAt: FieldValue.serverTimestamp() });
  return { ok: true };
});
export const completePostUpload = onCall(async (r) => {
  const { uid } = await socialContext(r, true),
    id = socialId(r.data?.id),
    ref = db.doc(`_socialMedia/${id}`),
    m = (await ref.get()).data();
  if (!m || m.uid !== uid) throw new HttpsError('not-found', 'Upload unavailable.');
  if (m.status === 'processing' || m.status === 'ready') return { ok: true };
  const { getStorage } = await import('firebase-admin/storage');
  const [metadata] = await getStorage().bucket().file(m.path).getMetadata();
  if (Number(metadata.size) !== m.bytes || metadata.contentType !== m.mime)
    throw new HttpsError('invalid-argument', 'Upload does not match the selected file.');
  await getStorage()
    .bucket()
    .file(m.path)
    .setMetadata({
      metadata: { firebaseStorageDownloadTokens: null },
    });
  await db.runTransaction(async (tx) => {
    const current = (await tx.get(ref)).data();
    if (current?.status !== 'authorized') return;
    tx.update(ref, { status: 'processing', generation: metadata.generation });
    tx.set(db.doc(`_mediaJobs/${id}`), {
      uid,
      postId: m.postId,
      mediaId: id,
      state: 'pending',
      attempts: 0,
      dueAt: Timestamp.now(),
    });
    touchSocial(tx, uid);
  });
  return { ok: true };
});

async function reportTarget(kind: string, id: string, trackId?: string) {
  const paths: Record<string, string> = {
    post: `posts/${id}`,
    comment: `_postComments/${id}`,
    profile: `users/${id}`,
    rating: `ratings/${id}`,
    releaseRating: `releaseRatings/${id}`,
    trackComment: `tracks/${trackId ? socialId(trackId) : 'missing'}/comments/${id}`,
  };
  const d = await db.doc(paths[kind]).get();
  return {
    uid: d.exists ? (kind === 'profile' ? id : d.data()!.uid) : null,
    content: d.exists
      ? {
          body: d.data()!.body || d.data()!.review || d.data()!.text || d.data()!.bio || '',
          status: d.data()!.status || 'published',
        }
      : null,
  };
}
