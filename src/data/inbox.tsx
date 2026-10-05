import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import { call, db } from '../lib/firebase';
import { useLocal } from '../state/local';
import { useCollection } from './listeners';
import { useCommunity } from './community';
import { MESSAGE_LIMITS } from '../../shared/messages';
import type { InboxRow, Match, User } from './types';

type Inbox = {
  conversations: InboxRow[];
  requests: InboxRow[];
  unread: number;
  /** Listeners this account blocked; their group messages are hidden on this device. */
  blocked: ReadonlySet<string>;
  loading: boolean;
  error: string | null;
};
const empty: Inbox = {
  conversations: [],
  requests: [],
  unread: 0,
  blocked: new Set(),
  loading: true,
  error: null,
};
const Context = createContext<Inbox>(empty);

/** One account-scoped inbox listener feeds the tab badge, inbox and chat screens. */
export function InboxProvider({ children }: { children: React.ReactNode }) {
  const uid = useLocal((s) => s.uid);
  return (
    <AccountInbox key={uid || 'out'} uid={uid}>
      {children}
    </AccountInbox>
  );
}
function AccountInbox({ uid, children }: { uid: string | null; children: React.ReactNode }) {
  const rowsRef = useMemo(
      () =>
        uid
          ? query(
              collection(db, 'users', uid, 'conversations'),
              where('state', 'in', ['inbox', 'request']),
              orderBy('lastMessageAt', 'desc'),
              limit(MESSAGE_LIMITS.inbox),
            )
          : null,
      [uid],
    ),
    blockedRef = useMemo(() => (uid ? collection(db, 'users', uid, 'blockedUsers') : null), [uid]);
  const rows = useCollection<InboxRow>(rowsRef, true),
    blocked = useCollection<{ id: string }>(blockedRef, true);
  const value = useMemo<Inbox>(() => {
    // A direct request appears only once it carries a message.
    const visible = rows.data.filter((r) => r.type === 'group' || r.lastMessage);
    const conversations = visible.filter((r) => r.state === 'inbox');
    return {
      conversations,
      requests: visible.filter((r) => r.state === 'request'),
      unread: conversations.reduce((n, r) => n + (r.unread ? 1 : 0), 0),
      blocked: new Set(blocked.data.map((b) => b.id)),
      loading: rows.loading,
      error: rows.error || blocked.error,
    };
  }, [rows.data, rows.loading, rows.error, blocked.data, blocked.error]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useInbox = () => useContext(Context);

export function useMatches() {
  const uid = useLocal((s) => s.uid);
  const ref = useMemo(
    () => (uid ? query(collection(db, 'users', uid, 'matches'), orderBy('score', 'desc')) : null),
    [uid],
  );
  return useCollection<Match>(ref, true);
}

/** Public identities for a set of listeners, fetched in one authorized request. */
export function useProfiles(uids: string[]) {
  const ids = [...new Set(uids)].sort().slice(0, 30);
  const state = useCommunity<User>({ kind: 'profiles', uids: ids }, 30, ids.length > 0);
  const byId = useMemo(() => new Map(state.data.map((p) => [p.id, p])), [state.data]);
  return { byId, loading: state.loading, error: state.error };
}

/** Debounced exact-prefix username search. */
export function useUserSearch(text: string) {
  const term = text.trim().replace(/^@/, '').toLowerCase();
  const [state, set] = useState<{ term: string; data: User[]; error: string | null }>({
    term: '',
    data: [],
    error: null,
  });
  useEffect(() => {
    if (!/^[a-z0-9_]{1,20}$/.test(term)) return;
    let live = true;
    const timer = setTimeout(() => {
      call<{ items: User[] }>('searchUsers', { query: term })
        .then((r) => live && set({ term, data: r.items, error: null }))
        .catch((e) => live && set({ term, data: [], error: e?.message || 'Search failed.' }));
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [term]);
  const valid = /^[a-z0-9_]{1,20}$/.test(term);
  return {
    data: valid && state.term === term ? state.data : [],
    loading: valid && state.term !== term,
    error: state.term === term ? state.error : null,
  };
}

export function markRead(uid: string, cid: string) {
  return updateDoc(doc(db, 'users', uid, 'conversations', cid), {
    unread: 0,
    readAt: serverTimestamp(),
  });
}
