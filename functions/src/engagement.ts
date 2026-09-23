import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import type { Transaction, DocumentData } from 'firebase-admin/firestore';
import { authUid, db, FieldValue, hash, requiredText, Timestamp, rateLimit } from './core';
import { cappedUnion, isoWeek, type EntityType } from '../../shared/domain';

/** All reads precede writes, including both artist and producer stats and daily limits. */
export async function engagementInTransaction(
  tx: Transaction,
  uid: string,
  trackId: string,
  track: DocumentData,
  event: 'listen' | 'comment' | 'save',
  seconds: number,
  eventId: string,
  at: Date,
) {
  const entities = [
    { id: track.artistId, type: 'artist' as EntityType },
    ...(track.producerId ? [{ id: track.producerId, type: 'producer' as EntityType }] : []),
  ];
  const marker = db.doc(`_engagementEvents/${hash(eventId)}`);
  const [seen, user, ...snapshots] = await Promise.all([
    tx.get(marker),
    tx.get(db.doc(`users/${uid}`)),
    ...entities.flatMap((e) => [
      tx.get(db.doc(`users/${uid}/engagementStats/${e.id}`)),
      tx.get(db.doc(`_commentDays/${hash(`${uid}:${e.id}:${at.toISOString().slice(0, 10)}`)}`)),
    ]),
  ]);
  if (
    seen.exists ||
    !user.data()?.onboardingComplete ||
    (user.data()?.onboardingCompletedAt?.toMillis() || 0) > at.getTime()
  )
    return;
  const week = isoWeek(at);
  entities.forEach((entity, i) => {
    const existing = snapshots[i * 2];
    const daily = snapshots[i * 2 + 1];
    if (event === 'comment' && (daily.data()?.count || 0) >= 5) return;
    const stats = existing.data() || {};
    tx.set(existing.ref, {
      entityId: entity.id,
      entityType: entity.type,
      trackIds: cappedUnion(stats.trackIds || [], trackId, 300),
      weekKeys: cappedUnion(stats.weekKeys || [], week, 104),
      listenSeconds: (stats.listenSeconds || 0) + (event === 'listen' ? seconds : 0),
      commentCount: (stats.commentCount || 0) + Number(event === 'comment'),
      saveCount: (stats.saveCount || 0) + Number(event === 'save'),
      firstEngagedAt:
        stats.firstEngagedAt && stats.firstEngagedAt.toMillis() < +at
          ? stats.firstEngagedAt
          : Timestamp.fromDate(at),
      lastEventAt:
        stats.lastEventAt && stats.lastEventAt.toMillis() > +at
          ? stats.lastEventAt
          : Timestamp.fromDate(at),
    });
    if (event === 'comment')
      tx.set(
        daily.ref,
        { count: FieldValue.increment(1), expiresAt: Timestamp.fromMillis(+at + 3 * 86400000) },
        { merge: true },
      );
  });
  tx.create(marker, { at: Timestamp.fromDate(at) });
  tx.update(user.ref, { lastActiveAt: Timestamp.fromDate(at) });
}
export const beginPlayback = onCall(async (request) => {
  const uid = authUid(request);
  const trackId = requiredText(request.data?.trackId, 'track', 100);
  const track = await db.doc(`tracks/${trackId}`).get();
  if (!track.exists) throw new HttpsError('not-found', 'Track not found.');
  await rateLimit(uid, 'playback', 120);
  const ref = db.collection('_playbackSessions').doc();
  await ref.create({
    uid,
    trackId,
    startedAt: FieldValue.serverTimestamp(),
    used: false,
    expiresAt: Timestamp.fromMillis(Date.now() + 2 * 3600000),
  });
  return { sessionId: ref.id };
});
export const recordEngagement = onCall(async (request) => {
  const uid = authUid(request),
    data = request.data || {};
  const trackId = requiredText(data.trackId, 'track', 100),
    entityId = requiredText(data.entityId, 'entity', 100);
  if (data.eventType !== 'listen')
    throw new HttpsError(
      'invalid-argument',
      'Saves and comments are recorded from their server triggers.',
    );
  const sessionId = requiredText(data.sessionId, 'playback session', 100);
  const seconds = Number(data.seconds),
    duration = Number(data.duration);
  if (
    !Number.isFinite(seconds) ||
    !Number.isFinite(duration) ||
    duration < 10 ||
    duration > 3600 ||
    seconds < duration * 0.6 ||
    seconds > duration + 2
  )
    throw new HttpsError('invalid-argument', 'Incomplete listen.');
  const now = new Date();
  return db.runTransaction(async (tx) => {
    const sessionRef = db.doc(`_playbackSessions/${sessionId}`),
      lock = db.doc(`_listenLocks/${hash(`${uid}:${trackId}`)}`);
    const [session, track, last] = await Promise.all([
      tx.get(sessionRef),
      tx.get(db.doc(`tracks/${trackId}`)),
      tx.get(lock),
    ]);
    const t = track.data(),
      s = session.data();
    if (
      !t ||
      !s ||
      s.uid !== uid ||
      s.trackId !== trackId ||
      s.used ||
      now.getTime() - s.startedAt.toMillis() > 2 * 3600000
    )
      throw new HttpsError('failed-precondition', 'Start playback again.');
    if (
      !['artist', 'producer'].includes(data.entityType) ||
      t[data.entityType === 'artist' ? 'artistId' : 'producerId'] !== entityId
    )
      throw new HttpsError('invalid-argument', 'Entity does not belong to this track.');
    if (
      t.durationSeconds &&
      Math.abs(t.durationSeconds - duration) > Math.max(3, t.durationSeconds * 0.05)
    )
      throw new HttpsError('invalid-argument', 'Duration mismatch.');
    if (now.getTime() - s.startedAt.toMillis() < seconds * 1000 * 0.95)
      throw new HttpsError('failed-precondition', 'Listen has not completed.');
    if (last.exists && now.getTime() - last.data()!.at.toMillis() < 3600000)
      return { recorded: false };
    await engagementInTransaction(
      tx,
      uid,
      trackId,
      t,
      'listen',
      Math.floor(seconds),
      `listen:${sessionId}`,
      now,
    );
    tx.update(sessionRef, { used: true });
    tx.set(lock, { at: Timestamp.fromDate(now) });
    return { recorded: true };
  });
});
export const onComment = onDocumentCreated(
  { document: 'tracks/{trackId}/comments/{commentId}', retry: true },
  async (event) => {
    if (!event.data) return;
    const comment = event.data.data();
    await db.runTransaction(async (tx) => {
      const track = await tx.get(db.doc(`tracks/${event.params.trackId}`));
      if (track.exists)
        await engagementInTransaction(
          tx,
          comment.uid,
          track.id,
          track.data()!,
          'comment',
          0,
          event.id,
          comment.createdAt.toDate(),
        );
    });
  },
);
