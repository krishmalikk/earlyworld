import {
  collection,
  deleteDoc,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';
import { db } from '../lib/firebase';
import type { Track } from './types';
export async function toggleSave(uid: string, track: Track, saved: boolean) {
  const ref = doc(db, 'users', uid, 'saves', track.id);
  if (saved) return deleteDoc(ref);
  return setDoc(ref, {
    trackId: track.id,
    savedAt: serverTimestamp(),
    title: track.title,
    artistId: track.artistId,
    artistName: track.artistName,
    producerId: track.producerId ?? null,
    producerName: track.producerName ?? null,
    artworkUrl: track.artworkUrl || '',
    saveCountAtSave: track.saveCount || 0,
  });
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
export async function reserveUsername(uid: string, name: string) {
  const username = name.toLowerCase();
  return runTransaction(db, async (tx) => {
    const ref = doc(db, 'usernames', username),
      userRef = doc(db, 'users', uid);
    const [reservation, user] = await Promise.all([tx.get(ref), tx.get(userRef)]);
    if (reservation.exists() && reservation.data()?.uid !== uid)
      throw new Error('That name was just taken. Try another.');
    if (user.data()?.usernameLower && user.data()?.usernameLower !== username)
      throw new Error('Your username is already reserved.');
    if (!reservation.exists()) tx.set(ref, { uid, createdAt: serverTimestamp() });
    tx.update(userRef, { username, usernameLower: username, onboardingStep: 2 });
  });
}
export async function comment(uid: string, trackId: string, body: string) {
  return setDoc(doc(collection(db, 'tracks', trackId, 'comments')), {
    uid,
    body: body.trim(),
    createdAt: serverTimestamp(),
  });
}
