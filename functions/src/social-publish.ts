import { db, FieldValue, hash } from './core';
import { touchSocial } from './social-core';
import { normalizePost } from '../../shared/social';

export type SubmissionKind = 'post' | 'comment' | 'text';
const collections = { post: '_postDrafts', comment: '_postComments', text: '_textSubmissions' };

/**
 * Publishes a submission as soon as it is complete; content is not held for review.
 * Returns false while it cannot publish yet (media still processing) or no longer
 * should (suspended author, blocked conversation, removed target). A later call retries.
 */
export async function publishSubmission(kind: SubmissionKind, id: string) {
  return db.runTransaction(async (tx) => {
    const draftRef = db.doc(`${collections[kind]}/${id}`),
      p = (await tx.get(draftRef)).data();
    if (!p || p.status !== 'pending') return false;
    const account = (await tx.get(db.doc(`_socialAccounts/${p.uid}`))).data();
    if (account?.suspended || account?.deleting) return false;
    if (kind === 'post') {
      const publicRef = db.doc(`posts/${id}`),
        old = await tx.get(publicRef);
      tx.set(publicRef, {
        ...normalizePost(p),
        attachment: p.attachment || null,
        uid: p.uid,
        version: p.version,
        status: 'published',
        publishedAt: old.data()?.publishedAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        likeCount: old.data()?.likeCount || 0,
        commentCount: old.data()?.commentCount || 0,
      });
      tx.update(draftRef, {
        status: 'published',
        reason: '',
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else if (kind === 'comment') {
      const postRef = db.doc(`posts/${p.postId}`),
        post = await tx.get(postRef);
      if (post.data()?.status !== 'published') return false;
      const author = post.data()!.uid;
      const [a, b, owner] = await tx.getAll(
        db.doc(`_socialBlocks/${hash(`${p.uid}:${author}`)}`),
        db.doc(`_socialBlocks/${hash(`${author}:${p.uid}`)}`),
        db.doc(`_socialAccounts/${author}`),
      );
      if (a.exists || b.exists || owner.data()?.suspended || owner.data()?.deleting) return false;
      tx.update(draftRef, { status: 'approved', reason: '' });
      tx.update(postRef, { commentCount: (post.data()!.commentCount || 0) + 1 });
    } else {
      const target = db.doc(p.targetPath),
        existing = await tx.get(target);
      if (!existing.exists && p.kind !== 'trackComment') return false;
      const userRef = db.doc(`users/${p.uid}`),
        user = await tx.get(userRef);
      const photo = p.photoMediaId
        ? (await tx.get(db.doc(`_socialMedia/${p.photoMediaId}`))).data()?.status
        : null;
      if (photo && photo !== 'ready' && photo !== 'failed') return false;
      if (p.kind === 'review') {
        if (existing.data()?.pendingReviewVersion !== p.version) return false;
        const countField = p.targetPath.startsWith('releaseRatings/')
          ? 'releaseReviewCount'
          : 'reviewCount';
        tx.update(target, {
          review: p.body,
          pendingReviewVersion: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.update(userRef, {
          [countField]:
            (user.data()?.[countField] || 0) + Number(!!p.body) - Number(!!existing.data()?.review),
        });
      } else if (p.kind === 'trackComment')
        tx.set(target, { uid: p.uid, body: p.body, createdAt: FieldValue.serverTimestamp() });
      else
        tx.update(target, {
          ...p.fields,
          ...(photo === 'ready' ? { avatarMediaId: p.photoMediaId, avatarUrl: '' } : {}),
        });
      tx.update(draftRef, {
        status: 'approved',
        reason: photo === 'failed' ? 'Your photo could not be processed. Choose another.' : '',
      });
    }
    touchSocial(tx, p.uid);
    return true;
  });
}
