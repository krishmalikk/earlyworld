import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { call, errorMessage } from '../lib/firebase';
import { useLocal } from '../state/local';
import { hydrate } from './community';
import { useSocial } from './social';
import { useForeground } from './listeners';
import { useCursorPages } from './useCursorPages';
import type { SocialPost } from '../../shared/social';
import type { Rating, ReleaseRating } from './types';

export type ForYouItem =
  | { type: 'rating'; at: number; reason: string; data: Rating }
  | { type: 'releaseRating'; at: number; reason: string; data: ReleaseRating }
  | { type: 'post'; at: number; reason: string; data: SocialPost };
const itemKey = (item: ForYouItem) =>
  `${item.type === 'post' ? 'post' : item.type === 'rating' ? 'rating' : 'releaseRating'}:${item.data.id}`;

/** Reviews and posts from across the community chosen for this listener, with reasons. */
export function useForYou(enabled = true) {
  const uid = useLocal((s) => s.uid),
    { version } = useSocial(),
    active = useForeground();
  const key = `${uid}:forYou`;
  const [cache, setCache] = useState<{ key: string; items: Map<string, ForYouItem> }>({
    key,
    items: new Map(),
  });
  const latest = useRef(key);
  latest.current = key;
  const load = useCallback(
    async (cursor: string | null) => {
      const page = await call<{ items: ForYouItem[]; cursor: number | null }>('readForYou', {
        cursor: cursor == null ? null : Number(cursor),
      });
      const items = page.items.map((item) => hydrate(item) as ForYouItem);
      if (latest.current === key)
        setCache((old) => ({
          key,
          items: new Map([
            ...(old.key === key ? old.items : []),
            ...items.map((item) => [itemKey(item), item] as const),
          ]),
        }));
      return {
        ids: items.map(itemKey),
        cursor: page.cursor == null ? null : String(page.cursor),
      };
    },
    [key],
  );
  const page = useCursorPages(key, !!uid && enabled && active, load);
  useEffect(() => {
    if (enabled) page.revalidate();
  }, [version, key, enabled]);
  useFocusEffect(
    useCallback(() => {
      if (enabled) page.refresh();
    }, [key, enabled]),
  );
  const data =
    cache.key === key
      ? page.ids.flatMap((id) => (cache.items.has(id) ? [cache.items.get(id)!] : []))
      : [];
  // Until readForYou is deployed, the feed falls back to follows-only content quietly.
  const missing = /not-found|unimplemented/.test(String((page.error as { code?: string })?.code));
  return { ...page, data, error: page.error && !missing ? errorMessage(page.error) : null };
}
