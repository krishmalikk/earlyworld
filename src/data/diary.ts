import { useMemo } from 'react';
import { collection, orderBy, query } from '@react-native-firebase/firestore';
import { db } from '../lib/firebase';
import { useLocal } from '../state/local';
import { useCollection } from './listeners';
import { useRatings } from './ratings';
import { buildDiary, groupDiary } from '../../shared/diary';
import type { Save } from './types';

/** The signed-in listener's own diary, grouped by month. Ratings come from the shared provider. */
export function useDiary() {
  const uid = useLocal((s) => s.uid);
  const ratings = useRatings();
  const savesRef = useMemo(
    () => (uid ? query(collection(db, 'users', uid, 'saves'), orderBy('savedAt', 'desc')) : null),
    [uid],
  );
  const saves = useCollection<Save>(savesRef);
  const months = useMemo(
    () =>
      groupDiary(
        buildDiary(
          [...ratings.byTrack.values()].map((r) => ({
            itemId: r.trackId,
            halfStars: r.halfStars,
            review: r.review,
            createdAt: r.createdAt?.toMillis() || 0,
          })),
          [...ratings.byRelease.values()].map((r) => ({
            itemId: r.releaseId,
            halfStars: r.halfStars,
            review: r.review,
            createdAt: r.createdAt?.toMillis() || 0,
          })),
          saves.data.map((s) => ({
            trackId: s.trackId,
            savedAt: s.savedAt?.toMillis() || 0,
            title: s.title,
            artistName: s.artistName,
            artworkUrl: s.artworkUrl,
          })),
        ),
      ),
    [ratings.byTrack, ratings.byRelease, saves.data],
  );
  return {
    months,
    loading: ratings.loading || ratings.releaseLoading || saves.loading,
    error: ratings.error || ratings.releaseError || saves.error,
  };
}
