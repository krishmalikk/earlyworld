import type { RatingValue } from '../../shared/ratings';
import type { EntityType, Tier } from '../../shared/domain';
export type Stamp = { toDate(): Date; toMillis(): number };
export type Entity = {
  id: string;
  name: string;
  imageUrl: string;
  aliases: string[];
  scenes?: string[];
  trackCount: number;
  discoveryRank?: number;
  geniusId?: number;
  geniusUrl?: string;
  biography?: string;
  geniusSync?: {
    nextPage: number | null;
    complete: boolean;
    checkedSongs: number;
    verifiedCount: number;
    updatedAt?: Stamp;
  };
};
export type Track = {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  producerId: string | null;
  producerName: string | null;
  sourceUrl: string;
  sourcePlatform: 'soundcloud' | 'youtube' | 'bandcamp' | 'other';
  artworkUrl: string;
  ratingCount?: number;
  ratingHalfStarSum?: number;
  saveCount: number;
  savers: string[];
  saversCapped: boolean;
  createdAt?: Stamp;
  durationSeconds?: number;
  sourceStatus?: 'available' | 'unavailable';
  sourceCheckedAt?: Stamp;
  soundcloud?: { urn: string; permalinkUrl: string; genre?: string; publishedAt?: string | null };
  geniusId?: number;
  geniusStatus: 'pending' | 'deferred' | 'matched' | 'unmatched' | 'ambiguous' | 'error';
  geniusUrl: string | null;
  credits: null | {
    producers: string[];
    writers: string[];
    performances: { role: string; artists: string[] }[];
    album: string | null;
    releaseDate: string | null;
  };
};
export type User = {
  id: string;
  username: string;
  usernameLower: string;
  avatarUrl: string;
  bio: string;
  saveCount: number;
  followerCount: number;
  ratingCount?: number;
  reviewCount?: number;
  favoriteTrackIds?: string[];
  favoriteReleaseIds?: string[];
  releaseRatingCount?: number;
  releaseReviewCount?: number;
  onboardingComplete: boolean;
  initialMatchesComputed?: boolean;
  onboardingStep: number;
  scenes: string[];
};
export type Save = {
  id: string;
  trackId: string;
  title: string;
  artistId: string;
  artistName: string;
  producerId: string | null;
  producerName: string | null;
  artworkUrl: string;
  savedAt: Stamp;
  saveCountAtSave: number;
};
export type Rotation = {
  id: string;
  uid: string;
  entityId: string;
  entityType: EntityType;
  name: string;
  imageUrl: string;
  tier: Tier;
  score: number;
  firstEngagedAt: Stamp;
};
export type Match = {
  id: string;
  score: number;
  sharedTracks: { trackId: string; title: string; artistName: string; saveCount: number }[];
};
export type Follow = { id: string; targetId: string; targetType: 'user' | EntityType };

export type Rating = RatingValue & { id: string; createdAt: Stamp; updatedAt: Stamp };

export type Production = {
  id: string;
  geniusId: number;
  title: string;
  artistName: string;
  artworkUrl: string;
  geniusUrl: string;
  releaseDate: string | null;
};

export type ReleaseType = 'album' | 'ep' | 'mixtape' | 'compilation' | 'single';
export type ReleaseTrack = {
  urn: string;
  trackId: string | null;
  title: string;
  artistName: string;
  artworkUrl: string;
  sourceUrl: string;
  durationSeconds: number;
};
export type Release = {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  releaseType: ReleaseType;
  artworkUrl: string;
  sourceUrl: string;
  releasedAt: string | null;
  tracks: ReleaseTrack[];
  ratingCount?: number;
  ratingHalfStarSum?: number;
};
export type ReleaseRating = Omit<Rating, 'trackId'> & { releaseId: string };
