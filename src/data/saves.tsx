import React, { createContext, useContext, useMemo } from 'react';
import { collection } from '@react-native-firebase/firestore';
import { db } from '../lib/firebase';
import { useLocal } from '../state/local';
import { useCollection } from './listeners';
import type { Save } from './types';
const Context = createContext<{ ids: Set<string>; error: string | null }>({
  ids: new Set(),
  error: null,
});
/** One saved-track listener shared by every card, rather than one listener per row. */
export function SavesProvider({ children }: { children: React.ReactNode }) {
  const uid = useLocal((s) => s.uid);
  const ref = useMemo(() => (uid ? collection(db, 'users', uid, 'saves') : null), [uid]);
  const { data, error } = useCollection<Save>(ref);
  const ids = useMemo(() => new Set(data.map((s) => s.trackId)), [data]);
  return <Context.Provider value={{ ids, error }}>{children}</Context.Provider>;
}
export const useSaves = () => useContext(Context);
