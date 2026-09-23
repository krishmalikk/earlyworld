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
  saveCount: number;
  savers: string[];
  saversCapped: boolean;
  createdAt?: Stamp;
  embedUrl?: string | null;
  durationSeconds?: number;
  geniusStatus: 'pending' | 'matched' | 'unmatched';
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
  onboardingComplete: boolean;
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
