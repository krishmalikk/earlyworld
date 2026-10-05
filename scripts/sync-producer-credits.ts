/** Resumable producer metadata import; never fetches audio or lyrics. */
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
async function main() {
  if (!process.env.GCLOUD_PROJECT) throw new Error('Set GCLOUD_PROJECT.');
  if (!process.env.FIRESTORE_EMULATOR_HOST && !process.argv.includes('--production'))
    throw new Error('Pass --production for the live project.');
  const apply = process.argv.includes('--apply');
  const arg = (name: string, fallback = '') =>
    process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] || fallback;
  const pages = Number(arg('pages', '1')),
    top = Number(arg('top', '4'));
  if (
    !Number.isInteger(pages) ||
    pages < 1 ||
    pages > 500 ||
    !Number.isInteger(top) ||
    top < 1 ||
    top > 20
  )
    throw new Error('Invalid page/producer limit.');
  const { db } = await import('../functions/src/core');
  const { geniusRequest, syncProducerPage } = await import('../functions/src/producer-credits');
  const producer = arg('producer');
  const refs = producer
    ? [await db.doc(`producers/${producer}`).get()]
    : (await db.collection('producers').orderBy('trackCount', 'desc').limit(top).get()).docs;
  console.log(
    JSON.stringify({
      apply,
      producers: refs.map((ref) => ({
        id: ref.id,
        name: ref.data()?.name,
        complete: ref.data()?.geniusSync?.complete || false,
      })),
      pages,
    }),
  );
  if (!apply) return;
  const env = parseEnv(await readFile('.env', 'utf8'));
  const token =
    process.env.GENIUS_ACCESS_TOKEN || env.GENIUS_ACCESS_TOKEN || env.CLIENT_ACCESS_TOKEN;
  if (!token) throw new Error('Missing Genius token.');
  const request = geniusRequest(token, 500);
  for (const ref of refs)
    for (let page = 0; page < pages; page++) {
      const result = await syncProducerPage(ref.id, request);
      console.log(JSON.stringify({ producer: ref.id, ...result }));
      if (result.complete) break;
    }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Producer sync failed.');
  process.exitCode = 1;
});
