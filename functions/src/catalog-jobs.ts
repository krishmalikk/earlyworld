import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { authUid, db, FieldValue, hash, rateLimit, requiredText } from './core';
import { enrich, GENIUS_ACCESS_TOKEN, geniusApi, GeniusRequestError } from './genius';

export async function enqueueGenius(trackId: string, priority: 0 | 10) {
  const ref = db.doc(`_catalogJobs/${trackId}`);
  await db.runTransaction(async (tx) => {
    const track = await tx.get(db.doc(`tracks/${trackId}`));
    if (!track.exists || track.data()!.credits || track.data()!.sourceStatus === 'unavailable')
      return;
    const value = track.data()!;
    const signature = hash(`${value.title}:${value.artistName}`);
    const job = (await tx.get(ref)).data();
    if (job?.signature === signature) {
      if (job.status === 'pending' && priority > job.priority) tx.update(ref, { priority });
      return;
    }
    tx.set(ref, {
      signature,
      priority,
      status: 'pending',
      attempts: 0,
      dueAt: Date.now(),
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}
export const requestTrackEnrichment = onCall(async (request) => {
  const uid = authUid(request),
    id = requiredText(request.data?.trackId, 'track', 100);
  if (id.includes('/')) throw new Error('Invalid track.');
  await rateLimit(uid, 'requestTrackEnrichment', 60);
  await enqueueGenius(id, 10);
  return { queued: true };
});
export const queueSavedTrack = onDocumentCreated('users/{uid}/saves/{trackId}', (event) =>
  enqueueGenius(event.params.trackId, 10),
);
export const queueRatedTrack = onDocumentCreated('ratings/{ratingId}', async (event) => {
  const id = event.data?.data().trackId;
  if (typeof id === 'string') await enqueueGenius(id, 10);
});

export function retryTime(attempt: number, retryAt = 0, now = Date.now()) {
  return Math.max(retryAt, now + Math.min(86400000, 60000 * 2 ** Math.min(attempt, 16)));
}
/** A single shared provider lease bounds concurrency across overlapping schedule deliveries. */
export async function runGeniusJobs(request = geniusApi, now = Date.now()) {
  const control = db.doc('_catalogControl/genius');
  const owner = randomUUID();
  const claimed = await db.runTransaction(async (tx) => {
    const config = (await tx.get(control)).data();
    if (!config?.enabled || config.leaseUntil > now || config.retryAt > now) return false;
    tx.update(control, { owner, leaseUntil: now + 240000 });
    return true;
  });
  if (!claimed) return { processed: 0 };
  let processed = 0;
  try {
    const config = (await control.get()).data() || {};
    if (!config.seedComplete) {
      let q = db.collection('tracks').orderBy('__name__').limit(25);
      if (config.seedCursor) q = q.startAfter(config.seedCursor);
      const tracks = await q.get();
      for (const track of tracks.docs) await enqueueGenius(track.id, 0);
      await control.update({
        seedCursor: tracks.docs.at(-1)?.id || null,
        seedComplete: tracks.size < 25,
      });
    }
    let nextRequest = 0;
    const paced: typeof geniusApi = async (path) => {
      if (request === geniusApi) await delay(Math.max(0, nextRequest - Date.now()));
      nextRequest = Date.now() + 1000;
      return request(path);
    };
    for (const priority of [10, 0]) {
      const jobs = await db
        .collection('_catalogJobs')
        .where('priority', '==', priority)
        .where('dueAt', '<=', now)
        .orderBy('dueAt')
        .limit(5 - processed)
        .get();
      for (const job of jobs.docs) {
        const claimedJob = await db.runTransaction(async (tx) => {
          const value = (await tx.get(job.ref)).data();
          if (!value || value.dueAt > now || !['pending', 'processing'].includes(value.status))
            return null;
          if (value.attempts >= 6) {
            tx.update(job.ref, {
              status: 'dead',
              dueAt: FieldValue.delete(),
              errorCode: 'attempts-exhausted',
            });
            return null;
          }
          const attempts = value.attempts + 1;
          tx.update(job.ref, { owner, status: 'processing', dueAt: now + 240000, attempts });
          return { signature: value.signature as string, attempts };
        });
        if (!claimedJob) continue;
        processed++;
        try {
          const outcome = await enrich(job.id, true, { request: paced });
          await db.runTransaction(async (tx) => {
            const current = (await tx.get(job.ref)).data();
            if (current?.owner === owner && current.signature === claimedJob.signature)
              tx.update(job.ref, {
                status: outcome,
                dueAt: FieldValue.delete(),
                finishedAt: FieldValue.serverTimestamp(),
                errorCode: FieldValue.delete(),
              });
          });
        } catch (error) {
          const status = error instanceof GeniusRequestError ? error.status : 0;
          const dueAt = retryTime(
            claimedJob.attempts,
            error instanceof GeniusRequestError ? error.retryAt : 0,
            now,
          );
          const dead = claimedJob.attempts >= 6 || status === 401 || status === 403;
          await db.runTransaction(async (tx) => {
            const current = (await tx.get(job.ref)).data();
            if (current?.owner === owner && current.signature === claimedJob.signature)
              tx.update(job.ref, {
                status: dead ? 'dead' : 'pending',
                dueAt: dead ? FieldValue.delete() : dueAt,
                errorCode: status ? `http-${status}` : 'provider-failure',
                lastAttemptAt: FieldValue.serverTimestamp(),
              });
            tx.update(control, {
              retryAt: dueAt,
              ...(status === 401 || status === 403 ? { enabled: false } : {}),
            });
          });
          return { processed };
        }
        if (processed >= 5) return { processed };
      }
    }
    return { processed };
  } finally {
    await db.runTransaction(async (tx) => {
      if ((await tx.get(control)).data()?.owner === owner) tx.update(control, { leaseUntil: 0 });
    });
  }
}
export const processCatalogJobs = onSchedule(
  {
    schedule: 'every 1 minutes',
    timeoutSeconds: 240,
    maxInstances: 1,
    secrets: [GENIUS_ACCESS_TOKEN],
  },
  async () => {
    await runGeniusJobs();
  },
);
