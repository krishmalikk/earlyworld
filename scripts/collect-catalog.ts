/** Read public SoundCloud page metadata only. Never fetch media/transcodings or lyrics. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { normalizeName } from '../shared/domain';
async function main() {
  const sources: [string, string, string[]][] = [
    ['summrs', 'Summrs', ['pluggnb', 'plugg']],
    ['twinuzis', 'Autumn!', ['pluggnb', 'plugg']],
    ['kankan', 'Kankan', ['rage', 'plugg']],
    ['izayuh', 'iayze', ['plugg', 'rage']],
    ['xaviersobased', 'xaviersobased', ['jerk', 'experimental']],
    ['osamason', 'OsamaSon', ['rage', 'dark plugg']],
    ['xx1oneam', '1oneam', ['plugg', 'rage']],
    ['nettspend', 'Nettspend', ['jerk', 'rage']],
    ['che', 'che', ['rage', 'experimental']],
    ['untiljapan', 'untiljapan', ['rage', 'cloud rap']],
    ['hardrock', 'Hardrock', ['rage', 'experimental']],
    ['lilshine', 'Lil Shine', ['pluggnb', 'cloud rap']],
    ['lilcandypaint', 'Lil Candy Paint', ['plugg', 'pluggnb']],
    ['duwapkaine', 'Duwap Kaine', ['plugg', 'cloud rap']],
    ['thouxanbanfauni', 'Thouxanbanfauni', ['plugg', 'cloud rap']],
    ['unotheactivist', 'UnoTheActivist', ['rage', 'plugg']],
    ['fauni', 'Thouxanbanfauni', ['plugg', 'cloud rap']],
    ['lucki', 'LUCKI', ['cloud rap', 'plugg']],
    ['luckiecks', 'LUCKI', ['cloud rap', 'plugg']],
    ['snowmanservin', 'Tony Shhnow', ['plugg', 'sample drill']],
    ['10kdunkin', '10kDunkin', ['plugg', 'cloud rap']],
    ['454', '454', ['cloud rap', 'experimental']],
    ['babyxsosa', 'Babyxsosa', ['cloud rap', 'experimental']],
    ['evil-giane', 'Evilgiane', ['experimental', 'sample drill']],
    ['snowstrippers', 'Snow Strippers', ['hyperpop', 'experimental']],
    ['yabujin', 'Yabujin', ['cloud rap', 'experimental']],
    ['bladee', 'Bladee', ['cloud rap', 'experimental']],
    ['thaiboy-digital', 'Thaiboy Digital', ['cloud rap', 'plugg']],
    ['ecco2k', 'Ecco2k', ['cloud rap', 'experimental']],
    ['blackkray', 'Black Kray', ['cloud rap', 'dark plugg']],
    ['sickboyrari', 'Black Kray', ['cloud rap', 'dark plugg']],
    ['hi-c', 'Hi-C', ['cloud rap', 'dark plugg']],
    ['realrxpapi', 'RX Papi', ['sample drill', 'experimental']],
    ['rxknephew', 'RXKNephew', ['experimental', 'sample drill']],
    ['babytron', 'BabyTron', ['Detroit', 'sample drill']],
    ['baby-smoove', 'Baby Smoove', ['Detroit', 'cloud rap']],
    ['babyface-ray', 'Babyface Ray', ['Detroit', 'cloud rap']],
    ['slimesito', 'Slimesito', ['dark plugg', 'plugg']],
    ['glokk40spaz', 'Glokk40Spaz', ['dark plugg', 'plugg']],
    ['slump6s', 'Slump6s', ['rage', 'hyperpop']],
    ['ericdoa', 'ericdoa', ['hyperpop', 'experimental']],
    ['glaive', 'glaive', ['hyperpop', 'experimental']],
    ['midwxst', 'midwxst', ['hyperpop', 'rage']],
    ['quinn', 'quinn', ['hyperpop', 'experimental']],
    ['brakence', 'brakence', ['hyperpop', 'experimental']],
    ['fakemink', 'fakemink', ['UK underground', 'cloud rap']],
    ['fimiguerrero', 'Fimiguerrero', ['UK underground', 'rage']],
    ['len', 'Len', ['UK underground', 'rage']],
    ['lancey-foux', 'Lancey Foux', ['UK underground', 'rage']],
    ['skaiwater', 'skaiwater', ['UK underground', 'experimental']],
    ['chris-travis', 'Chris Travis', ['Memphis', 'cloud rap']],
    ['xavierwulf', 'Xavier Wulf', ['Memphis', 'cloud rap']],
    ['idontknowjeffery', 'IDKJeffery', ['Memphis', 'experimental']],
    ['yungbruh', 'Yung Bruh', ['cloud rap', 'plugg']],
    ['sircartier', 'Playboi Carti', ['rage', 'plugg']],
    ['rudeclub', 'Duwap Kaine', ['plugg', 'cloud rap']],
    ['dunkin10k', '10kDunkin', ['plugg', 'cloud rap']],
    ['kankan1', 'Kankan', ['rage', 'plugg']],
    ['kankanrr', 'Kankan', ['rage', 'plugg']],
    ['fucklucki', 'LUCKI', ['cloud rap', 'plugg']],
    ['faunifigueroa', 'Thouxanbanfauni', ['plugg', 'cloud rap']],
    ['unotheactivist', 'UnoTheActivist', ['rage', 'plugg']],
    ['izayatiji', 'Izaya Tiji', ['plugg', 'experimental']],
    ['izayuhh', 'Izaya Tiji', ['plugg', 'experimental']],
    ['boofpaxkmooky', 'BoofPaxkMooky', ['plugg', 'cloud rap']],
    ['cashbently', 'Cash Bently', ['pluggnb', 'plugg']],
    ['coreylingo', 'Corey Lingo', ['pluggnb', 'plugg']],
    ['yvngxchris', 'yvngxchris', ['rage', 'hyperpop']],
    ['ssgkobe', 'SSGKobe', ['rage', 'plugg']],
    ['kashdami', 'KA$HDAMI', ['plugg', 'rage']],
    ['sofaygo', 'SoFaygo', ['rage', 'plugg']],
    ['sosstalk', 'SoFaygo', ['rage', 'plugg']],
    ['warholss', 'Warhol.SS', ['plugg', 'cloud rap']],
    ['boofboiicy', 'Boofboiicy', ['plugg', 'cloud rap']],
    ['wifigawd', 'WiFiGawd', ['cloud rap', 'experimental']],
    ['blacksmurf', 'Black Smurf', ['Memphis', 'cloud rap']],
    ['chxpo', 'CHXPO', ['dark plugg', 'cloud rap']],
    ['bby-goyard', 'BBY GOYARD', ['experimental', 'cloud rap']],
    ['pollari', 'Pollari', ['plugg', 'cloud rap']],
    ['yungbans', 'Yung Bans', ['plugg', 'cloud rap']],
    ['younglunchbox', 'Lunchbox', ['rage', 'plugg']],
    ['pierrebourne', 'Pi’erre Bourne', ['plugg', 'rage']],
    ['454fl', '454', ['cloud rap', 'experimental']],
    ['nolanberollin', 'Nolanberollin', ['plugg', 'experimental']],
    ['dsavage3900', 'D Savage', ['plugg', 'cloud rap']],
    ['leandoer96', 'Yung Lean', ['cloud rap', 'experimental']],
    ['yung-lean-doer', 'Yung Lean', ['cloud rap', 'experimental']],
    ['acid-souljah', 'Acid Souljah', ['experimental', 'dark plugg']],
    ['christ-dillinger', 'Christ Dillinger', ['experimental', 'cloud rap']],
    ['joeyy', 'Joeyy', ['cloud rap', 'experimental']],
    ['marlondubois', 'Marlon DuBois', ['cloud rap', 'experimental']],
    ['meat-computer', 'Meat Computer', ['hyperpop', 'experimental']],
    ['wifisfuneral', 'Wifisfuneral', ['cloud rap', 'Memphis']],
    ['teamsesh', 'BONES', ['cloud rap', 'dark plugg']],
    ['liltracy', 'Lil Tracy', ['cloud rap', 'plugg']],
    ['yungweej', 'Weiland', ['pluggnb', 'plugg']],
  ];
  const hash = (s: string) => createHash('sha256').update(s).digest('hex');
  const entityId = (type: string, name: string) =>
    `${type}_${hash(normalizeName(name)).slice(0, 24)}`;
  const cache = '/private/tmp/earlyworld-catalog-cache';
  await mkdir(cache, { recursive: true });
  await mkdir('seed', { recursive: true });
  async function page(url: string) {
    const path = `${cache}/${hash(url)}.html`;
    try {
      return await readFile(path, 'utf8');
    } catch {}
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    await writeFile(path, text);
    return text;
  }
  function hydrate(html: string, type: string) {
    const match = html.match(/window\.__sc_hydration\s*=\s*(\[.*?\]);/);
    return match ? JSON.parse(match[1]).find((item: any) => item.hydratable === type)?.data : null;
  }
  const artists: any[] = [],
    tracks: any[] = [],
    producers = new Map<string, any>(),
    failures: string[] = [];
  for (const [handle, name, scenes] of sources) {
    if (artists.length >= 40) break;
    if (artists.some((a) => a.name === name)) continue;
    try {
      const html = await page(`https://soundcloud.com/${handle}`),
        user = hydrate(html, 'user');
      if (!user) throw new Error('No public artist metadata');
      if (!['bladee', 'yabujin'].includes(handle) && similarHandle(user.username, name) < 0.3)
        throw new Error(`Account name mismatch: ${user.username}`);
      const trackHtml = await page(`https://soundcloud.com/${handle}/tracks`);
      const links = [
        ...(html + trackHtml).matchAll(/itemprop="url" href="(\/[^"/]+\/[^"/]+)"/g),
      ].map((m) => m[1]);
      const selected: any[] = [];
      for (const link of [...new Set(links)]) {
        if (selected.length >= 5) break;
        try {
          const t = hydrate(await page(`https://soundcloud.com${link}`), 'sound');
          if (
            !t ||
            t.user.id !== user.id ||
            t.sharing !== 'public' ||
            /\b(leak(?:ed)?|unreleased|snippet|preview)\b/i.test(t.title)
          )
            continue;
          const title = t.title;
          // Only explicit production labels; never infer a producer from musical style.
          const credit = title
            .match(/\bprod(?:uced)?\.?\s*(?:by\s+)?[([]?([^\])]+)[\])]?/i)?.[1]
            ?.trim();
          const producerNames = credit
            ? credit
                .split(/\s+(?:x|&|\+|and)\s+|,\s*/i)
                .map((x: string) => (/^(me|myself)$/i.test(x.trim()) ? name : x.trim()))
                .filter((x: string) => x && x.length <= 40)
            : [];
          const producerName = producerNames[0] || null,
            producerId = producerName ? entityId('producer', producerName) : null;
          if (producerId && !producers.has(producerId))
            producers.set(producerId, {
              id: producerId,
              name: producerName,
              imageUrl: '',
              aliases: [],
              tagAudioUrl: null,
              trackCount: 0,
              sourceUrl: t.permalink_url,
            });
          if (producerId) producers.get(producerId).trackCount++;
          selected.push({
            id: hash(t.permalink_url),
            title,
            artistId: entityId('artist', name),
            artistName: name,
            producerId,
            producerName,
            sourceUrl: t.permalink_url,
            sourcePlatform: 'soundcloud',
            artworkUrl: t.artwork_url || user.avatar_url || '',
            durationSeconds: Math.round(t.duration / 1000),
            publishedAt: t.created_at,
            creditSource: credit ? t.permalink_url : null,
            sourceProducerCredits: producerNames,
            verifiedAt: new Date().toISOString(),
          });
        } catch (error) {
          failures.push(`${link}: ${error}`);
        }
      }
      if (selected.length < 5) throw new Error(`Only ${selected.length} eligible tracks`);
      artists.push({
        id: entityId('artist', name),
        name,
        imageUrl: user.avatar_url,
        aliases: [user.username].filter((x) => x !== name),
        scenes,
        trackCount: selected.length,
        discoveryRank: user.followers_count || 0,
        sourceUrl: `https://soundcloud.com/${handle}`,
      });
      tracks.push(...selected);
      console.log(`${artists.length}/40 ${name}: ${selected.length} tracks`);
    } catch (error) {
      failures.push(`${handle}: ${error}`);
      console.log(`skip ${handle}: ${error}`);
    }
  }
  function similarHandle(a: string, b: string) {
    const x = new Set(normalizeName(a).replace(/\s/g, '')),
      y = new Set(normalizeName(b).replace(/\s/g, ''));
    return [...x].filter((c) => y.has(c)).length / Math.max(x.size, y.size);
  }
  // Keep only producers attached to accepted tracks.
  const acceptedProducers = [...producers.values()]
    .filter((p) => tracks.some((t) => t.producerId === p.id))
    .map((p) => ({ ...p, trackCount: tracks.filter((t) => t.producerId === p.id).length }));
  await writeFile(
    'seed/catalog.json',
    JSON.stringify(
      { collectedAt: new Date().toISOString(), artists, producers: acceptedProducers, tracks },
      null,
      2,
    ) + '\n',
  );
  await writeFile(
    'seed/collection-report.json',
    JSON.stringify(
      {
        artists: artists.length,
        tracks: tracks.length,
        producers: acceptedProducers.length,
        failures,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Saved ${artists.length} artists, ${tracks.length} tracks, ${acceptedProducers.length} explicitly credited producers.`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
