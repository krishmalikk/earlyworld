import { randomUUID } from 'node:crypto';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldPath } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { authUid, db, FieldValue, hash, rateLimit } from './core';
import {
  CATALOG_KINDS,
  catalogIndex,
  searchNeedle,
  searchText,
  type CatalogKind,
} from '../../shared/catalog-search';

/** Re-read inside the transaction: duplicated/out-of-order events cannot restore stale entries. */
export async function indexCatalogDocument(kind: CatalogKind, id: string) {
  const source = db.doc(`${kind}/${id}`),
    target = db.doc(`_catalogSearch/${kind}_${id}`);
  await db
    .runTransaction(async (tx) => {
      const snap = await tx.get(source);
      if (!snap.exists) {
        tx.delete(target);
        return;
      }
      const data = snap.data()!;
      const artist =
        typeof data.artistId === 'string' ? await tx.get(db.doc(`artists/${data.artistId}`)) : null;
      const value = { ...catalogIndex(kind, data, artist?.data()?.scenes || []), sourceId: id };
      const fingerprint = hash(JSON.stringify(value));
      const previous = await tx.get(target);
      if (previous.data()?.fingerprint !== fingerprint) tx.set(target, { ...value, fingerprint });
    })
    .catch((error) => {
      logger.error('Catalog index record failed', {
        kind,
        id,
        code: typeof error?.code === 'number' ? error.code : 'unknown',
      });
      throw error;
    });
}
const indexTrigger = (kind: CatalogKind) =>
  onDocumentWritten(`${kind}/{id}`, (event) => indexCatalogDocument(kind, event.params.id));
export const indexTrack = indexTrigger('tracks');
export const indexArtist = onDocumentWritten('artists/{id}', async (event) => {
  await indexCatalogDocument('artists', event.params.id);
  if (
    JSON.stringify(event.data?.before.data()?.scenes || []) !==
    JSON.stringify(event.data?.after.data()?.scenes || [])
  )
    await db
      .doc(`_catalogReindex/${event.params.id}`)
      .set({ tracks: { complete: false }, releases: { complete: false } });
});
export const indexProducer = indexTrigger('producers');
export const indexRelease = indexTrigger('releases');

type SearchInput = {
  kind: CatalogKind;
  text?: string;
  scenes?: string[];
  after?: string | null;
  producerName?: string;
};
export async function searchCatalogPage(input: SearchInput) {
  if (
    !input ||
    !CATALOG_KINDS.includes(input.kind) ||
    typeof (input.text || '') !== 'string' ||
    (input.text || '').length > 120
  )
    throw new HttpsError('invalid-argument', 'Check the catalog search.');
  if (
    input.after &&
    (typeof input.after !== 'string' || !/^[a-zA-Z0-9_-]{1,180}$/.test(input.after))
  )
    throw new HttpsError('invalid-argument', 'Invalid search cursor.');
  if (
    input.scenes &&
    (!Array.isArray(input.scenes) ||
      input.scenes.length > 12 ||
      input.scenes.some((s) => typeof s !== 'string' || s.length > 80))
  )
    throw new HttpsError('invalid-argument', 'Check scenes.');
  if (
    input.producerName &&
    (typeof input.producerName !== 'string' || input.producerName.length > 200)
  )
    throw new HttpsError('invalid-argument', 'Check producer.');
  const ready = await db.doc('_catalogControl/search').get();
  if (!ready.data()?.ready)
    throw new HttpsError(
      'failed-precondition',
      'Catalog search is being prepared. Please try again shortly.',
    );
  const text = searchText(input.text || '');
  let q: FirebaseFirestore.Query = db.collection('_catalogSearch').where('kind', '==', input.kind);
  if (text) q = q.where('grams', 'array-contains', searchNeedle(text));
  // One array condition per query. Remaining filters are checked in a bounded candidate page.
  else if (input.scenes?.length) q = q.where('scenes', 'array-contains-any', input.scenes);
  else if (input.producerName)
    q = q.where('producerNames', 'array-contains', searchText(input.producerName));
  q = q.orderBy(FieldPath.documentId());
  if (input.after) q = q.startAfter(input.after);
  const page = await q.limit(250).get();
  const ids: string[] = [];
  let last = input.after || null,
    scanned = 0;
  for (const doc of page.docs) {
    const entry = doc.data();
    last = doc.id;
    scanned++;
    if (
      entry.available &&
      (!text || entry.text.includes(text)) &&
      (!input.scenes?.length || input.scenes.some((s) => entry.scenes.includes(s))) &&
      (!input.producerName || entry.producerNames.includes(searchText(input.producerName)))
    )
      ids.push(entry.sourceId);
    if (ids.length === 25) break;
  }
  return { ids, nextCursor: scanned < page.size || page.size === 250 ? last : null, scanned };
}
export const searchCatalog = onCall(async (request) => {
  const uid = authUid(request);
  await rateLimit(uid, 'catalogSearch', 600);
  return searchCatalogPage(request.data);
});

