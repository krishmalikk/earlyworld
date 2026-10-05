import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { doc } from '@react-native-firebase/firestore';
import { useFocusEffect } from 'expo-router';
import { call, db, errorMessage } from '../lib/firebase';
import { useLocal } from '../state/local';
import { useDocument, useForeground } from './listeners';
import { useCursorPages } from './useCursorPages';
import type { SocialPage, SocialPost } from '../../shared/social';
export type SocialStatus = {
  creation: boolean;
  publication: boolean;
  playback: boolean;
  admin: boolean;
  eligible: boolean;
  supportEmail: string;
  policyVersion: string;
};
const Context = createContext({
  version: 0,
  changed: () => {},
  videoMuted: true,
  setVideoMuted: (_value: boolean) => {},
});
export function SocialProvider({ children }: { children: React.ReactNode }) {
  const uid = useLocal((s) => s.uid);
  return (
    <AccountSocial key={uid || 'out'} uid={uid}>
      {children}
    </AccountSocial>
  );
}
function AccountSocial({ uid, children }: { uid: string | null; children: React.ReactNode }) {
  const globalRef = useMemo(() => (uid ? doc(db, 'socialState', 'current') : null), [uid]),
    ownRef = useMemo(() => (uid ? doc(db, 'users', uid, 'socialState', 'current') : null), [uid]);
  const global = useDocument(globalRef),
    own = useDocument(ownRef);
  const [version, setVersion] = useState(0),
    [videoMuted, setVideoMuted] = useState(true);
  useEffect(() => setVersion((v) => v + 1), [global.data, own.data]);
  const value = useMemo(
    () => ({ version, changed: () => setVersion((v) => v + 1), videoMuted, setVideoMuted }),
    [version, videoMuted],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useSocial = () => useContext(Context);
export function useSocialStatus() {
  const uid = useLocal((s) => s.uid),
    { version } = useSocial();
  const [state, set] = useState<{
    key: string | null;
    data: SocialStatus | null;
    error: string | null;
  }>({ key: null, data: null, error: null });
  useEffect(() => {
    let live = true;
    if (uid)
      call<SocialStatus>('getSocialStatus')
        .then((data) => {
          if (live) set({ key: uid, data, error: null });
        })
        .catch((e) => {
          if (live) set({ key: uid, data: null, error: errorMessage(e) });
        });
    return () => {
      live = false;
    };
  }, [uid, version]);
  return state.key === uid ? state : { key: uid, data: null, error: null };
}
export function usePostPage(
  options: { mode?: string; uid?: string; kind?: string; scene?: string },
  enabled = true,
) {
  const uid = useLocal((s) => s.uid),
    { version } = useSocial(),
    active = useForeground();
  const signature = JSON.stringify(options);
  const key = `${uid}:${signature}`;
  const [cache, setCache] = useState<{ key: string; items: Map<string, SocialPost> }>({
    key,
    items: new Map(),
  });
  const latest = useRef(key);
  latest.current = key;
  const load = useCallback(
    async (cursor: string | null) => {
      const page = await call<SocialPage>('listPosts', { ...JSON.parse(signature), cursor });
      if (latest.current === key)
        setCache((old) => ({
          key,
          items: new Map([
            ...(old.key === key ? old.items : []),
            ...page.items.map((p) => [p.id, p] as const),
          ]),
        }));
      return { ids: page.items.map((p) => p.id), cursor: page.cursor };
    },
    [key, signature],
  );
  const page = useCursorPages(key, !!uid && enabled && active, load);
  useEffect(() => {
    if (enabled) page.revalidate();
  }, [version, key, enabled]);
  useFocusEffect(
    useCallback(() => {
      if (enabled) page.refresh();
    }, [key, enabled]),
  );
  const data =
    cache.key === key
      ? page.ids.flatMap((id) => (cache.items.get(id) ? [cache.items.get(id)!] : []))
      : [];
  return { ...page, data, error: page.error ? errorMessage(page.error) : null };
}
export async function socialMutation<T = unknown>(name: string, data: unknown): Promise<T> {
  return call<T>(name, data);
}
