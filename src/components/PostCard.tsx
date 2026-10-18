import { useState } from 'react';
import { Alert, Modal, Pressable, Share, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { SocialPost } from '../../shared/social';
import { fontSize, radius, space } from '../../shared/theme';
import { Artwork, Button, c, ErrorLine, s } from './ui';
import { socialMutation, useSocial } from '../data/social';
import { errorMessage } from '../lib/firebase';
import { useLocal } from '../state/local';
import { PostAttachment } from './PostAttachment';
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
    [busy, setBusy] = useState(false),
    // The whole photo, shown full screen; the feed crops photos to squares.
    [viewing, setViewing] = useState<string | null>(null),
    [photoState, setPhotoState] = useState<'loading' | 'ready' | 'error'>('loading'),
    [photoAttempt, setPhotoAttempt] = useState(0),
    [truncated, setTruncated] = useState(false);
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
  const open = () =>
    router.push({
      pathname: '/post/[id]',
      params: { id: post.id, ...(post.status !== 'published' ? { own: 'true' } : {}) },
    });
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
            onTextLayout={(event) => {
              if (!detail && event.nativeEvent.lines.length >= 6) setTruncated(true);
            }}
            numberOfLines={detail ? undefined : 6}
          >
            {post.text}
          </Text>
        </Pressable>
      ) : null}
      {!detail && truncated ? (
        <Button quiet onPress={open}>
          Read more
        </Button>
      ) : null}
      {post.attachment ? <PostAttachment attachment={post.attachment} /> : null}
      {post.media.length ? (
        <View style={{ gap: space[8], flexDirection: 'row', flexWrap: 'wrap' }}>
          {post.media.map((media) => (
            <Pressable
              key={media.id}
              accessibilityRole="button"
              accessibilityLabel="View full photo"
              disabled={media.status !== 'ready'}
              onPress={() => {
                setPhotoState('loading');
                setViewing(media.url || media.thumbnailUrl || null);
              }}
              style={{
                width: post.media.length > 1 ? '48%' : '100%',
                borderRadius: radius.large,
                overflow: 'hidden',
              }}
            >
              {media.status === 'ready' ? (
                <Artwork uri={media.url || media.thumbnailUrl} name="Post photo" size="fill" />
              ) : (
                <Text style={[s.muted, { padding: space[16] }]}>
                  {media.status === 'failed' ? 'Photo could not be processed' : 'Processing photo…'}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
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
            ? 'Publishing'
            : post.status === 'processing'
              ? 'Processing photos · Only you can see this for now'
              : post.status === 'draft' || post.status === 'rejected'
                ? 'Couldn’t publish'
                : post.status}
        </Text>
      )}
      <ErrorLine message={error} />
      <Modal
        visible={!!viewing}
        animationType="fade"
        presentationStyle="overFullScreen"
        transparent
        onRequestClose={() => setViewing(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            onPress={() => setViewing(null)}
            hitSlop={8}
            style={{ alignSelf: 'flex-end', padding: space[16] }}
          >
            <Ionicons name="close" size={28} color={c.text} />
          </Pressable>
          {photoState === 'loading' && viewing ? (
            <Text accessibilityLiveRegion="polite" style={s.muted}>
              Loading photo…
            </Text>
          ) : null}
          {photoState === 'error' ? (
            <View style={s.panel}>
              <Text style={s.error}>
                Could not load this photo. Check your connection or reopen the post to refresh the
                photo link.
              </Text>
              <Button
                quiet
                onPress={() => {
                  setPhotoState('loading');
                  setPhotoAttempt((n) => n + 1);
                }}
              >
                Retry photo
              </Button>
            </View>
          ) : null}
          {viewing ? (
            <Image
              key={`${viewing}:${photoAttempt}`}
              onLoad={() => setPhotoState('ready')}
              onError={() => setPhotoState('error')}
              source={{ uri: viewing }}
              contentFit="contain"
              accessibilityLabel="Post photo"
              style={{ flex: 1, marginBottom: space[16] }}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
