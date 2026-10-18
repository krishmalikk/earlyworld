/** Only private Cloud Storage URLs participate; catalog artwork stays untouched. */
export function privateMediaExpiry(uri: string | null | undefined): number | null {
  if (!uri) return null;
  try {
    const url = new URL(uri);
    if (
      url.protocol !== 'https:' ||
      !(
        url.hostname === 'storage.googleapis.com' ||
        url.hostname.endsWith('.storage.googleapis.com')
      )
    )
      return null;
    if (url.searchParams.has('GoogleAccessId') && url.searchParams.has('Signature')) {
      const seconds = Number(url.searchParams.get('Expires'));
      return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
    }
    const date = url.searchParams.get('X-Goog-Date'),
      seconds = Number(url.searchParams.get('X-Goog-Expires'));
    if (
      !url.searchParams.has('X-Goog-Signature') ||
      !date ||
      !/^\d{8}T\d{6}Z$/.test(date) ||
      !seconds
    )
      return null;
    const at = Date.parse(
      `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`,
    );
    return Number.isFinite(at) ? at + seconds * 1000 : null;
  } catch {
    return null;
  }
}
/** One account-owned batch invalidation, never one request per photo/row. */
export class MediaRenewals {
  private urls = new Map<string, { count: number; expires: number }>();
  private nextAllowed = 0;
  register(uri: string) {
    const expires = privateMediaExpiry(uri);
    if (expires === null) return () => {};
    const old = this.urls.get(uri);
    this.urls.set(uri, { count: (old?.count || 0) + 1, expires });
    return () => {
      const entry = this.urls.get(uri);
      if (entry && entry.count > 1) entry.count--;
      else this.urls.delete(uri);
    };
  }
  due(now: number, failedUri?: string) {
    if (now < this.nextAllowed) return false;
    if (
      failedUri
        ? !this.urls.has(failedUri)
        : ![...this.urls.values()].some((v) => v.expires <= now + 30000)
    )
      return false;
    this.nextAllowed = now + 30000;
    return true;
  }
}
