import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

async function main() {
  if (!process.env.GCLOUD_PROJECT) throw new Error('Set GCLOUD_PROJECT explicitly.');
  if (!process.env.FIRESTORE_EMULATOR_HOST && !process.argv.includes('--production'))
    throw new Error('Pass --production explicitly for a live project.');
  try {
    const env = parseEnv(await readFile('.env', 'utf8'));
    for (const key of ['SOUNDCLOUD_CLIENT_ID', 'SOUNDCLOUD_CLIENT_SECRET'])
      if (!process.env[key] && env[key]) process.env[key] = env[key];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const { syncSoundCloudPage } = await import('../functions/src/soundcloud');
  const { db } = await import('../functions/src/core');
  const apply = process.argv.includes('--apply');
  const total = { checked: 0, refreshed: 0, unavailable: 0, conflicts: 0 };
  let cursor: string | undefined;
  try {
    do {
      const page = await syncSoundCloudPage(cursor, apply);
      for (const key of Object.keys(total) as (keyof typeof total)[]) total[key] += page[key];
      console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', ...total }));
      cursor = page.nextCursor || undefined;
    } while (cursor);
    if (total.conflicts) process.exitCode = 1;
  } finally {
    await db.terminate();
  }
}
main().catch(() => {
  console.error(
    'SoundCloud sync failed. Check server credentials, connectivity, and API availability, then rerun; completed pages are safe to repeat.',
  );
  process.exitCode = 1;
});
