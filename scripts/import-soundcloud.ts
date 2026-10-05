import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { requireProviderPermission } from './provider-permission';
import { metadataUrl, publicArtist, publicMetadata } from './soundcloud-client';

async function main() {
  if (!process.env.GCLOUD_PROJECT) throw new Error('Set GCLOUD_PROJECT.');
  if (!process.env.FIRESTORE_EMULATOR_HOST && !process.argv.includes('--production'))
    throw new Error('Pass --production for a live project.');
  const option = (key: string, fallback: string) =>
    process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback;
  const target = Number(option('target', '10000')),
    cap = Number(option('per-artist', '250'));
  if (
    !Number.isInteger(target) ||
    target < 1 ||
    target > 100000 ||
    !Number.isInteger(cap) ||
    cap < 1 ||
    cap > 1000
  )
    throw new Error('Invalid target or artist cap.');
  const apply = process.argv.includes('--apply'),
    directory = option('checkpoint', '.soundcloud-import');
  const roster = JSON.parse(
    await readFile(option('roster', 'seed/soundcloud-artists.json'), 'utf8'),
  );
  await requireProviderPermission('soundcloud');
  const env = parseEnv(await readFile('.env', 'utf8'));
  for (const key of ['SOUNDCLOUD_CLIENT_ID', 'SOUNDCLOUD_CLIENT_SECRET'])
    if (!process.env[key]) process.env[key] = env[key];
  const { soundCloudToken } = await import('../functions/src/soundcloud');
  const { db, FieldValue } = await import('../functions/src/core');
  const { eligibleUpload, importArtistPage } = await import('./soundcloud-importer');
  const id = randomUUID(),
    lock = db.doc('_integrations/soundcloudCatalogImport');
  let claimed = false;
  const renewLease = () =>
    db.runTransaction(async (tx) => {
      const state = (await tx.get(lock)).data();
      if (state?.owner !== id || state.leaseUntil <= Date.now())
        throw new Error('Import lease expired. Rerun the checkpoint.');
      tx.update(lock, { leaseUntil: Date.now() + 300000 });
    });
  await mkdir(directory, { recursive: true });
  const write = async (path: string, value: unknown) => {
    await writeFile(path + '.tmp', JSON.stringify(value));
    await rename(path + '.tmp', path);
  };
  try {
    if (apply) {
      await db.runTransaction(async (tx) => {
        const state = (await tx.get(lock)).data();
        if (state?.leaseUntil > Date.now()) throw new Error('Another catalog import is active.');
        tx.set(lock, { owner: id, leaseUntil: Date.now() + 300000 });
      });
      claimed = true;
    }
    const staged: { artist: any; tracks: any[] }[] = [];
    for (const candidate of roster.artists) {
      if (claimed) await renewLease();
      const file = `${directory}/${createHash('sha256').update(candidate.urn).digest('hex')}.json`;
      let state: any;
      try {
        state = JSON.parse(await readFile(file, 'utf8'));
      } catch (e) {
        if ((e as any).code !== 'ENOENT') throw e;
      }
      if (
        state &&
        (state.urn !== candidate.urn ||
          state.cap !== cap ||
          Date.now() - state.checkedAt > 86400000)
      )
        state = null;
      if (!state)
        state = {
          urn: candidate.urn,
          cap,
          checkedAt: Date.now(),
          tracks: [],
          next: null,
          started: false,
          done: false,
        };
      const profile = publicArtist(
        await publicMetadata(`/users/${encodeURIComponent(candidate.urn)}`, soundCloudToken),
      );
      if (profile.urn !== candidate.urn) throw new Error('Artist identity changed.');
      const path = `/users/${encodeURIComponent(candidate.urn)}/tracks`;
      const visited = new Set<string>();
      while (!state.done && state.tracks.length < cap) {
        const url = state.started ? state.next : `${path}?limit=200&linked_partitioning=true`;
        if (!url || visited.has(url)) throw new Error('Invalid SoundCloud pagination.');
        visited.add(url);
        const page = await publicMetadata(metadataUrl(url, path).href, soundCloudToken);
        if (!Array.isArray(page.collection)) throw new Error('Invalid SoundCloud track page.');
        const unique = new Map(state.tracks.map((t: any) => [t.urn, t]));
        for (const raw of page.collection) {
          const t = eligibleUpload(raw, candidate.urn);
          if (t) unique.set(t.urn, t);
        }
        state.tracks = [...unique.values()].slice(0, cap);
        state.next = page.next_href ? metadataUrl(page.next_href, path).href : null;
        state.started = true;
        state.done = !state.next || state.tracks.length >= cap;
        await write(file, state);
      }
      staged.push({
        artist: { ...candidate, profileUrl: profile.profileUrl, avatarUrl: profile.avatarUrl },
        tracks: state.tracks,
      });
      console.log(
        JSON.stringify({
          stage: 'collected',
          artist: candidate.name,
          eligible: state.tracks.length,
        }),
      );
    }
    const before = (await db.collection('tracks').count().get()).data().count;
    const available = new Set(staged.flatMap((s) => s.tracks.map((t) => t.urn))).size;
    const summary = {
      project: process.env.GCLOUD_PROJECT,
      target,
      before,
      reviewedArtists: staged.length,
      eligibleUploads: available,
      added: 0,
      total: before,
    };
    if (apply) {
      // Spread the first 100 tracks across the whole roster before deepening any one discography.
      for (let offset = 0; offset < cap && summary.total < target; offset += 100) {
        for (const stage of staged) {
          if (summary.total >= target) break;
          await renewLease();
          const result = await importArtistPage(
            stage.artist,
            stage.tracks.slice(offset, offset + 100),
            target - summary.total,
          );
          summary.added += result.added;
          summary.total += result.added;
          console.log(
            JSON.stringify({
              stage: 'imported',
              artist: stage.artist.name,
              ...result,
              total: summary.total,
            }),
          );
        }
      }
    }
    await write(`${directory}/report.json`, {
      ...summary,
      apply,
      completedAt: new Date().toISOString(),
    });
    console.log(JSON.stringify(summary));
  } finally {
    if (claimed)
      await db.runTransaction(async (tx) => {
        if ((await tx.get(lock)).data()?.owner === id)
          tx.set(lock, { completedAt: FieldValue.serverTimestamp(), leaseUntil: 0 });
      });
    await db.terminate();
  }
}
main().catch((error) => {
  if (error instanceof Error && error.message.startsWith('Record ')) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  console.error(
    `Catalog import stopped${typeof error?.status === 'number' ? ` (SoundCloud HTTP ${error.status})` : ''}. Check the reviewed roster, credentials, API availability, and checkpoint. Completed imports are safe to resume.`,
  );
  process.exitCode = 1;
});
