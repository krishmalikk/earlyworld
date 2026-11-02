import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { call, report } from '../lib/firebase';
import { useLocal } from '../state/local';
import { ProfileStore, type LoadedProfile } from './profile-store';
import { useSocial } from './social';

const loadProfiles = async (uids: string[]) =>
  (await call<{ items: LoadedProfile[] }>('readCommunity', { kind: 'profiles', uids })).items;
const Context = createContext<ProfileStore | null>(null);

export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const uid = useLocal((s) => s.uid);
  return (
    <AccountProfiles key={uid || 'out'} signedIn={!!uid}>
      {children}
    </AccountProfiles>
  );
}
function AccountProfiles({ signedIn, children }: { signedIn: boolean; children: React.ReactNode }) {
  const { version } = useSocial();
  const store = useMemo(() => new ProfileStore(loadProfiles, report), []);
  useEffect(() => {
    store.open();
    return () => store.close();
  }, [store]);
  useEffect(() => {
    if (signedIn) store.refresh();
  }, [version, signedIn, store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
/** Undefined while loading; null when the server withholds this listener. */
export function useProfile(uid: string) {
  const store = useContext(Context);
  if (!store) throw Error('useProfile needs ProfilesProvider.');
  useEffect(() => store.retain(uid), [store, uid]);
  return useSyncExternalStore(store.subscribe, () => store.get(uid));
}
