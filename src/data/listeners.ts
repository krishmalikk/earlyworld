import { useCallback, useEffect, useState, useMemo } from 'react';
import { AppState } from 'react-native';
import { onSnapshot, type Query, type DocumentReference } from '@react-native-firebase/firestore';
import { errorMessage } from '../lib/firebase';
import { useSubscription } from './useSubscription';
export function useForeground() {
  const [active, set] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => set(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}
export function useCollection<T>(reference: Query | null, foregroundOnly = false) {
  const active = useForeground();
  const subscribe = useCallback(
    (next: (value: T[]) => void, fail: (error: unknown) => void) =>
      reference
        ? onSnapshot(
            reference,
            (snapshot) => next(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T)),
            fail,
          )
        : () => {},
    [reference],
  );
  const state = useSubscription<T[]>(
    reference,
    reference ? subscribe : null,
    [],
    !foregroundOnly || active,
  );
  const error = useMemo(() => (state.error ? errorMessage(state.error) : null), [state.error]);
  return { data: state.data, loading: state.loading, error };
}
export function useDocument<T>(reference: DocumentReference | null) {
  const subscribe = useCallback(
    (next: (value: T | null) => void, fail: (error: unknown) => void) =>
      reference
        ? onSnapshot(
            reference,
            (snapshot) =>
              next(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null),
            fail,
          )
        : () => {},
    [reference],
  );
  const state = useSubscription<T | null>(reference, reference ? subscribe : null, null);
  const error = useMemo(() => (state.error ? errorMessage(state.error) : null), [state.error]);
  return { data: state.data, loading: state.loading, error };
}
