import React, { createContext, useContext, useMemo } from 'react';
import { collection, query, where } from '@react-native-firebase/firestore';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { db, call } from '../lib/firebase';
import { useCommunity } from './community';
import { useCollection } from './listeners';
import { useLocal } from '../state/local';
import type { Rating, ReleaseRating } from './types';

const Context = createContext<{
  byTrack: Map<string, Rating>;
  byRelease: Map<string, ReleaseRating>;
  releaseLoading: boolean;
  releaseError: string | null;
  loading: boolean;
  error: string | null;
}>({
  byTrack: new Map(),
  byRelease: new Map(),
  releaseLoading: true,
  releaseError: null,
  loading: true,
  error: null,
});
export function RatingsProvider({ children }: { children: React.ReactNode }) {
  const uid = useLocal((s) => s.uid);
  const ref = useMemo(
    () => (uid ? query(collection(db, 'ratings'), where('uid', '==', uid)) : null),
    [uid],
  );
  const { data, loading, error } = useCollection<Rating>(ref);
  const releaseRef = useMemo(
    () => (uid ? query(collection(db, 'releaseRatings'), where('uid', '==', uid)) : null),
    [uid],
  );
  const releases = useCollection<ReleaseRating>(releaseRef);
  const byRelease = useMemo(
    () => new Map(releases.data.map((r) => [r.releaseId, r])),
    [releases.data],
  );
  const byTrack = useMemo(() => new Map(data.map((r) => [r.trackId, r])), [data]);
  return (
    <Context.Provider
      value={{
        byTrack,
        loading,
        error,
        byRelease,
        releaseLoading: releases.loading,
        releaseError: releases.error,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useRatings = () => useContext(Context);

export function useRatingList({
  uid,
  trackId,
  highest = false,
  count = 25,
}: {
  uid?: string;
  trackId?: string;
  highest?: boolean;
  count?: number;
}) {
  return useCommunity<Rating>(
    { kind: 'ratings', ...(uid ? { uid } : { itemId: trackId }), highest },
    count,
  );
}

async function event(name: string, params: Record<string, string | number>) {
  // Analytics must never include review text or block a successful mutation.
  try {
    await logEvent(getAnalytics(), name, params);
  } catch {
    /* Telemetry is best-effort. */
  }
}
export async function ratingMutation(
  name:
    | 'setTrackRating'
    | 'deleteTrackRating'
    | 'setFavoriteTracks'
    | 'setReleaseRating'
    | 'deleteReleaseRating'
    | 'setFavoriteReleases',
  data: {
    releaseId?: string;
    releaseIds?: string[];
    trackId?: string;
    halfStars?: number;
    review?: string;
    trackIds?: string[];
  },
) {
  try {
    const result = await call<{ changed: boolean; reviewPending?: boolean }>(name, data);
    if (result.changed) {
      if (name === 'setReleaseRating') {
        void event('release_rating_published', {
          release_id: data.releaseId!,
          half_stars: data.halfStars!,
        });
        if (data.review?.trim())
          void event('release_review_submitted', { release_id: data.releaseId! });
      } else if (name === 'setFavoriteReleases') {
        void event('release_favorites_updated', { count: data.releaseIds!.length });
      } else if (name === 'setTrackRating') {
        void event('rating_published', { track_id: data.trackId!, half_stars: data.halfStars! });
        if (data.review?.trim()) void event('review_submitted', { track_id: data.trackId! });
      } else if (name === 'setFavoriteTracks')
        void event('favorites_updated', { count: data.trackIds!.length });
    }
    return result;
  } catch (error) {
    void event('rating_mutation_failed', { operation: name });
    throw error;
  }
}
