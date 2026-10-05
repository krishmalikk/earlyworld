import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { db, FieldValue, hash, authUid, rateLimit } from './core';
import { socialContext, socialId, quota, Timestamp } from './social-core';
export const requestAccountDeletion = onCall(async (r) => {
  const uid = authUid(r);
  const authenticated = Number(r.auth?.token.auth_time || 0) * 1000;
  if (Date.now() - authenticated > 5 * 60000)
    throw new HttpsError(
      'unauthenticated',
      'Sign out and sign in again before deleting your account.',
    );
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`_accountDeletion/${uid}`),
      old = await tx.get(ref);
    if (old.exists) return;
    tx.set(db.doc(`_socialAccounts/${uid}`), { deleting: true, suspended: true }, { merge: true });
    tx.create(ref, { stage: 0, complete: false, createdAt: FieldValue.serverTimestamp() });
  });
  return { queued: true };
});
export async function deleteAccountBatch(uid: string) {
  const ref = db.doc(`_accountDeletion/${uid}`),
    job = (await ref.get()).data();
  if (!job || job.complete) return;
  const stage = job.stage || 0;
  const collections = [
    '_postDrafts',
    '_postComments',
    'ratings',
    'releaseRatings',
    '_textSubmissions',
    '_socialReports',
    '_socialBlocks',
    '_socialMedia',
    '_moderation',
  ];
  if (stage < collections.length) {
    const collection = collections[stage],
      docs = await db.collection(collection).where('uid', '==', uid).limit(25).get();
    for (const doc of docs.docs) {
      const p = doc.data();
      if (collection === '_socialMedia') {
        await db.doc(`_socialCleanup/${p.postId}`).set({ uid, postId: p.postId });
        // The media cleanup job must retain the paths until it has removed every object.
        continue;
      }
      if (collection === '_socialBlocks') {
        await db.doc(`users/${p.target}/blockedBy/${uid}`).delete();
      }
      if (collection === '_postDrafts') {
        await db.doc(`posts/${doc.id}`).set({ status: 'deleted' }, { merge: true });
        await db.doc(`_socialCleanup/${doc.id}`).set({ uid, postId: doc.id });
        await db.doc(`_moderation/post_${doc.id}`).delete();
      } else if (collection === 'ratings' || collection === 'releaseRatings') {
        await db.runTransaction(async (tx) => {
          const current = await tx.get(doc.ref);
          if (!current.exists) return;
          const d = current.data()!,
            track = db.doc(
              `${collection === 'ratings' ? 'tracks' : 'releases'}/${d.trackId || d.releaseId}`,
            ),
            t = await tx.get(track);
          if (t.exists)
            tx.update(track, {
              ratingCount: Math.max(0, (t.data()!.ratingCount || 0) - 1),
              ratingHalfStarSum: Math.max(0, (t.data()!.ratingHalfStarSum || 0) - d.halfStars),
            });
          tx.delete(doc.ref);
        });
        continue;
      } else if (collection === '_postComments' && p.status === 'approved') {
        await db.runTransaction(async (tx) => {
          const current = await tx.get(doc.ref),
            post = db.doc(`posts/${p.postId}`),
            d = await tx.get(post);
          if (!current.exists) return;
          if (d.exists)
            tx.update(post, { commentCount: Math.max(0, (d.data()!.commentCount || 0) - 1) });
          tx.delete(doc.ref);
        });
        continue;
      }
      await doc.ref.delete();
    }
    if (docs.empty || collection === '_socialMedia') await ref.update({ stage: stage + 1 });
    return;
  }
  if (stage === collections.length) {
    const likes = await db.collectionGroup('likes').where('uid', '==', uid).limit(25).get();
    for (const d of likes.docs)
      await db.runTransaction(async (tx) => {
        const [like, post] = await Promise.all([tx.get(d.ref), tx.get(d.ref.parent.parent!)]);
        if (!like.exists) return;
        if (post.exists)
          tx.update(post.ref, { likeCount: Math.max(0, (post.data()!.likeCount || 0) - 1) });
        tx.delete(d.ref);
      });
    if (!likes.empty) return;
    const blockers = await db
      .collection('_socialBlocks')
      .where('target', '==', uid)
      .limit(25)
      .get();
    for (const d of blockers.docs) {
      await db.doc(`users/${d.data().uid}/blockedUsers/${uid}`).delete();
      await d.ref.delete();
    }
    if (!blockers.empty) return;
    const outgoing = await db.collection(`users/${uid}/following`).limit(25).get();
    for (const d of outgoing.docs) await d.ref.delete();
    if (!outgoing.empty) return;
    const saves = await db.collection(`users/${uid}/saves`).limit(25).get();
    for (const d of saves.docs) await d.ref.delete();
    if (!saves.empty) return;
    const incoming = await db
      .collectionGroup('following')
      .where('targetId', '==', uid)
      .limit(25)
      .get();
    for (const d of incoming.docs) await d.ref.delete();
    if (!incoming.empty) return;
    const comments = await db.collectionGroup('comments').where('uid', '==', uid).limit(25).get();
    for (const d of comments.docs) await d.ref.delete();
    if (!comments.empty) return;
    const activity = await db.collection('activity').where('actorUid', '==', uid).limit(25).get();
    for (const d of activity.docs) await d.ref.delete();
    if (!activity.empty) return;
    const messages = await db.collectionGroup('messages').where('uid', '==', uid).limit(25).get();
    for (const d of messages.docs) await d.ref.delete();
    if (!messages.empty) return;
    // Leave every conversation so remaining members' inbox rows stop listing this account.
    const conversations = await db
      .collection('conversations')
      .where('memberIds', 'array-contains', uid)
      .limit(25)
      .get();
    for (const d of conversations.docs)
      await db.runTransaction(async (tx) => {
        const c = (await tx.get(d.ref)).data();
        if (!c?.memberIds.includes(uid)) return;
        const memberIds = (c.memberIds as string[]).filter((m) => m !== uid);
        const rows = await tx.getAll(
          ...memberIds.map((m) => db.doc(`users/${m}/conversations/${d.id}`)),
        );
        const createdBy = c.createdBy === uid ? memberIds[0] || null : c.createdBy;
        tx.update(d.ref, { memberIds, createdBy });
        rows.forEach((row) => row.exists && tx.update(row.ref, { memberIds, createdBy }));
      });
    if (!conversations.empty) return;
    await ref.update({
      stage: stage + 1,
      settleAfter: Timestamp.fromMillis(Date.now() + 10 * 60000),
    });
    return;
  }
  if (job.settleAfter?.toMillis() > Date.now()) return;
  if (!(await db.collection('_socialMedia').where('uid', '==', uid).limit(1).get()).empty) return;
  if (!(await db.collection('_socialCleanup').where('uid', '==', uid).limit(1).get()).empty) return;
  // Revisit any save/follow trigger output before final profile removal.
  const user = await db.doc(`users/${uid}`).get();
  if (user.data()?.usernameLower) await db.doc(`usernames/${user.data()!.usernameLower}`).delete();
  await getStorage().bucket().file(`avatars/${uid}`).delete({ ignoreNotFound: true });
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await getAuth()
    .deleteUser(uid)
    .catch((e) => {
      if (e.code !== 'auth/user-not-found') throw e;
    });
  await db.doc(`_socialAccounts/${uid}`).delete();
  await ref.update({ complete: true, completedAt: FieldValue.serverTimestamp() });
}
export const processAccountDeletions = onSchedule(
  { schedule: 'every 1 minutes', maxInstances: 1, timeoutSeconds: 300 },
  async () => {
    const jobs = await db
      .collection('_accountDeletion')
      .where('complete', '!=', true)
      .limit(5)
      .get();
    for (const job of jobs.docs) await deleteAccountBatch(job.id);
  },
);
export const submitProfileText = onCall(async (r) => {
  const { uid, user } = await socialContext(r);
  await rateLimit(uid, 'profileEdit', 20);
  const photoMediaId = r.data?.photoMediaId ? socialId(r.data.photoMediaId) : null;
  if (photoMediaId) {
    const m = (await db.doc(`_socialMedia/${photoMediaId}`).get()).data();
    if (!m || m.uid !== uid || m.postId !== `profile_${uid}` || m.kind !== 'photo')
      throw new HttpsError('permission-denied', 'Choose your own profile photo.');
  }
  if (typeof r.data?.bio !== 'string' || r.data.bio.length > 160)
    throw new HttpsError('invalid-argument', 'Keep your bio within 160 characters.');
  const id = hash(`profile:${uid}`);
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`_textSubmissions/${id}`),
      old = await tx.get(ref),
      version = (old.data()?.version || 0) + 1;
    tx.set(ref, {
      uid,
      kind: 'profile',
      targetPath: `users/${uid}`,
      fields: {
        bio: r.data.bio.trim(),
        ...(user.usernameLower ? { username: user.usernameLower } : {}),
      },
      photoMediaId,
      status: 'pending',
      version,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.doc(`_moderation/text_${id}`), {
      uid,
      kind: 'text',
      targetId: id,
      version,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { status: 'pending' };
});
export const submitTrackComment = onCall(async (r) => {
  const { uid } = await socialContext(r, true);
  const trackId = String(r.data?.trackId || ''),
    body = String(r.data?.body || '').trim(),
    requestId = String(r.data?.requestId || '');
  if (
    !/^[\w-]{1,128}$/.test(trackId) ||
    !/^[\w-]{1,128}$/.test(requestId) ||
    !body ||
    body.length > 1000
  )
    throw new HttpsError('invalid-argument', 'Check your comment.');
  if (!(await db.doc(`tracks/${trackId}`).get()).exists)
    throw new HttpsError('not-found', 'Track unavailable.');
  const id = hash(`${uid}:${requestId}`);
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`_textSubmissions/${id}`),
      old = await tx.get(ref);
    if (old.exists) return;
    const charge = await quota(tx, uid, 'comments', 20);
    charge();
    tx.create(ref, {
      uid,
      kind: 'trackComment',
      targetPath: `tracks/${trackId}/comments/${id}`,
      body,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.doc(`_moderation/text_${id}`), {
      uid,
      kind: 'text',
      targetId: id,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { status: 'pending' };
});

export const authorizeProfilePhoto = onCall(async (r) => {
  const { uid, flags } = await socialContext(r);
  if (flags.uploads !== true)
    throw new HttpsError(
      'failed-precondition',
      'Photo uploads are not available yet. You can continue without one.',
    );
  const id = socialId(r.data?.id),
    bytes = r.data?.bytes;
  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > 2 * 1024 * 1024)
    throw new HttpsError('invalid-argument', 'Choose a photo under 2 MB.');
  await rateLimit(uid, 'profilePhoto', 10, 86400000);
  const postId = `profile_${uid}`,
    path = `social-staging/${uid}/${postId}/${id}`;
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`_socialMedia/${id}`),
      old = await tx.get(ref);
    if (old.exists) {
      if (old.data()!.uid !== uid || old.data()!.postId !== postId)
        throw new HttpsError('permission-denied', 'Upload unavailable.');
      return;
    }
    tx.set(db.doc(`_postDrafts/${postId}`), {
      uid,
      purpose: 'profile',
      status: 'draft',
      kind: 'post',
      text: '',
      mediaIds: [],
      scenes: [],
      attachment: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.create(ref, {
      uid,
      postId,
      kind: 'photo',
      bytes,
      mime: 'image/jpeg',
      path,
      status: 'authorized',
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 86400000),
    });
  });
  return { path };
});

export const reserveCommunityUsername = onCall(async (r) => {
  const { uid } = await socialContext(r);
  const name = typeof r.data?.username === 'string' ? r.data.username.trim().toLowerCase() : '';
  if (!/^[a-z0-9_]{3,20}$/.test(name))
    throw new HttpsError(
      'invalid-argument',
      'Use 3–20 lowercase letters, numbers, or underscores.',
    );
  await rateLimit(uid, 'username', 30);
  await db.runTransaction(async (tx) => {
    const userRef = db.doc(`users/${uid}`),
      reservation = db.doc(`usernames/${name}`),
      id = hash(`profile:${uid}`),
      submission = db.doc(`_textSubmissions/${id}`);
    const [user, taken, old] = await Promise.all([
      tx.get(userRef),
      tx.get(reservation),
      tx.get(submission),
    ]);
    if (!user.exists) throw new HttpsError('failed-precondition', 'Create your profile first.');
    if (taken.exists && taken.data()!.uid !== uid)
      throw new HttpsError('already-exists', 'That username is taken.');
    if (user.data()!.usernameLower && user.data()!.usernameLower !== name)
      throw new HttpsError('failed-precondition', 'Your username is already reserved.');
    if (taken.exists && user.data()!.usernameLower === name) return;
    const version = (old.data()?.version || 0) + 1;
    tx.set(reservation, { uid, createdAt: FieldValue.serverTimestamp() });
    tx.update(userRef, { usernameLower: name, onboardingStep: 2 });
    tx.set(submission, {
      uid,
      kind: 'profile',
      targetPath: userRef.path,
      fields: { username: name },
      version,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.doc(`_moderation/text_${id}`), {
      uid,
      kind: 'text',
      targetId: id,
      version,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { status: 'pending' };
});
