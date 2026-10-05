/** Resumable, metadata-only backfill. Existing matches and social fields are preserved. */
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

async function main() {
  if (!process.env.GCLOUD_PROJECT) throw new Error('Set GCLOUD_PROJECT.');
  if (!process.env.FIRESTORE_EMULATOR_HOST && !process.argv.includes('--production'))
    throw new Error('Pass --production for a live project.');
  const apply = process.argv.includes('--apply');
  const interval = Number(
    process.argv.find((arg) => arg.startsWith('--interval-ms='))?.split('=')[1] || 250,
  );
  if (!Number.isInteger(interval) || interval < 250 || interval > 60000)
    throw new Error('Interval must be 250–60000 ms.');
  const env = parseEnv(await readFile('.env', 'utf8'));
  const token =
    process.env.GENIUS_ACCESS_TOKEN || env.GENIUS_ACCESS_TOKEN || env.CLIENT_ACCESS_TOKEN;
  if (!token) throw new Error('Missing Genius access token.');
  const { db, Timestamp } = await import('../functions/src/core');
  const { enrich } = await import('../functions/src/genius');
  const lease = db.doc('_integrations/geniusCatalogEnrichment');
  const owner = randomUUID();
  let leased = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  let failure: unknown;
  let nextRequestAt = 0;
  const counts = { checked: 0, matched: 0, unmatched: 0, ambiguous: 0, skipped: 0 };
  const report = () =>
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...counts }));
  const interrupt = () => {
    stopped = true;
  };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    const pending = await db.collection('tracks').where('geniusStatus', '==', 'deferred').get();
    console.log(
      JSON.stringify({ project: process.env.GCLOUD_PROJECT, deferred: pending.size, apply }),
    );
    if (!apply) return;
    await db.runTransaction(async (tx) => {
      const current = await tx.get(lease);
      if ((current.data()?.expiresAt?.toMillis() || 0) > Date.now())
        throw new Error('Another Genius enrichment run holds the lease.');
      tx.set(lease, { owner, expiresAt: Timestamp.fromMillis(Date.now() + 120000), ...counts });
    });
    leased = true;
    const refresh = async () => {
      await db.runTransaction(async (tx) => {
        const current = await tx.get(lease);
        if (current.data()?.owner !== owner) throw new Error('Enrichment lease lost.');
        tx.update(lease, { expiresAt: Timestamp.fromMillis(Date.now() + 120000), ...counts });
      });
    };
    heartbeat = setInterval(() => {
      void refresh().catch((error) => {
        failure = error;
        stopped = true;
      });
      report();
    }, 30000);
    const request: NonNullable<Parameters<typeof enrich>[2]>['request'] = async (path) => {
      // Shared spacing across workers; never burst or automatically retry a 429.
      const start = Math.max(Date.now(), nextRequestAt);
      nextRequestAt = start + interval;
      await delay(Math.max(0, start - Date.now()));
      if (stopped) throw new Error('Batch stopped.');
      const response = await fetch(`https://api.genius.com${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
      });
      if (!response.ok) {
        if (response.status === 429) {
          const retry = response.headers.get('retry-after');
          const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : undefined;
          const retryAt =
            seconds !== undefined ? Date.now() + seconds * 1000 : Date.parse(retry || '');
          console.error(
            JSON.stringify({
              rateLimited: true,
              retryAt: Number.isFinite(retryAt) ? new Date(retryAt).toISOString() : null,
            }),
          );
        }
        throw new Error(`Genius HTTP ${response.status}; run can be resumed.`);
      }
      return response.json();
    };
    const queue = [...pending.docs];
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (!stopped) {
          const track = queue.shift();
          if (!track) return;
          try {
            const outcome = await enrich(track.id, true, { request });
            counts[outcome]++;
            counts.checked++;
          } catch (error) {
            if (!failure) console.error(JSON.stringify({ failedTrack: track.id }));
            failure ||= error;
            stopped = true;
          }
        }
      }),
    );
    report();
    if (failure) throw failure;
    if (stopped) throw new Error('Interrupted; completed tracks are checkpointed in Firestore.');
    console.log('Genius enrichment complete.');
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    if (leased) {
      await db.runTransaction(async (tx) => {
        const current = await tx.get(lease);
        if (current.data()?.owner === owner)
          tx.update(lease, {
            expiresAt: Timestamp.fromMillis(0),
            ...counts,
            finishedAt: Timestamp.now(),
          });
      });
    }
    await db.terminate();
  }
}
main().catch((error) => {
  // Only fixed messages / HTTP codes; never print provider bodies, tokens, or user data.
  const message = error instanceof Error ? error.message : '';
  const safe = message.match(/^Genius HTTP \d+/)?.[0];
  const kind = error instanceof Error ? error.name.replace(/[^a-zA-Z]/g, '') : 'Unknown';
  const code = typeof error?.code === 'number' ? error.code : undefined;
  const reason = [
    'Genius returned inconsistent song details',
    'Another Genius enrichment run holds the lease.',
    'Enrichment lease lost.',
    'Batch stopped.',
  ].includes(message)
    ? message
    : undefined;
  console.error(JSON.stringify({ kind, code, reason }));
  console.error(
    safe || 'Genius batch stopped. Check admin access, provider availability, and the run lease.',
  );
  process.exitCode = 1;
});
