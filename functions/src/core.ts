import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { createHash } from 'node:crypto';
initializeApp();
export const db = getFirestore();
export { FieldValue, Timestamp };
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function authUid(request: CallableRequest) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  return request.auth.uid;
}
export function requiredText(value: unknown, label: string, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new HttpsError('invalid-argument', `Check ${label}.`);
  return value.trim();
}
export const chunks = <T>(array: T[], size = 30): T[][] =>
  Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, (i + 1) * size),
  );
export async function tracksFor(ids: string[]) {
  const docs = [];
  for (const group of chunks([...new Set(ids)]))
    docs.push(...(await db.getAll(...group.map((id) => db.doc(`tracks/${id}`)))));
  return docs.filter((d) => d.exists);
}
export async function rateLimit(uid: string, action: string, max: number, interval = 3600000) {
  const ref = db.doc(
    `_rateLimits/${hash(`${uid}:${action}:${Math.floor(Date.now() / interval)}`)}`,
  );
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if ((snap.data()?.count || 0) >= max)
      throw new HttpsError('resource-exhausted', 'Try again a little later.');
    tx.set(
      ref,
      {
        count: FieldValue.increment(1),
        expiresAt: Timestamp.fromMillis(Date.now() + interval * 2),
      },
      { merge: true },
    );
  });
}
