/** Case/accent-insensitive substring search. No lyrics, reviews, audio, or provider popularity. */
export const CATALOG_KINDS = ['tracks', 'artists', 'producers', 'releases'] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];
export function searchText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
export function searchGrams(value: string) {
  const normalized = Array.from(searchText(value));
  const grams = new Set<string>();
  for (let size = 1; size <= 3; size++)
    for (let i = 0; i <= normalized.length - size; i++)
      grams.add(normalized.slice(i, i + size).join(''));
  return [...grams];
}
export function searchNeedle(value: string) {
  const normalized = searchText(value);
  return Array.from(normalized).slice(0, 3).join('');
}
export function catalogIndex(
  kind: CatalogKind,
  data: Record<string, unknown>,
  artistScenes: string[] = [],
) {
  const strings = (value: unknown) =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  const credits = data.credits as { producers?: unknown } | undefined;
  const scenes = [...new Set([...strings(data.scenes), ...artistScenes])];
  const text = searchText(
    [
      data.title,
      data.name,
      data.artistName,
      data.producerName,
      data.releaseType,
      ...strings(data.aliases),
      ...strings(credits?.producers),
      ...scenes,
    ]
      .filter((v): v is string => typeof v === 'string')
      .join(' '),
  );
  return {
    kind,
    text,
    grams: searchGrams(text),
    scenes,
    artistId: typeof data.artistId === 'string' ? data.artistId : null,
    producerNames: [
      ...new Set(
        [
          ...(typeof data.producerName === 'string' ? [data.producerName] : []),
          ...strings(credits?.producers),
        ].map(searchText),
      ),
    ],
    producerId: data.producerId || null,
    available: data.sourceStatus !== 'unavailable',
    version: 1,
  };
}
