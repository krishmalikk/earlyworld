export const RECENT_SEARCH_LIMIT = 5;
/** Newest first, case-insensitive, no duplicates, trimmed to the limit. */
export function rememberSearch(recent: string[], value: string, limit = RECENT_SEARCH_LIMIT) {
  const term = value.trim();
  if (term.length < 2) return recent;
  const lower = term.toLowerCase();
  return [term, ...recent.filter((item) => item.toLowerCase() !== lower)].slice(0, limit);
}
export function forgetSearch(recent: string[], value: string) {
  return recent.filter((item) => item !== value);
}
