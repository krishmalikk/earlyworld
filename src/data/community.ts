import { useCallback, useEffect, useRef, useState } from 'react';
import { Timestamp } from '@react-native-firebase/firestore';
import { useFocusEffect } from 'expo-router';
import { useLocal } from '../state/local';
import { call, errorMessage } from '../lib/firebase';
import { useSocial } from './social';
import { useForeground } from './listeners';
function hydrate(value: unknown): unknown {
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
    { version } = useSocial(),
    active = useForeground();
  const key = JSON.stringify([uid, options]),
    latest = useRef(key);
  latest.current = key;
  const [state, set] = useState<{
    key: string;
    data: T[];
    error: string | null;
    loading: boolean;
    more: boolean;
  }>({ key, data: [], error: null, loading: true, more: false });
  const [reload, setReload] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setReload((n) => n + 1);
    }, [key]),
  );
  useEffect(() => {
    let live = true;
    if (!uid || !enabled || !active) return;
    set((old) =>
      old.key === key
        ? { ...old, loading: true }
        : { key, data: [], error: null, loading: true, more: false },
    );
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
      if (live)
        set({
          key,
          data: items.slice(0, count),
          error: null,
          loading: false,
          more: !!cursor || items.length > count,
        });
    })().catch((e) => {
      if (live)
        set((old) => ({
          ...old,
          key,
          data: /not-found|permission-denied/.test(String(e?.code)) ? [] : old.data,
          loading: false,
          error: errorMessage(e),
        }));
    });
    return () => {
      live = false;
    };
  }, [key, count, version, reload, enabled, active]);
  return state.key === key ? state : { key, data: [], error: null, loading: true, more: false };
}
