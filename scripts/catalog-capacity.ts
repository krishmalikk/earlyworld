import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const option = (name: string, fallback: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
async function main() {
  const target = Number(option('target', '50000')),
    cap = Number(option('per-artist', '250'));
  if (!Number.isInteger(target) || target < 1 || !Number.isInteger(cap) || cap < 1 || cap > 1000)
    throw new Error('Invalid target or cap.');
  const roster = JSON.parse(
    await readFile(option('roster', 'seed/soundcloud-artists.json'), 'utf8'),
  ) as { artists: { urn: string; name: string; profileUrl: string; scenes: string[] }[] };
  const urns = new Set<string>();
  for (const artist of roster.artists) {
    if (
      !/^soundcloud:users:\d+$/.test(artist.urn) ||
      urns.has(artist.urn) ||
      !artist.name?.trim() ||
      !Array.isArray(artist.scenes)
    )
      throw new Error('Invalid or duplicate reviewed artist.');
    const url = new URL(artist.profileUrl);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'soundcloud.com' ||
      !/^\/[^/]+$/.test(url.pathname) ||
      url.search ||
      url.hash
    )
      throw new Error('Use the reviewed original artist profile.');
    urns.add(artist.urn);
  }
  const directory = option('checkpoint', '.soundcloud-import');
  const files = new Set(await readdir(directory).catch(() => []));
  let sampledArtists = 0,
    eligible = 0,
    freshArtists = 0;
  for (const urn of urns) {
    const name = `${createHash('sha256').update(urn).digest('hex')}.json`;
    if (!files.has(name)) continue;
    const saved = JSON.parse(await readFile(`${directory}/${name}`, 'utf8'));
    if (saved.urn !== urn || !Array.isArray(saved.tracks)) continue;
    sampledArtists++;
    eligible += Math.min(cap, saved.tracks.length);
    if (Date.now() - saved.checkedAt <= 86400000) freshArtists++;
  }
  const average = sampledArtists ? eligible / sampledArtists : null;
  console.log(
    JSON.stringify(
      {
        target,
        reviewedArtists: urns.size,
        perArtistCap: cap,
        theoreticalRosterCeiling: urns.size * cap,
        sampledArtists,
        freshArtists,
        historicalEligibleUploads: eligible,
        historicalAveragePerArtist: average === null ? null : Math.round(average),
        estimatedTotalArtistsAtHistoricalYield: average ? Math.ceil(target / average) : null,
        note: 'Historical checkpoints estimate capacity only; they do not authorize import or establish current availability.',
      },
      null,
      2,
    ),
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Capacity audit failed.');
  process.exitCode = 1;
});
