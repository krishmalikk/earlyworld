import { useCallback, useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocal } from '../state/local';
import { forgetSearch, rememberSearch } from '../../shared/recent-searches';

// One small file per account; nothing is synced, and signing out leaves other accounts untouched.
const path = (uid: string) => `${FileSystem.documentDirectory}recent-searches-${uid}.json`;
async function read(uid: string): Promise<string[]> {
  try {
    const parsed: unknown = JSON.parse(await FileSystem.readAsStringAsync(path(uid)));
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
/** The signed-in account's last few catalog searches, kept across launches. */
export function useRecentSearches() {
  const uid = useLocal((s) => s.uid);
  const [state, setState] = useState<{ uid: string | null; items: string[] }>({ uid, items: [] });
  useEffect(() => {
    let live = true;
    if (!uid) return;
    void read(uid).then((items) => {
      if (live) setState({ uid, items });
    });
    return () => {
      live = false;
    };
  }, [uid]);
  const write = useCallback(
    (update: (items: string[]) => string[]) => {
      if (!uid) return;
      setState((old) => {
        const items = update(old.uid === uid ? old.items : []);
        void FileSystem.writeAsStringAsync(path(uid), JSON.stringify(items)).catch(() => undefined);
        return { uid, items };
      });
    },
    [uid],
  );
  return {
    items: state.uid === uid ? state.items : [],
    remember: useCallback((term: string) => write((items) => rememberSearch(items, term)), [write]),
    forget: useCallback((term: string) => write((items) => forgetSearch(items, term)), [write]),
    clear: useCallback(() => write(() => []), [write]),
  };
}
