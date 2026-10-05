import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { collection, onSnapshot } from '@react-native-firebase/firestore';
import { db, errorMessage } from '../lib/firebase';
import { useLocal } from '../state/local';
import { useSubscription } from './useSubscription';
type SavedTracks = { ids: Set<string>; confirmedCount: number };
const empty: SavedTracks = { ids: new Set(), confirmedCount: 0 };
const Context = createContext<SavedTracks & { loading: boolean; error: string | null }>({
  ...empty,
  loading: true,
  error: null,
});
/** One account-scoped listener. Pending local writes cannot satisfy onboarding. */
export function SavesProvider({ children }: { children: React.ReactNode }) {
  const uid = useLocal((s) => s.uid);
  const ref = useMemo(() => (uid ? collection(db, 'users', uid, 'saves') : null), [uid]);
  const subscribe = useCallback(
    (next: (value: SavedTracks) => void, fail: (error: unknown) => void) =>
      ref
        ? onSnapshot(
            ref,
            { includeMetadataChanges: true },
            (snapshot) =>
              next({
                ids: new Set(snapshot.docs.map((doc) => doc.id)),
                confirmedCount: snapshot.docs.filter((doc) => !doc.metadata.hasPendingWrites)
                  .length,
              }),
            fail,
          )
        : () => {},
    [ref],
  );
  const state = useSubscription(ref, ref ? subscribe : null, empty);
  const error = useMemo(() => (state.error ? errorMessage(state.error) : null), [state.error]);
  return (
    <Context.Provider value={{ ...state.data, loading: state.loading, error }}>
      {children}
    </Context.Provider>
  );
}
export const useSaves = () => useContext(Context);
