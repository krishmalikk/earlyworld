import { useMemo } from 'react';
import {
  collection,
  doc,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from '@react-native-firebase/firestore';
import { db } from '../lib/firebase';
import { useCatalogIds } from './catalog';
import { useCollection, useDocument } from './listeners';
import { useRatings } from './ratings';
import { useSession } from './session';
import type { Save } from './types';
import {
  favoriteAverage,
  pickRecap,
  savesLabel,
  startOfMonth,
  type OrbitFavorite,
} from '../../shared/share-cards';

/** The signed-in listener's favorites with their own ratings and reviews. */
export function useOrbitCard() {
  const { user } = useSession();
  const { byTrack } = useRatings();
  const ids = user?.favoriteTrackIds || [];
  const catalog = useCatalogIds('tracks', ids);
  const favorites: OrbitFavorite[] = ids.flatMap((id) => {
    const t = catalog.byId.get(id);
    if (!t) return [];
    const rating = byTrack.get(id);
    return [
      {
        id,
        title: t.title,
        artistName: t.artistName,
        artworkUrl: t.artworkUrl,
        halfStars: rating?.halfStars ?? null,
        review: rating?.review || '',
      },
    ];
  });
  const rated = favorites.flatMap((f) => (f.halfStars ? [f.halfStars] : []));
  return {
    loading: !user || (ids.length > 0 && catalog.loading && !favorites.length),
    data: user
      ? {
          username: user.username || 'listener',
          scenes: user.scenes || [],
          favorites,
          saves: user.saveCount || 0,
          reviews: (user.reviewCount || 0) + (user.releaseReviewCount || 0),
          average: favoriteAverage(rated),
        }
      : null,
  };
}

/** This month's earliest find (last month early on), from the owner's own save records. */
export function useRecapCard(uid: string | null) {
  const { user } = useSession();
  const since = useMemo(() => Timestamp.fromDate(startOfMonth(new Date(), -1)), []);
  const ref = useMemo(
    () =>
      uid
        ? query(
            collection(db, 'users', uid, 'saves'),
            where('savedAt', '>=', since),
            orderBy('savedAt', 'desc'),
            limit(300),
          )
        : null,
    [uid, since],
  );
  const saves = useCollection<Save>(ref);
  const pick = useMemo(
    () =>
      pickRecap(
        saves.data.map((s) => ({
          trackId: s.trackId,
          savedAtMillis: s.savedAt?.toMillis() || 0,
          saveCountAtSave: s.saveCountAtSave || 0,
        })),
        new Date(),
      ),
    [saves.data],
  );
  const save = pick ? saves.data.find((s) => s.trackId === pick.save.trackId) : undefined;
  const track = useCatalogIds('tracks', [pick?.save.trackId]).byId.get(pick?.save.trackId || '');
  return {
    loading: saves.loading,
    error: saves.error,
    data:
      pick && save && user
        ? {
            username: user.username || 'listener',
            monthLabel: pick.monthLabel,
            foundAt: pick.foundAt,
            nowSaves: track?.saveCount ?? pick.foundAt + 1,
            title: save.title,
            artistName: save.artistName,
            producerName: save.producerName,
            artworkUrl: track?.artworkUrl || save.artworkUrl,
          }
        : null,
  };
}

/** A specific own review, or the most recent one with written text. */
export function useReviewCard(uid: string | null, trackId?: string) {
  const { user } = useSession();
  const { byTrack, loading } = useRatings();
  const rating = trackId
    ? byTrack.get(trackId)
    : [...byTrack.values()]
        .filter((r) => r.review)
        .sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0))[0];
  const id = rating?.trackId;
  const track = useCatalogIds('tracks', [id]).byId.get(id || '');
  const saveRef = useMemo(() => (uid && id ? doc(db, 'users', uid, 'saves', id) : null), [uid, id]);
  const save = useDocument<Save>(saveRef);
  const detail = save.data
    ? `saved it at ${savesLabel(save.data.saveCountAtSave || 0)}`
    : rating?.createdAt
      ? `rated ${rating.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
      : '';
  return {
    loading: loading || (!!id && !track),
    data:
      rating?.review && track && user
        ? {
            username: user.username || 'listener',
            title: track.title,
            artistName: track.artistName,
            producerName: track.producerName,
            artworkUrl: track.artworkUrl,
            halfStars: rating.halfStars,
            review: rating.review,
            detail,
          }
        : null,
  };
}
