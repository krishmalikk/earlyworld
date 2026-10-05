/** Rating identity includes its author; multiple opinions about one track remain distinct. */
export function mergeFeedEntries<T extends { key: string; at: number }>(
  streams: T[][],
  count: number,
  include?: (entry: T) => boolean,
): T[] {
  const unique = new Map<string, T>();
  streams
    .flat()
    .filter((entry) => !include || include(entry))
    .sort((a, b) => b.at - a.at || a.key.localeCompare(b.key))
    .forEach((row) => {
      if (!unique.has(row.key)) unique.set(row.key, row);
    });
  return [...unique.values()].slice(0, count);
}
