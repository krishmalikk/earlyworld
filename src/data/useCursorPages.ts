import { useCallback, useEffect, useRef, useState } from 'react';
export type CursorPage = { ids: string[]; cursor: string | null };
type State = CursorPage & { key: string; more: boolean; loading: boolean; error: unknown | null };
/** Cursor requests are serialized; late responses cannot cross account/filter boundaries. */
export function useCursorPages(
  key: string,
  enabled: boolean,
  load: (cursor: string | null) => Promise<CursorPage>,
  debounce = 0,
) {
  const empty = (): State => ({
    key,
    ids: [],
    cursor: null,
    more: true,
    loading: enabled,
    error: null,
  });
  const [state, setState] = useState<State>(empty);
  const current = useRef(state),
    currentKey = useRef(key),
    loader = useRef(load);
  currentKey.current = key;
  loader.current = load;
  const generation = useRef(0),
    busy = useRef(false);
  const fetchPage = useCallback(
    async (reset = false, retainPages = false) => {
      if (
        !enabled ||
        (!reset && (busy.current || current.current.key !== key || !current.current.more))
      )
        return;
      const run = generation.current;
      busy.current = true;
      const previous = reset ? empty() : current.current;
      // A failed refresh retains the already-visible cache. A successful refresh replaces its IDs.
      const retained = current.current.key === key ? current.current.ids : [];
      const publish = (next: State) => {
        current.current = next;
        setState(next);
      };
      publish({ ...previous, ids: reset ? retained : previous.ids, loading: true, error: null });
      try {
        const page = await loader.current(previous.cursor);
        if (reset && retainPages) {
          while (
            page.cursor &&
            page.ids.length < retained.length &&
            generation.current === run &&
            currentKey.current === key
          ) {
            const next = await loader.current(page.cursor);
            page.ids.push(...next.ids);
            page.cursor = next.cursor;
          }
        }
        if (generation.current === run && currentKey.current === key)
          publish({
            key,
            ids: [...new Set([...previous.ids, ...page.ids])],
            cursor: page.cursor,
            more: !!page.cursor,
            loading: false,
            error: null,
          });
      } catch (error) {
        if (generation.current === run && currentKey.current === key)
          publish({ ...previous, ids: reset ? retained : previous.ids, loading: false, error });
      } finally {
        if (generation.current === run) busy.current = false;
      }
    },
    [key, enabled],
  );
  useEffect(() => {
    generation.current++;
    busy.current = false;
    current.current = empty();
    setState(current.current);
    if (!enabled) return;
    const timer = setTimeout(() => void fetchPage(true), debounce);
    return () => {
      clearTimeout(timer);
      generation.current++;
    };
  }, [fetchPage, debounce]);
  const visible = state.key === key ? state : empty();
  return {
    ...visible,
    loadMore: () => void fetchPage(),
    revalidate: () => {
      generation.current++;
      busy.current = false;
      void fetchPage(true, true);
    },
    refresh: () => {
      generation.current++;
      busy.current = false;
      void fetchPage(true);
    },
  };
}
