function decode(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
export function bandcampMetadata(html: string) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const attribute = (tag: string, key: string) => {
    const match = tag.match(new RegExp(`\\b${key}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
    return match ? decode(match[2]) : '';
  };
  const meta = (key: string) => {
    const tag = tags.find((t) => attribute(t, 'property') === key || attribute(t, 'name') === key);
    return tag ? attribute(tag, 'content') : '';
  };
  let id =
    meta('og:video').match(/track=(\d+)/)?.[1] || meta('twitter:player').match(/track=(\d+)/)?.[1];
  const raw = html.match(/data-tralbum\s*=\s*(["'])(.*?)\1/i)?.[2];
  let artistName = '';
  if (raw) {
    try {
      const data = JSON.parse(decode(raw));
      id = id || String(data.trackinfo?.[0]?.track_id || '');
      artistName = data.artist || '';
    } catch {
      /* A malformed optional payload must not invent an embed. */
    }
  }
  return {
    title: meta('og:title'),
    artworkUrl: meta('og:image'),
    artistName,
    embedUrl:
      id && /^\d+$/.test(id)
        ? `https://bandcamp.com/EmbeddedPlayer/track=${id}/size=large/bgcol=101110/linkcol=c1f17c/artwork=small/transparent=true/`
        : null,
  };
}
