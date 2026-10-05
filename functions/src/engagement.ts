import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import type { Transaction, DocumentData } from 'firebase-admin/firestore';
import { db, FieldValue, hash, Timestamp } from './core';
import { cappedUnion, isoWeek, type EntityType } from '../../shared/domain';

/** All reads precede writes, including both artist and producer stats and daily limits. */
export async function engagementInTransaction(
  tx: Transaction,
  uid: string,
  trackId: string,
  track: DocumentData,
  event: 'comment' | 'save',
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
      // Preserve legacy history; new engagement comes only from saves and comments.
      listenSeconds: stats.listenSeconds || 0,
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
          event.id,
          comment.createdAt.toDate(),
        );
    });
  },
);
