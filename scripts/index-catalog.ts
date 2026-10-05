import { CATALOG_KINDS } from '../shared/catalog-search';
async function main() {
  if (!process.env.GCLOUD_PROJECT) throw new Error('Set GCLOUD_PROJECT.');
  if (!process.env.FIRESTORE_EMULATOR_HOST && !process.argv.includes('--production'))
    throw new Error('Pass --production for a live project.');
  const { db, FieldValue } = await import('../functions/src/core');
  const { backfillSearchPage } = await import('../functions/src/catalog-search');
  const state = db.doc('_catalogControl/search');
  try {
    const saved = (await state.get()).data() || {};
    for (const kind of CATALOG_KINDS) {
      if (saved[kind]?.complete && !process.argv.includes('--rebuild')) continue;
      let cursor: string | null = process.argv.includes('--rebuild')
        ? null
        : saved[kind]?.after || null;
      do {
        cursor = await backfillSearchPage(kind, cursor || undefined);
        await state.set({ [kind]: { after: cursor, complete: !cursor } }, { merge: true });
        console.log(JSON.stringify({ kind, nextCursor: cursor }));
      } while (cursor);
    }
    const counts = Object.fromEntries(
      await Promise.all(
        CATALOG_KINDS.map(async (kind) => [
          kind,
          (await db.collection(kind).count().get()).data().count,
        ]),
      ),
    );
    await state.set({ ready: true, completedAt: FieldValue.serverTimestamp() }, { merge: true });
    await db
      .doc('catalogStats/current')
      .set({ ...counts, updatedAt: FieldValue.serverTimestamp() });
    console.log(JSON.stringify({ ready: true, counts }));
  } finally {
    await db.terminate();
  }
}
main().catch(() => {
  console.error(
    'Catalog indexing stopped. Check project permissions and resume with authorized Application Default Credentials.',
  );
  process.exitCode = 1;
});