/** Explicit, resumable operator migration; never scans a collection from a phone. */
export async function backfillSearchPage(kind: CatalogKind, after?: string) {
  let q = db.collection(kind).orderBy(FieldPath.documentId()).limit(250);
  if (after) q = q.startAfter(after);
  const page = await q.get();
  // Bound concurrency and read the authoritative record in each indexing transaction.
  for (let i = 0; i < page.size; i += 10)
    await Promise.all(page.docs.slice(i, i + 10).map((doc) => indexCatalogDocument(kind, doc.id)));
  return page.size === 250 ? page.docs.at(-1)!.id : null;
}

/** On the first rollout, build the existing catalog index in bounded, restartable pages. */
export async function maintainCatalogSearch() {
  const control = db.doc('_catalogControl/search');
  const owner = randomUUID();
  const claimed = await db.runTransaction(async (tx) => {
    const current = (await tx.get(control)).data() || {};
    if (current.leaseUntil > Date.now()) return false;
    tx.set(control, { owner, leaseUntil: Date.now() + 240000 }, { merge: true });
    return true;
  });
  if (!claimed) return;
  try {
    let remaining = 1000;
    const current = (await control.get()).data() || {};
    if (!current.ready) {
      for (const kind of CATALOG_KINDS) {
        if (current[kind]?.complete) continue;
        let cursor = current[kind]?.after || undefined;
        do {
          cursor = (await backfillSearchPage(kind, cursor)) || undefined;
          await control.set(
            { [kind]: { after: cursor || null, complete: !cursor } },
            { merge: true },
          );
          remaining -= 250;
        } while (cursor && remaining > 0);
        if (remaining <= 0) return;
      }
      await control.set(
        { ready: true, completedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    }
    // Artist scene changes also reindex the associated track/release search entries.
    const pending = await db.collection('_catalogReindex').limit(1).get();
    for (const job of pending.docs) {
      for (const kind of ['tracks', 'releases'] as const) {
        if (job.data()[kind]?.complete) continue;
        let q = db
          .collection(kind)
          .where('artistId', '==', job.id)
          .orderBy(FieldPath.documentId())
          .limit(250);
        if (job.data()[kind]?.after) q = q.startAfter(job.data()[kind].after);
        const docs = await q.get();
        for (let i = 0; i < docs.size; i += 10)
          await Promise.all(
            docs.docs.slice(i, i + 10).map((d) => indexCatalogDocument(kind, d.id)),
          );
        await db.runTransaction(async (tx) => {
          const latest = await tx.get(job.ref);
          if (latest.updateTime?.isEqual(job.updateTime!))
            tx.set(
              job.ref,
              { [kind]: { after: docs.docs.at(-1)?.id || null, complete: docs.size < 250 } },
              { merge: true },
            );
        });
        return; // Re-read the updated checkpoint next tick, including its update time.
      }
      await db.runTransaction(async (tx) => {
        const latest = await tx.get(job.ref);
        if (latest.data()?.tracks?.complete && latest.data()?.releases?.complete)
          tx.delete(job.ref);
      });
    }
  } finally {
    await db.runTransaction(async (tx) => {
      if ((await tx.get(control)).data()?.owner === owner) tx.update(control, { leaseUntil: 0 });
    });
  }
}
export const buildCatalogSearch = onSchedule(
  { schedule: 'every 1 minutes', timeoutSeconds: 240, maxInstances: 1 },
  maintainCatalogSearch,
);
