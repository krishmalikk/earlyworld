import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
async function main() {
  if (
    !process.env.GCLOUD_PROJECT ||
    (!process.env.FIRESTORE_EMULATOR_HOST && !process.argv.includes('--production'))
  )
    throw Error('Specify a project and --production for live imports.');
  const pages = Number(process.argv.find((a) => a.startsWith('--pages='))?.slice(8) || 1);
  if (!Number.isInteger(pages) || pages < 1 || pages > 100) throw Error('Choose 1–100 pages.');
  const env = parseEnv(await readFile('.env', 'utf8'));
  for (const key of ['SOUNDCLOUD_CLIENT_ID', 'SOUNDCLOUD_CLIENT_SECRET'])
    if (!process.env[key]) process.env[key] = env[key];
  const { db } = await import('../functions/src/core');
  const { syncReleaseCatalogPage } = await import('../functions/src/releases');
  try {
    for (let page = 0; page < pages; page++) {
      const result = await syncReleaseCatalogPage();
      console.log(JSON.stringify({ page: page + 1, ...result }));
      if (result.complete) break;
    }
  } finally {
    await db.terminate();
  }
}
main().catch(() => {
  console.error(
    'Release sync stopped. Check authorized Application Default Credentials and provider availability. Completed releases and artist checkpoints are preserved.',
  );
  process.exitCode = 1;
});
