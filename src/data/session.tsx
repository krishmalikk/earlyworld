import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { onAuthStateChanged } from '@react-native-firebase/auth';
import { doc } from '@react-native-firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useLocal } from '../state/local';
import { useDocument } from './listeners';
import type { User } from './types';
const Context = createContext<{ user: User | null; loading: boolean; error: string | null }>({
  user: null,
  loading: true,
  error: null,
});
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const uid = useLocal((s) => s.uid),
    setAuth = useLocal((s) => s.setAuth),
    authReady = useLocal((s) => s.authReady);
  useEffect(() => onAuthStateChanged(auth, (user) => setAuth(user?.uid || null)), [setAuth]);
  const ref = useMemo(() => (uid ? doc(db, 'users', uid) : null), [uid]);
  const state = useDocument<User>(ref);
  return (
    <Context.Provider
      value={{
        user: state.data,
        loading: !authReady || (!!uid && state.loading),
        error: state.error,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
