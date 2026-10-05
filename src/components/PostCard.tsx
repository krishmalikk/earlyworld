import { useState } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { SocialPost, CatalogAttachment } from '../../shared/social';
import { fontSize, radius, space } from '../../shared/theme';
import { Artwork, Button, c, ErrorLine, s } from './ui';
import { socialMutation, useSocial } from '../data/social';
import { errorMessage } from '../lib/firebase';
import { useLocal } from '../state/local';
export function openAttachment(a: CatalogAttachment) {
  if (a.kind === 'track') router.push(`/track/${a.id}`);
  else if (a.kind === 'release') router.push(`/release/${a.id}`);
  else router.push({ pathname: '/entity/[id]', params: { id: a.id, type: a.kind } });
}
export function PostCard({
  post,
  detail = false,
  onComments,
}: {
  post: SocialPost;
  detail?: boolean;
  onComments?: () => void;
}) {
  const uid = useLocal((s) => s.uid),
    { changed } = useSocial(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function mutate(name: string, data: unknown) {
    setBusy(true);
    setError('');
    try {
      await socialMutation(name, data);
      changed();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const open = () => router.push({ pathname: '/post/[id]', params: { id: post.id } });
  return (
    <View style={[s.panel, { gap: space[12] }]}>
      <View style={s.between}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/user/${post.uid}`)}
          style={s.row}
        >
          <Artwork uri={post.author.avatarUrl} name={post.author.username} size={36} />
          <View>
            <Text style={s.text}>@{post.author.username}</Text>
            <Text style={s.muted}>
              {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : post.status}
            </Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Post options"
          onPress={() =>
            Alert.alert('Post options', undefined, [
              ...(uid === post.uid
                ? [
                    {
                      text: 'Edit text & links',
                      onPress: () =>
                        router.push({ pathname: '/(tabs)/create', params: { edit: post.id } }),
                    },
                    {
                      text: 'Delete post',
                      style: 'destructive' as const,
                      onPress: () =>
                        Alert.alert(
                          'Delete this post?',
                          'It will disappear from your profile and feeds.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () =>
                                void mutate('deleteSocialContent', { id: post.id, kind: 'post' }),
                            },
                          ],
                        ),
                    },
                  ]
                : [
                    {
                      text: 'Report',
                      onPress: () =>
                        router.push({
                          pathname: '/community',
                          params: { reportKind: 'post', reportId: post.id },
                        }),
                    },
                    {
                      text: 'Block user',
                      style: 'destructive' as const,
                      onPress: () => void mutate('setUserBlock', { uid: post.uid, blocked: true }),
                    },
                  ]),
              { text: 'Cancel', style: 'cancel' },
            ])
          }
          style={{ padding: space[12] }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={c.muted} />
        </Pressable>
      </View>
      {post.text ? (
        <Pressable disabled={detail} onPress={open}>
          <Text
            style={[s.text, { fontSize: fontSize.trackTitle }]}
            numberOfLines={detail ? undefined : 6}
          >
            {post.text}
          </Text>
        </Pressable>
      ) : null}
      {post.media.length ? (
        <View style={{ gap: space[8] }}>
          {post.media.map((media) => (
            <Pressable
              key={media.id}
              accessibilityRole="button"
              accessibilityLabel={post.kind === 'video' ? 'Watch video' : 'Open post photo'}
              onPress={() =>
                post.kind === 'video'
                  ? router.push({ pathname: '/videos', params: { start: post.id } })
                  : open()
              }
              style={{ borderRadius: radius.large, overflow: 'hidden' }}
            >
              <Artwork
                uri={media.thumbnailUrl || media.url}
                name={post.kind === 'video' ? 'Video' : 'Post photo'}
                size="fill"
              />
              {post.kind === 'video' ? (
                <View style={{ position: 'absolute', left: '42%', top: '42%' }}>
                  <Ionicons name="play-circle" size={56} color={c.text} />
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      {post.attachment ? (
        <Button quiet onPress={() => openAttachment(post.attachment!)}>
          {post.attachment.label || 'View attached music'} ↗
        </Button>
      ) : null}
      {post.scenes.length ? (
        <Text style={s.link}>{post.scenes.map((s) => `#${s}`).join('  ')}</Text>
      ) : null}
      {post.reason ? <Text style={s.error}>{post.reason}</Text> : null}
      {post.status === 'published' ? (
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Pressable
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={post.liked ? 'Unlike post' : 'Like post'}
            onPress={() =>
              void mutate('setPostInteraction', { id: post.id, kind: 'like', active: !post.liked })
            }
            style={[s.row, { paddingVertical: space[10] }]}
          >
            <Ionicons
              name={post.liked ? 'heart' : 'heart-outline'}
              size={23}
              color={post.liked ? c.accent : c.muted}
            />
            <Text style={s.muted}>{post.likeCount}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Comments"
            onPress={onComments || open}
            style={[s.row, { paddingVertical: space[10] }]}
          >
            <Ionicons name="chatbubble-outline" size={21} color={c.muted} />
            <Text style={s.muted}>{post.commentCount}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share post"
            onPress={() =>
              void Share.share({
                message: `https://earlyworld-6831c.web.app/post/${post.id}`,
              }).catch(() => setError('Could not open sharing.'))
            }
            style={{ padding: space[10] }}
          >
            <Ionicons name="share-outline" size={22} color={c.muted} />
          </Pressable>
          <Pressable
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={post.bookmarked ? 'Remove bookmark' : 'Bookmark post'}
            onPress={() =>
              void mutate('setPostInteraction', {
                id: post.id,
                kind: 'bookmark',
                active: !post.bookmarked,
              })
            }
            style={{ padding: space[10] }}
          >
            <Ionicons
              name={post.bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={c.accent}
            />
          </Pressable>
        </View>
      ) : (
        <Text style={s.muted}>
          {post.status === 'pending'
            ? 'Awaiting review'
            : post.status === 'processing'
              ? 'Processing media'
              : post.status}
        </Text>
      )}
      <ErrorLine message={error} />
    </View>
  );
}
