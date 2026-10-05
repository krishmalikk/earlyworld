import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  collection,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
} from '@react-native-firebase/firestore';
import { call, db, errorMessage } from '../lib/firebase';
import { useLocal } from '../state/local';
import { useCursorPages } from './useCursorPages';
import type { CatalogKind } from '../../shared/catalog-search';
import type { Entity, Track, Release } from './types';

type Items = { tracks: Track; artists: Entity; producers: Entity; releases: Release };
type Cache = { [K in CatalogKind]: ReadonlyMap<string, Items[K]> };
type Request = { kind: CatalogKind; ids: string[] };
const emptyCache = (): Cache => ({
  tracks: new Map(),
  artists: new Map(),
  producers: new Map(),
  releases: new Map(),
});
const Context = createContext<{
  cache: Cache;
  loaded: ReadonlySet<string>;
  request: (key: symbol, value: Request | null) => void;
  loading: boolean;
  error: string | null;
}>({ cache: emptyCache(), loaded: new Set(), request: () => {}, loading: false, error: null });

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const uid = useLocal((state) => state.uid);
  return (
    <CatalogCache key={uid || 'signed-out'} uid={uid}>
      {children}
    </CatalogCache>
  );
}
function CatalogCache({ uid, children }: { uid: string | null; children: React.ReactNode }) {
  const [requests, setRequests] = useState(new Map<symbol, Request>());
  const [cache, setCache] = useState<Cache>(emptyCache);
  const [loaded, setLoaded] = useState(new Set<string>());
  const [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(false);
  const request = useCallback((key: symbol, value: Request | null) => {
    setRequests((previous) => {
      const next = new Map(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }, []);
  const signature = JSON.stringify(
    (['tracks', 'artists', 'producers', 'releases'] as const).map((kind) => [
      kind,
      [
        ...new Set([...requests.values()].filter((r) => r.kind === kind).flatMap((r) => r.ids)),
      ].sort(),
    ]),
  );
  useEffect(() => {
    if (!uid) return;
    let live = true;
    const groups = JSON.parse(signature) as [CatalogKind, string[]][];
    const unsubscribes: (() => void)[] = [];
    let pending = groups.reduce((sum, [, ids]) => sum + Math.ceil(ids.length / 30), 0);
    setError(null);
    setLoading(pending > 0);
    const activeIds = new Set(groups.flatMap(([kind, ids]) => ids.map((id) => `${kind}:${id}`)));
    setLoaded((previous) => new Set([...previous].filter((id) => activeIds.has(id))));
    // Only active references are retained in JS. Native Firestore provides the offline document cache.
    setCache(
      (previous) =>
        Object.fromEntries(
          groups.map(([kind, ids]) => [
            kind,
            new Map(
              ids.filter((id) => previous[kind].has(id)).map((id) => [id, previous[kind].get(id)]),
            ),
          ]),
        ) as unknown as Cache,
    );
    for (const [kind, ids] of groups)
      for (let i = 0; i < ids.length; i += 30) {
        const batch = ids.slice(i, i + 30);
        let received = false;
        const settled = () => {
          if (!received) {
            received = true;
            setLoaded((previous) => new Set([...previous, ...batch.map((id) => `${kind}:${id}`)]));
            pending--;
            setLoading(pending > 0);
          }
        };
        unsubscribes.push(
          onSnapshot(
            query(collection(db, kind), where(documentId(), 'in', batch)),
            (snapshot) => {
              if (!live) return;
              setCache((previous) => {
                const map = new Map<string, Items[CatalogKind]>(previous[kind]);
                batch.forEach((id) => map.delete(id));
                snapshot.docs.forEach((doc) =>
                  map.set(doc.id, { ...doc.data(), id: doc.id } as Items[CatalogKind]),
                );
                return { ...previous, [kind]: map } as Cache;
              });
              settled();
            },
            (e) => {
              if (live) {
                setError(errorMessage(e));
                settled();
              }
            },
          ),
        );
      }
    return () => {
      live = false;
      unsubscribes.forEach((stop) => stop());
    };
  }, [uid, signature]);
  return (
    <Context.Provider value={{ cache, loaded, request, loading, error }}>
      {children}
    </Context.Provider>
  );
}
/** Rows share batched listeners; repeated references never create a listener per row. */
export function useCatalogIds<K extends CatalogKind>(kind: K, ids: (string | null | undefined)[]) {
  const context = useContext(Context);
  const key = useRef(Symbol('catalog references'));
  const signature = JSON.stringify([...new Set(ids.filter((id): id is string => !!id))].sort());
  useEffect(() => {
    context.request(key.current, { kind, ids: JSON.parse(signature) });
    return () => context.request(key.current, null);
  }, [kind, signature, context.request]);
  return {
    byId: context.cache[kind],
    loading: context.loading || ids.some((id) => !!id && !context.loaded.has(`${kind}:${id}`)),
    error: context.error,
  };
}
export type CatalogOptions = {
  text?: string;
  scenes?: string[];
  artistId?: string;
  artistIds?: string[];
  producerName?: string;
  enabled?: boolean;
  sort?: 'popular';
  geniusIds?: number[];
};
export function useCatalogPage<K extends CatalogKind>(kind: K, options: CatalogOptions = {}) {
  const uid = useLocal((state) => state.uid);
  const key = JSON.stringify([uid, kind, options]);
  const state = useCursorPages(
    key,
    !!uid && options.enabled !== false,
    async (after) => {
      if (options.text?.trim() || options.scenes?.length || options.producerName) {
        const result = await call<{ ids: string[]; nextCursor: string | null }>('searchCatalog', {
          kind,
          text: options.text || '',
          scenes: options.scenes || [],
          producerName: options.producerName || '',
          after,
        });
        return { ids: result.ids, cursor: result.nextCursor };
      }
      const ids = options.geniusIds?.length ? options.geniusIds : options.artistIds;
      const batches = ids?.length
        ? Array.from({ length: Math.ceil(ids.length / 30) }, (_, i) =>
            ids.slice(i * 30, i * 30 + 30),
          )
        : [null];
      const pages = await Promise.all(
        batches.map(async (batch) => {
          const constraints = [];
          if (options.artistId) constraints.push(where('artistId', '==', options.artistId));
          if (batch)
            constraints.push(where(options.geniusIds ? 'geniusId' : 'artistId', 'in', batch));
          if (options.sort === 'popular') constraints.push(orderBy('trackCount', 'desc'));
          constraints.push(orderBy(documentId(), options.sort === 'popular' ? 'desc' : 'asc'));
          if (after) constraints.push(startAfter(...(JSON.parse(after) as (string | number)[])));
          return getDocs(query(collection(db, kind), ...constraints, limit(25)));
        }),
      );
      const ordered = pages
        .flatMap((page) => page.docs)
        .sort(
          (a, b) =>
            (options.sort === 'popular' ? b.data().trackCount - a.data().trackCount : 0) ||
            (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) * (options.sort === 'popular' ? -1 : 1),
        );
      const docs = [...new Map(ordered.map((doc) => [doc.id, doc])).values()].slice(0, 25);
      const last = docs.at(-1);
      const more = ordered.length > 25 || pages.some((page) => page.size === 25);
      return {
        ids: docs.map((doc) => doc.id),
        cursor:
          more && last
            ? JSON.stringify(
                options.sort === 'popular' ? [last.data().trackCount, last.id] : [last.id],
              )
            : null,
      };
    },
    options.text ? 300 : 0,
  );
  const cached = useCatalogIds(kind, state.ids);
  const data = useMemo(
    () =>
      state.ids.flatMap((id) => {
        const item = cached.byId.get(id);
        return item ? [item] : [];
      }),
    [state.ids, cached.byId],
  );
  return {
    data,
    loading: state.loading || cached.loading,
    error: state.error ? errorMessage(state.error) : cached.error,
    hasMore: state.more,
    loadMore: state.loadMore,
    refresh: state.refresh,
  };
}
