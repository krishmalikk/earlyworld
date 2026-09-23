import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { db, FieldValue, hash } from './core';
import { nextSavers } from '../../shared/domain';
import { engagementInTransaction } from './engagement';
import { computeMatchesFor } from './matching';
/** Reconcile current state, not delivery order: Firestore events are at-least-once and unordered. */
export const onSave = onDocumentWritten(
  { document: 'users/{uid}/saves/{trackId}', retry: true },
  async (event) => {
    const { uid, trackId } = event.params;
    const outcome = await db.runTransaction(async (tx) => {
      const saveRef = db.doc(`users/${uid}/saves/${trackId}`),
        trackRef = db.doc(`tracks/${trackId}`),
        userRef = db.doc(`users/${uid}`),
        stateRef = db.doc(`_saveState/${hash(`${uid}:${trackId}`)}`);
      const [save, track, user, state] = await Promise.all([
        tx.get(saveRef),
        tx.get(trackRef),
        tx.get(userRef),
        tx.get(stateRef),
      ]);
      if (!track.exists || !user.exists) return { due: false };
      const desired = save.exists,
        accounted = state.data()?.saved || false;
      if (desired === accounted)
        return {
          due: (user.data()!.totalSaveEvents || 0) - (user.data()!.lastMatchedSaveEvent || 0) >= 5,
        };
      const data = track.data()!;
      const delta = desired ? 1 : -1;
      const count = (user.data()!.totalSaveEvents || 0) + (desired ? 1 : 0);
      if (desired)
        await engagementInTransaction(
          tx,
          uid,
          trackId,
          data,
          'save',
          0,
          `save:${uid}:${trackId}:${save.createTime!.toMillis()}`,
          save.data()!.savedAt.toDate(),
        );
      const next = desired ? nextSavers(data.savers || [], data.saversCapped || false, uid) : null;
      tx.update(trackRef, {
        saveCount: FieldValue.increment(delta),
        ...(desired
          ? {
              saversCapped: next!.saversCapped,
              ...(next!.append ? { savers: FieldValue.arrayUnion(uid) } : {}),
            }
          : { savers: FieldValue.arrayRemove(uid) }),
      });
      tx.update(userRef, {
        saveCount: FieldValue.increment(delta),
        ...(desired ? { totalSaveEvents: count } : {}),
      });
      tx.set(stateRef, { saved: desired });
      const activity = db.doc(`activity/${hash(`${uid}:${trackId}`)}`);
      if (desired)
        tx.set(activity, {
          actorUid: uid,
          trackId,
          artistId: data.artistId,
          savedAt: save.data()!.savedAt,
        });
      else tx.delete(activity);
      return { due: count - (user.data()!.lastMatchedSaveEvent || 0) >= 5 };
    });
    if (outcome.due) await computeMatchesFor(uid);
  },
);
export const onFollow = onDocumentWritten(
  { document: 'users/{uid}/following/{target}', retry: true },
  async (event) => {
    const { uid, target } = event.params;
    await db.runTransaction(async (tx) => {
      const [follow, state, user] = await Promise.all([
        tx.get(db.doc(`users/${uid}/following/${target}`)),
        tx.get(db.doc(`_followState/${hash(`${uid}:${target}`)}`)),
        tx.get(db.doc(`users/${target}`)),
      ]);
      const desired = follow.exists && follow.data()?.targetType === 'user';
      if (!user.exists || desired === (state.data()?.following || false)) return;
      tx.update(user.ref, { followerCount: FieldValue.increment(desired ? 1 : -1) });
      tx.set(state.ref, { following: desired });
    });
  },
);
