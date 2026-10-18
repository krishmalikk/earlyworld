import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useLocal } from '../state/local';
import { call, errorMessage } from '../lib/firebase';
import { hydrate } from './community';
import { useSocial } from './social';
import { useForeground } from './listeners';
import { useCursorPages } from './useCursorPages';
import type { Save } from './types';

/** Server-authorized library pages, invalidated with the rest of community content. */
export function useSavedLibrary(author: string, search: string) {
  const uid = useLocal((s) => s.uid),
    { version } = useSocial(),
    active = useForeground();
  const key = JSON.stringify([uid, author, search.trim()]);
  const latest = useRef(key);
  latest.current = key;
  const [cache, setCache] = useState<{ key: string; items: Map<string, Save> }>({
    key,
    items: new Map(),
  });
  const loader = async (after: string | null) => {
    let cursor = after;
    try {
      // A bounded server scan may contain no matches. Continue until a result or
      // the end, so search never mistakes an empty intermediate page for no results.
      do {
        const result = await call<{ items: unknown[]; cursor: string | null }>('readCommunity', {
          kind: 'saves',
          uid: author,
          search: search.trim(),
          cursor,
        });
        const items = result.items.map((item) => hydrate(item) as Save);
        if (latest.current !== key) return { ids: [], cursor: null };
        cursor = result.cursor;
        if (items.length || !cursor) {
          setCache((old) => ({
            key,
            items: new Map([
              ...(old.key === key && after ? old.items : []),
              ...items.map((item) => [item.id, item] as const),
            ]),
          }));
          return { ids: items.map((item) => item.id), cursor };
        }
      } while (cursor);
    } catch (e) {
      if (
        latest.current === key &&
        /not-found|permission-denied/.test(String((e as { code?: string }).code))
      )
        setCache({ key, items: new Map() });
      throw e;
    }
    return { ids: [], cursor: null };
  };
  const page = useCursorPages(key, !!uid && active, loader, search ? 300 : 0);
  useEffect(() => {
    page.revalidate();
  }, [version]);
  useFocusEffect(
    useCallback(() => {
      page.refresh();
    }, [uid, author]),
  );
  return {
    ...page,
    data:
      cache.key === key
        ? page.ids.flatMap((id) => (cache.items.has(id) ? [cache.items.get(id)!] : []))
        : [],
    error: page.error ? errorMessage(page.error) : null,
  };
}
