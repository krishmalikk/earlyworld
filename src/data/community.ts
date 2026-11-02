import { useCallback, useEffect, useRef, useState } from 'react';
import { Timestamp } from '@react-native-firebase/firestore';
import { useFocusEffect } from 'expo-router';
import { useLocal } from '../state/local';
import { call, errorMessage } from '../lib/firebase';
import { useSocial } from './social';
import { useForeground } from './listeners';
export function hydrate(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(hydrate);
  if (value && typeof value === 'object') {
    if ('millis' in value && typeof value.millis === 'number')
      return Timestamp.fromMillis(value.millis);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, hydrate(v)]));
  }
  return value;
}
export function useCommunity<T extends { id: string }>(
  options: Record<string, unknown>,
  count = 25,
  enabled = true,
) {
  const uid = useLocal((s) => s.uid),
    { version, communityCache } = useSocial(),
    active = useForeground();
  const key = JSON.stringify([uid, options]),
    latest = useRef(key);
  latest.current = key;
  // The last result shows at once on return; the normal request below then refreshes it.
  const cacheKey = `${count}:${key}`;
  const opening = () => {
    const cached = communityCache.get(cacheKey);
    return {
      key,
      data: (cached?.data || []) as T[],
      error: null,
      loading: true,
      more: cached?.more || false,
    };
  };
  const [state, set] = useState<{
    key: string;
    data: T[];
    error: string | null;
    loading: boolean;
    more: boolean;
  }>(opening);
  const [reload, setReload] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setReload((n) => n + 1);
    }, [key]),
  );
  useEffect(() => {
    let live = true;
    if (!uid || !enabled || !active) return;
    set((old) => (old.key === key ? { ...old, loading: true } : opening()));
    (async () => {
      const items: T[] = [];
      let cursor: string | null = null;
      do {
        const page: { items: unknown[]; cursor: string | null } = await call<{
          items: unknown[];
          cursor: string | null;
        }>('readCommunity', { ...options, cursor });
        if (!live || latest.current !== key) return;
        items.push(...page.items.map((p) => hydrate(p) as T));
        cursor = page.cursor;
      } while (cursor && items.length < count);
      const data = items.slice(0, count),
        more = !!cursor || items.length > count;
      communityCache.set(cacheKey, { data, more });
      if (live) set({ key, data, error: null, loading: false, more });
    })().catch((e) => {
      const denied = /not-found|permission-denied/.test(String(e?.code));
      if (denied) communityCache.delete(cacheKey);
      if (live)
        set((old) => ({
          ...old,
          key,
          data: denied ? [] : old.data,
          loading: false,
          error: errorMessage(e),
        }));
    });
    return () => {
      live = false;
    };
  }, [key, count, version, reload, enabled, active]);
  return state.key === key ? state : opening();
}
