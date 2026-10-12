import type { CatalogAttachment } from './social';

/** What a listener has told us about their taste, gathered server-side for the For You feed. */
export type Taste = {
  uid: string;
  savedTracks: Set<string>;
  favoriteTracks: Set<string>;
  favoriteReleases: Set<string>;
  /** Artist id → name, from saves and artist follows. */
  artists: Map<string, string>;
  /** Producer id → name, from saves and producer follows. */
  producers: Map<string, string>;
  followedUsers: Set<string>;
  scenes: Set<string>;
};

export type RatedTrack = {
  authorUid: string;
  trackId: string;
  artistId?: string | null;
  artistName?: string | null;
  producerId?: string | null;
  producerName?: string | null;
  hasReview: boolean;
};
export type RatedRelease = {
  authorUid: string;
  releaseId: string;
  artistId?: string | null;
  artistName?: string | null;
  hasReview: boolean;
};
export type PostSignal = {
  authorUid: string;
  attachment: CatalogAttachment | null;
  scenes: string[];
  /** For track or release attachments, the attached item's artist. */
  attachedArtistId?: string | null;
  attachedArtistName?: string | null;
};

const FOLLOWED = 'From someone you follow';
const named = (
  map: Map<string, string>,
  id: string | null | undefined,
  fallback?: string | null,
) => (id && map.has(id) ? map.get(id) || fallback || 'an artist' : null);

/**
 * Why a track rating belongs in this listener's feed, or null when it does not.
 * Bare star ratings only surface from people the listener follows; written reviews
 * also surface when they touch the listener's tracks, artists or producers.
 */
export function ratingReason(taste: Taste, r: RatedTrack): string | null {
  if (r.authorUid === taste.uid) return null;
  if (r.hasReview) {
    if (taste.favoriteTracks.has(r.trackId)) return 'Review of one of your favorite tracks';
    if (taste.savedTracks.has(r.trackId)) return 'Review of a track you saved';
    const artist = named(taste.artists, r.artistId, r.artistName);
    if (artist) return `Review of ${artist}, who you listen to`;
    const producer = named(taste.producers, r.producerId, r.producerName);
    if (producer) return `Review of a ${producer} production`;
  }
  return taste.followedUsers.has(r.authorUid) ? FOLLOWED : null;
}

export function releaseRatingReason(taste: Taste, r: RatedRelease): string | null {
  if (r.authorUid === taste.uid) return null;
  if (r.hasReview) {
    if (taste.favoriteReleases.has(r.releaseId)) return 'Review of one of your favorite releases';
    const artist = named(taste.artists, r.artistId, r.artistName);
    if (artist) return `Review of a ${artist} release`;
  }
  return taste.followedUsers.has(r.authorUid) ? FOLLOWED : null;
}

export function postReason(taste: Taste, p: PostSignal): string | null {
  if (p.authorUid === taste.uid) return null;
  const a = p.attachment;
  if (a) {
    const label = a.label || 'it';
    if (a.kind === 'track' && taste.favoriteTracks.has(a.id))
      return `Mentions ${label}, one of your favorites`;
    if (a.kind === 'track' && taste.savedTracks.has(a.id))
      return `Mentions ${label}, a track you saved`;
    if (a.kind === 'release' && taste.favoriteReleases.has(a.id))
      return `Mentions ${label}, one of your favorites`;
    if (a.kind === 'artist' && taste.artists.has(a.id))
      return `Mentions ${taste.artists.get(a.id) || label}, who you listen to`;
    if (a.kind === 'producer' && taste.producers.has(a.id))
      return `Mentions ${taste.producers.get(a.id) || label}, who you follow`;
    const artist = named(taste.artists, p.attachedArtistId, p.attachedArtistName);
    if (artist) return `Mentions ${label} by ${artist}, who you listen to`;
  }
  if (taste.followedUsers.has(p.authorUid)) return FOLLOWED;
  const scene = p.scenes.find((s) => taste.scenes.has(s));
  return scene ? `From the ${scene} scene` : null;
}
