import { useMemo } from 'react';
import { collection, doc, limit, orderBy, query } from '@react-native-firebase/firestore';
import { db } from '../lib/firebase';
import { useLocal } from '../state/local';
import { useCollection, useDocument } from './listeners';
import type { ActivityNotice, Stamp } from './types';

/** The signed-in listener's latest notices and how many arrived since they last looked. */
export function useActivity() {
  const uid = useLocal((s) => s.uid);
  const noticesRef = useMemo(
    () =>
      uid
        ? query(
            collection(db, 'users', uid, 'notifications'),
            orderBy('createdAt', 'desc'),
            limit(50),
          )
        : null,
    [uid],
  );
  const seenRef = useMemo(
    () => (uid ? doc(db, 'users', uid, 'socialState', 'activity') : null),
    [uid],
  );
  const notices = useCollection<ActivityNotice>(noticesRef, true);
  const seen = useDocument<{ seenAt?: Stamp }>(seenRef);
  const seenAt = seen.data?.seenAt?.toMillis() || 0;
  return {
    ...notices,
    seenAt,
    unread: notices.data.filter((notice) => (notice.createdAt?.toMillis() || 0) > seenAt).length,
  };
}
