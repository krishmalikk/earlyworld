import { SCENES } from './domain';
export const SOCIAL_POLICY_VERSION = '2026-10-01';
export const SOCIAL_LIMITS = {
  text: 1000,
  photos: 4,
  photoBytes: 15 * 1024 * 1024,
  videoBytes: 150 * 1024 * 1024,
  minSeconds: 5,
  maxSeconds: 60,
  submissionsDaily: 10,
  videosDaily: 3,
  processingSecondsDaily: 1200,
} as const;
export type CatalogAttachment = {
  kind: 'track' | 'release' | 'artist' | 'producer';
  id: string;
  label?: string;
};
export type PostContent = {
  kind: 'post' | 'video';
  text: string;
  scenes: string[];
  attachment: CatalogAttachment | null;
  mediaIds: string[];
};
export type PostStatus = 'draft' | 'processing' | 'pending' | 'published' | 'rejected' | 'deleted';
export type SocialMedia = {
  id: string;
  kind: 'photo' | 'video';
  status: 'authorized' | 'processing' | 'ready' | 'failed';
  url?: string;
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
};
export type SocialPost = PostContent & {
  id: string;
  uid: string;
  author: { username: string; avatarUrl: string };
  status: PostStatus;
  version: number;
  publishedAt: number;
  updatedAt: number;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  bookmarked: boolean;
  media: SocialMedia[];
  reason?: string;
};
export type SocialComment = {
  id: string;
  uid: string;
  body: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  author: { username: string; avatarUrl: string };
  reason?: string;
};
export type SocialPage = { items: SocialPost[]; cursor: string | null };
export function validSocialId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}
export function normalizePost(input: unknown): PostContent {
  if (!input || typeof input !== 'object') throw Error('Check your post.');
  const d = input as Record<string, unknown>;
  if (d.kind !== 'post' && d.kind !== 'video') throw Error('Choose Post or Video.');
  if (typeof d.text !== 'string' || d.text.length > SOCIAL_LIMITS.text)
    throw Error('Keep text within 1,000 characters.');
  if (
    !Array.isArray(d.scenes) ||
    d.scenes.length > 3 ||
    d.scenes.some((s) => !SCENES.includes(s)) ||
    new Set(d.scenes).size !== d.scenes.length
  )
    throw Error('Choose up to three different scenes.');
  if (
    !Array.isArray(d.mediaIds) ||
    d.mediaIds.some((id) => !validSocialId(id)) ||
    new Set(d.mediaIds).size !== d.mediaIds.length ||
    d.mediaIds.length > (d.kind === 'video' ? 1 : 4)
  )
    throw Error('Choose one video or up to four photos.');
  let attachment: CatalogAttachment | null = null;
  if (d.attachment != null) {
    const a = d.attachment as Record<string, unknown>;
    if (
      !['track', 'release', 'artist', 'producer'].includes(String(a.kind)) ||
      !validSocialId(a.id)
    )
      throw Error('Choose a catalog item.');
    attachment = { kind: a.kind as CatalogAttachment['kind'], id: a.id };
  }
  return { kind: d.kind, text: d.text.trim(), scenes: d.scenes, mediaIds: d.mediaIds, attachment };
}
export function assertSubmittable(post: PostContent) {
  if (post.kind === 'video' && post.mediaIds.length !== 1) throw Error('Choose a video first.');
  if (!post.text && !post.mediaIds.length && !post.attachment)
    throw Error('Add text, a photo, or a catalog link.');
}
export function eligibleAgeBand(age: unknown): '13-17' | '18+' | null {
  return Number.isInteger(age) && Number(age) >= 13 && Number(age) <= 120
    ? Number(age) < 18
      ? '13-17'
      : '18+'
    : null;
}
