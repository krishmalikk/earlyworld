import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db, tracksFor, FieldValue } from './core';
import { rotationScore } from '../../shared/domain';
import { computeMatchesFor } from './matching';
export async function computeRotationFor(uid: string, now = new Date()) {
  const stats = await db.collection(`users/${uid}/engagementStats`).get();
  for (const item of stats.docs) {
    const data = item.data();
    const [tracks, entity] = await Promise.all([
      tracksFor(data.trackIds || []),
      db.doc(`${data.entityType === 'producer' ? 'producers' : 'artists'}/${item.id}`).get(),
    ]);
    if (!entity.exists) continue;
    const score = rotationScore(
      tracks.map((t) => t.data()!.saveCount || 0),
      data.weekKeys || [],
      data.lastEventAt.toDate(),
      now,
    );
    await db.doc(`users/${uid}/rotation/${item.id}`).set({
      entityId: item.id,
      uid,
      entityType: data.entityType,
      name: entity.data()!.name,
      imageUrl: entity.data()!.imageUrl || '',
      ...score,
      firstEngagedAt: data.firstEngagedAt,
      lastEngagedAt: data.lastEventAt,
      lastComputedAt: FieldValue.serverTimestamp(),
    });
  }
}
// Recompute every completed account, including quiet ones, so recency decay actually applies.
export const computeRotation = onSchedule(
  { schedule: 'every day 03:00', timeZone: 'UTC', timeoutSeconds: 540 },
  async () => {
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    do {
      let query = db
        .collection('users')
        .where('onboardingComplete', '==', true)
        .orderBy('__name__')
        .limit(50);
      if (cursor) query = query.startAfter(cursor);
      const page = await query.get();
      for (const user of page.docs) await computeRotationFor(user.id);
      cursor = page.size === 50 ? page.docs[page.size - 1] : undefined;
    } while (cursor);
  },
);
export const nightlyMatches = onSchedule(
  { schedule: 'every day 04:00', timeZone: 'UTC', timeoutSeconds: 540 },
  async () => {
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    do {
      let query = db
        .collection('users')
        .where('onboardingComplete', '==', true)
        .orderBy('__name__')
        .limit(50);
      if (cursor) query = query.startAfter(cursor);
      const page = await query.get();
      for (const user of page.docs) await computeMatchesFor(user.id);
      cursor = page.size === 50 ? page.docs[page.size - 1] : undefined;
    } while (cursor);
  },
);
