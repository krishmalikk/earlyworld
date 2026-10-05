import {
  deleteDoc,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';
import { db, call } from '../lib/firebase';
import type { Track } from './types';
import { applySaveIntent, type SaveSource } from '../../shared/saves';
export async function toggleSave(uid: string, track: Track, saved: boolean) {
  return runTransaction(db, (tx) =>
    applySaveIntent(
      {
        get: async (path) => (await tx.get(doc(db, path))).data() as SaveSource | undefined,
        set: (path, value) => {
          tx.set(doc(db, path), value);
        },
        delete: (path) => {
          tx.delete(doc(db, path));
        },
      },
      uid,
      track.id,
      !saved,
      serverTimestamp(),
    ),
  );
}
export async function follow(
  uid: string,
  targetId: string,
  targetType: 'user' | 'artist' | 'producer',
  following: boolean,
) {
  const ref = doc(db, 'users', uid, 'following', targetId);
  return following
    ? deleteDoc(ref)
    : setDoc(ref, { targetId, targetType, followedAt: serverTimestamp() });
}
export async function reserveUsername(_uid: string, username: string) {
  return call('reserveCommunityUsername', { username });
}
export async function comment(_uid: string, trackId: string, body: string, requestId: string) {
  return call('submitTrackComment', { trackId, body, requestId });
}
