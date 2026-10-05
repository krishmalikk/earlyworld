import { randomUUID } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, tracksFor, FieldValue, authUid, Timestamp } from './core';
import { blocked } from './social-core';
import { matchScores, type MatchTrack } from '../../shared/domain';
/** Coalesce overlapping requests; a pending fifth-save refresh must never be lost. */
export async function computeMatchesFor(uid: string) {
  const lease = db.doc(`_matchLeases/${uid}`),
    token = randomUUID();
  const claimed = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(lease);
    if ((snapshot.data()?.until?.toMillis() || 0) > Date.now()) {
      tx.update(lease, { pending: true });
      return false;
    }
    tx.set(lease, { token, pending: false, until: Timestamp.fromMillis(Date.now() + 300000) });
    return true;
  });
  if (!claimed) return;
  try {
    let again = true;
    while (again) {
      const user = await db.doc(`users/${uid}`).get();
      const saves = await db.collection(`users/${uid}/saves`).get();
      const tracks = await tracksFor(saves.docs.map((d) => d.id));
      const results = matchScores(
        uid,
        tracks.map((t) => ({ id: t.id, ...t.data() }) as MatchTrack),
      );
      const visibleResults: typeof results = [];
      for (const result of results)
        if (
          !(await blocked(uid, result.uid)) &&
          !(await db.doc(`_socialAccounts/${result.uid}`).get()).data()?.suspended
        )
          visibleResults.push(result);
      const old = await db.collection(`users/${uid}/matches`).get();
      again = await db.runTransaction(async (tx) => {
        const current = await tx.get(lease);
        if (current.data()?.token !== token) return false;
        old.docs.forEach((d) => tx.delete(d.ref));
        visibleResults.forEach(({ uid: matchUid, ...data }) =>
          tx.set(db.doc(`users/${uid}/matches/${matchUid}`), {
            ...data,
            computedAt: FieldValue.serverTimestamp(),
          }),
        );
        if (user.exists)
          tx.update(user.ref, { lastMatchedSaveEvent: user.data()!.totalSaveEvents || 0 });
        if (current.data()?.pending) {
          tx.update(lease, { pending: false, until: Timestamp.fromMillis(Date.now() + 300000) });
          return true;
        }
        tx.delete(lease);
        return false;
      });
    }
  } finally {
    await db.runTransaction(async (tx) => {
      const current = await tx.get(lease);
      if (current.data()?.token === token) tx.delete(lease);
    });
  }
}
// Called only after onboarding. Regular refreshes are triggered by saves and schedules.
export const computeMatches = onCall(async (request) => {
  const uid = authUid(request),
    user = await db.doc(`users/${uid}`).get();
  if (!user.data()?.onboardingComplete)
    throw new HttpsError('failed-precondition', 'Finish onboarding first.');
  if (user.data()?.initialMatchesComputed) return { queued: false };
  await computeMatchesFor(uid);
  await user.ref.update({ initialMatchesComputed: true });
  return { queued: true };
});
