/** Public web addresses. The hosted pages open the app; there is no store fallback yet. */
export const WEB_ORIGIN = 'https://earlyworld-6831c.web.app';
export const SUPPORT_EMAIL = 'earlyworldofficial@gmail.com';
export type ShareKind = 'post' | 'track' | 'user';
export const shareUrl = (kind: ShareKind, id: string) =>
  `${WEB_ORIGIN}/${kind}/${encodeURIComponent(id)}`;
/** The text handed to the system share sheet. */
export function shareMessage(kind: ShareKind, id: string, title?: string) {
  const url = shareUrl(kind, id);
  return title ? `${title} on earlyworld\n${url}` : url;
}
