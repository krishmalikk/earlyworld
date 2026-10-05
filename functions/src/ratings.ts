import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue, hash, rateLimit, requiredText } from './core';
import { socialContext, touchSocial } from './social-core';
import { REVIEW_LIMIT, validHalfStars } from '../../shared/ratings';

export const ratingId = (uid: string, trackId: string) => hash(`${uid}:${trackId}`);

function ratingApi(kind: 'track' | 'release') {
  const items = kind === 'track' ? 'tracks' : 'releases';
  const ratings = kind === 'track' ? 'ratings' : 'releaseRatings';
  const idField = kind === 'track' ? 'trackId' : 'releaseId';
  const idsField = kind === 'track' ? 'trackIds' : 'releaseIds';
  const favoritesField = kind === 'track' ? 'favoriteTrackIds' : 'favoriteReleaseIds';
  const countField = kind === 'track' ? 'ratingCount' : 'releaseRatingCount';
  const reviewField = kind === 'track' ? 'reviewCount' : 'releaseReviewCount';
  const setRating = onCall(async (request) => {
    const { uid } = await socialContext(request);
    const trackId = requiredText(request.data?.[idField], kind, 100);
    if (trackId.includes('/')) throw new HttpsError('invalid-argument', 'Check track.');
    const halfStars = request.data?.halfStars;
    const rawReview = request.data?.review ?? '';
    if (!validHalfStars(halfStars))
      throw new HttpsError('invalid-argument', 'Choose a rating between ½ and 5 stars.');
    if (typeof rawReview !== 'string' || rawReview.length > REVIEW_LIMIT)
      throw new HttpsError('invalid-argument', 'Keep your review within 500 characters.');
    const review = rawReview.trim();
    await rateLimit(uid, kind === 'track' ? 'rating' : 'releaseRating', 60);
    return db.runTransaction(async (tx) => {
      const ref = db.doc(`${ratings}/${ratingId(uid, trackId)}`);
      const trackRef = db.doc(`${items}/${trackId}`),
        userRef = db.doc(`users/${uid}`);
      const submission = db.doc(`_textSubmissions/${hash(`review:${ratings}:${uid}:${trackId}`)}`);
      const [previous, track, user, pending] = await Promise.all([
        tx.get(ref),
        tx.get(trackRef),
        tx.get(userRef),
        tx.get(submission),
      ]);
      if (!track.exists) throw new HttpsError('not-found', `This ${kind} is no longer available.`);
      if (!user.exists)
        throw new HttpsError('failed-precondition', 'Finish creating your profile first.');
      const old = previous.data();
      const oldReview =
        pending.data()?.status === 'pending' ? pending.data()!.body : old?.review || '';
      if (old?.halfStars === halfStars && oldReview === review) return { changed: false };
      const reviewChanged = review !== oldReview;
      if (reviewChanged && review) {
        if (
          request.auth?.token.email_verified !== true ||
          !user.data()!.onboardingComplete ||
          !(await tx.get(db.doc(`_socialAccounts/${uid}`))).data()?.eligible
        )
          throw new HttpsError(
            'failed-precondition',
            'Verify your email and complete community access before writing a review.',
          );
      }
      const version = (pending.data()?.version || 0) + 1;
      const publicReview = review === '' ? '' : old?.review || '';
      if (reviewChanged) {
        if (review) {
          tx.set(submission, {
            uid,
            kind: 'review',
            targetPath: ref.path,
            body: review,
            status: 'pending',
            version,
            createdAt: FieldValue.serverTimestamp(),
          });
          tx.set(db.doc(`_moderation/text_${submission.id}`), {
            uid,
            kind: 'text',
            targetId: submission.id,
            version,
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
          });
        } else {
          tx.delete(submission);
          tx.delete(db.doc(`_moderation/text_${submission.id}`));
        }
      }
      const countDelta = previous.exists ? 0 : 1;
      const reviewDelta = Number(!!publicReview) - Number(!!old?.review);
      tx.set(ref, {
        uid,
        [idField]: trackId,
        halfStars,
        review: publicReview,
        ...(reviewChanged && review
          ? { pendingReviewVersion: version }
          : old?.pendingReviewVersion && review
            ? { pendingReviewVersion: old.pendingReviewVersion }
            : {}),
        createdAt: old?.createdAt ?? FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(trackRef, {
        ratingCount: (track.data()!.ratingCount || 0) + countDelta,
        ratingHalfStarSum:
          (track.data()!.ratingHalfStarSum || 0) + halfStars - (old?.halfStars || 0),
      });
      tx.update(userRef, {
        [countField]: (user.data()![countField] || 0) + countDelta,
        [reviewField]: (user.data()![reviewField] || 0) + reviewDelta,
      });
      touchSocial(tx, uid);
      return {
        changed: true,
        reviewPending: !!review && (reviewChanged || pending.data()?.status === 'pending'),
      };
    });
  });

  const deleteRating = onCall(async (request) => {
    const { uid } = await socialContext(request);
    const trackId = requiredText(request.data?.[idField], kind, 100);
    if (trackId.includes('/')) throw new HttpsError('invalid-argument', 'Check track.');
    await rateLimit(uid, kind === 'track' ? 'rating' : 'releaseRating', 60);
    return db.runTransaction(async (tx) => {
      const ref = db.doc(`${ratings}/${ratingId(uid, trackId)}`);
      const trackRef = db.doc(`${items}/${trackId}`),
        userRef = db.doc(`users/${uid}`);
      const submission = db.doc(`_textSubmissions/${hash(`review:${ratings}:${uid}:${trackId}`)}`);
      const [previous, track, user] = await Promise.all([
        tx.get(ref),
        tx.get(trackRef),
        tx.get(userRef),
      ]);
      if (!previous.exists) return { changed: false };
      tx.delete(ref);
      tx.delete(submission);
      tx.delete(db.doc(`_moderation/text_${submission.id}`));
      touchSocial(tx, uid);
      if (track.exists)
        tx.update(trackRef, {
          ratingCount: Math.max(0, (track.data()!.ratingCount || 0) - 1),
          ratingHalfStarSum: Math.max(
            0,
            (track.data()!.ratingHalfStarSum || 0) - previous.data()!.halfStars,
          ),
        });
      if (user.exists)
        tx.update(userRef, {
          [countField]: Math.max(0, (user.data()![countField] || 0) - 1),
          [reviewField]: Math.max(
            0,
            (user.data()![reviewField] || 0) - Number(!!previous.data()!.review),
          ),
        });
      return { changed: true };
    });
  });

  const setFavorites = onCall(async (request) => {
    const { uid } = await socialContext(request);
    const ids: unknown = request.data?.[idsField];
    if (
      !Array.isArray(ids) ||
      ids.length > 4 ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => typeof id !== 'string' || !id.trim() || id.length > 100 || id.includes('/'))
    )
      throw new HttpsError('invalid-argument', `Choose up to four different ${items}.`);
    await rateLimit(uid, kind === 'track' ? 'favorites' : 'releaseFavorites', 30);
    return db.runTransaction(async (tx) => {
      const ref = db.doc(`users/${uid}`);
      const user = await tx.get(ref);
      const tracks = await Promise.all(ids.map((id) => tx.get(db.doc(`${items}/${id}`))));
      if (!user.exists)
        throw new HttpsError('failed-precondition', 'Finish creating your profile first.');
      if (tracks.some((track) => !track.exists))
        throw new HttpsError('not-found', `One of these ${items} is no longer available.`);
      if (JSON.stringify(user.data()![favoritesField] || []) === JSON.stringify(ids))
        return { changed: false };
      tx.update(ref, { [favoritesField]: ids });
      return { changed: true };
    });
  });

  return { setRating, deleteRating, setFavorites };
}
export const {
  setRating: setTrackRating,
  deleteRating: deleteTrackRating,
  setFavorites: setFavoriteTracks,
} = ratingApi('track');
export const {
  setRating: setReleaseRating,
  deleteRating: deleteReleaseRating,
  setFavorites: setFavoriteReleases,
} = ratingApi('release');
