import { useEffect, useState } from 'react';
export type Subscribe<T> = (next: (value: T) => void, fail: (error: unknown) => void) => () => void;
/** Keys prevent briefly exposing the previous account's cached state on an auth change. */
export function useSubscription<T>(
  key: unknown,
  subscribe: Subscribe<T> | null,
  empty: T,
  active = true,
) {
  const [state, set] = useState<{ key: unknown; data: T; loading: boolean; error: unknown | null }>(
    { key, data: empty, loading: !!subscribe, error: null },
  );
  useEffect(() => {
    if (!subscribe || !active) return;
    let live = true;
    const unsubscribe = subscribe(
      (data) => {
        if (live) set({ key, data, loading: false, error: null });
      },
      (error) => {
        if (live)
          set((previous) => ({
            key,
            data: previous.key === key ? previous.data : empty,
            loading: false,
            error,
          }));
      },
    );
    return () => {
      live = false;
      unsubscribe();
    };
  }, [key, subscribe, active]);
  return state.key === key ? state : { key, data: empty, loading: !!subscribe, error: null };
}
