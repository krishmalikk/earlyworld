/** Select bounded SoundCloud CDN sizes without changing other providers or signed URLs. */
export function artworkSources(uri: string | null | undefined, pixels: number): string[] {
  if (!uri) return [];
  try {
    const url = new URL(uri);
    if (
      url.protocol !== 'https:' ||
      !/^i[1-4]\.sndcdn\.com$/.test(url.hostname) ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/(artworks|avatars)-.+-(small|badge|large|t\d+x\d+)\.(jpg|jpeg|png|webp)$/.test(
        url.pathname,
      )
    )
      return [uri];
    const variant = (size: string) => {
      const next = new URL(uri);
      next.pathname = next.pathname.replace(
        /-(small|badge|large|t\d+x\d+)(\.[^.]+)$/,
        `-${size}$2`,
      );
      return next.href;
    };
    return [
      ...new Set([...(pixels > 500 ? [variant('t1080x1080')] : []), variant('t500x500'), uri]),
    ];
  } catch {
    return [uri];
  }
}
