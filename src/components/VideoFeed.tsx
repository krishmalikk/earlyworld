import { socialEvent } from '../data/social-telemetry';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Share, Text, View, type ViewToken } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import type { SocialPost } from '../../shared/social';
import { SCENES } from '../../shared/domain';
import { space } from '../../shared/theme';
import { useForeground } from '../data/listeners';
import { usePostPage, useSocial } from '../data/social';
import { call, errorMessage } from '../lib/firebase';
import { Artwork, Button, c, Chip, Empty, ErrorLine, s } from './ui';
import { openAttachment } from './PostCard';
function Clip({
  post,
  active,
  preload,
  height,
}: {
  post: SocialPost;
  active: boolean;
  preload: boolean;
  height: number;
}) {
  const { videoMuted, setVideoMuted, version } = useSocial();
  const [fresh, setFresh] = useState(post),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    if (active || preload)
      call<SocialPost>('getPost', { id: post.id })
        .then((p) => {
          if (live) {
            setFresh(p);
            setError('');
          }
        })
        .catch((e) => {
          if (live) setError(errorMessage(e));
        });
    return () => {
      live = false;
    };
  }, [post.id, active, preload, retry, version]);
  const source = fresh.media[0]?.url;
  return (
    <View style={{ height, backgroundColor: c.bg }}>
      {(active || preload) && source && !error ? (
        <ClipPlayer
          post={fresh}
          source={source}
          active={active}
          muted={videoMuted}
          setMuted={setVideoMuted}
          onError={() => setError('Video unavailable. Try again.')}
        />
      ) : error ? null : (
        <Artwork uri={fresh.media[0]?.thumbnailUrl} name="Video thumbnail" size="fill" />
      )}
      {!source || error ? (
        <View style={[s.body, { position: 'absolute', top: '35%', left: 0, right: 0 }]}>
          <ErrorLine message={error || 'Playback is not available yet.'} />
          <Button quiet onPress={() => setRetry((n) => n + 1)}>
            Retry
          </Button>
        </View>
      ) : null}
    </View>
  );
}
function ClipPlayer({
  post,
  source,
  active,
  muted,
  setMuted,
  onError,
}: {
  post: SocialPost;
  source: string;
  active: boolean;
  muted: boolean;
  setMuted: (value: boolean) => void;
  onError: () => void;
}) {
  const openedAt = useRef(Date.now()),
    started = useRef(false);
  const player = useVideoPlayer({ uri: source, useCaching: false }, (p) => {
    p.loop = true;
    p.muted = muted;
    p.timeUpdateEventInterval = 0.25;
  });
  const [opinion, setOpinion] = useState({
      liked: post.liked,
      bookmarked: post.bookmarked,
      likeCount: post.likeCount,
    }),
    [mutationError, setMutationError] = useState(''),
    [busy, setBusy] = useState(false);
  async function interact(kind: 'like' | 'bookmark') {
    if (busy) return;
    setBusy(true);
    try {
      const active = kind === 'like' ? !opinion.liked : !opinion.bookmarked;
      await call('setPostInteraction', { id: post.id, kind, active });
      setOpinion((p) =>
        kind === 'like'
          ? { ...p, liked: active, likeCount: Math.max(0, p.likeCount + (active ? 1 : -1)) }
          : { ...p, bookmarked: active },
      );
      setMutationError('');
    } catch (e) {
      setMutationError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const [paused, setPaused] = useState(false),
    [seekWidth, setSeekWidth] = useState(1);
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    bufferedPosition: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);
  useEffect(() => {
    if (active && !paused) player.play();
    else player.pause();
    return () => player.pause();
  }, [player, active, paused]);
  useEffect(() => {
    if (status === 'error') onError();
    if (status === 'readyToPlay' && !started.current) {
      started.current = true;
      socialEvent('video_startup', Date.now() - openedAt.current);
    } else if (status === 'loading' && started.current && active) socialEvent('video_rebuffer');
  }, [status]);
  return (
    <>
      <VideoView
        player={player}
        style={{ flex: 1 }}
        contentFit="contain"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
      {active ? (
        <View
          style={{
            position: 'absolute',
            left: space[18],
            right: space[18],
            bottom: space[18],
            gap: space[12],
          }}
        >
          <View style={s.between}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={paused ? 'Play' : 'Pause'}
              onPress={() => setPaused(!paused)}
              style={{ padding: space[12], backgroundColor: c.panel }}
            >
              <Ionicons name={paused ? 'play' : 'pause'} size={24} color={c.text} />
            </Pressable>
            <Button quiet onPress={() => setMuted(!muted)}>
              {muted ? 'Sound off' : 'Sound on'}
            </Button>
          </View>
          <View style={[s.panel, { backgroundColor: c.bg + 'E6' }]}>
            <Pressable
              onPress={() => {
                player.pause();
                router.push(`/user/${post.uid}`);
              }}
            >
              <Text style={s.text}>@{post.author.username}</Text>
            </Pressable>
            <Text style={s.text} numberOfLines={3}>
              {post.text}
            </Text>
            {post.attachment ? (
              <Button
                quiet
                onPress={() => {
                  player.pause();
                  openAttachment(post.attachment!);
                }}
              >
                {post.attachment.label || 'View music'} ↗
              </Button>
            ) : null}
            <View style={s.row}>
              <Button
                quiet
                onPress={() => {
                  player.pause();
                  router.push(`/post/${post.id}`);
                }}
              >
                Comments · {post.commentCount}
              </Button>
              <Button
                quiet
                onPress={() => {
                  player.pause();
                  router.push(`/post/${post.id}`);
                }}
              >
                More
              </Button>
            </View>
            <View style={s.grid}>
              <Button quiet disabled={busy} onPress={() => void interact('like')}>
                {opinion.liked ? '♥' : '♡'} {opinion.likeCount}
              </Button>
              <Button quiet disabled={busy} onPress={() => void interact('bookmark')}>
                {opinion.bookmarked ? 'Bookmarked' : 'Bookmark'}
              </Button>
              <Button
                quiet
                onPress={() => {
                  player.pause();
                  void Share.share({
                    url: `https://earlyworld-6831c.web.app/post/${post.id}`,
                    message: `https://earlyworld-6831c.web.app/post/${post.id}`,
                  }).catch(() => setMutationError('Could not open sharing.'));
                }}
              >
                Share
              </Button>
            </View>
            <ErrorLine message={mutationError} />
            <Pressable
              accessibilityRole="adjustable"
              accessibilityLabel="Video progress"
              accessibilityValue={{
                min: 0,
                max: Math.round(player.duration || post.media[0]?.duration || 60),
                now: Math.round(currentTime),
              }}
              accessibilityActions={[
                { name: 'increment', label: 'Forward five seconds' },
                { name: 'decrement', label: 'Back five seconds' },
              ]}
              onAccessibilityAction={(e) => {
                player.currentTime = Math.max(
                  0,
                  Math.min(
                    player.duration,
                    player.currentTime + (e.nativeEvent.actionName === 'increment' ? 5 : -5),
                  ),
                );
              }}
              onLayout={(e) => setSeekWidth(e.nativeEvent.layout.width)}
              onPress={(e) => {
                player.currentTime = Math.min(
                  player.duration,
                  Math.max(0, (e.nativeEvent.locationX / seekWidth) * player.duration),
                );
              }}
              style={{ paddingVertical: space[16] }}
            >
              <View style={{ height: 3, backgroundColor: c.line }}>
                <View
                  style={{
                    height: 3,
                    width: `${Math.min(100, (currentTime / Math.max(1, player.duration)) * 100)}%`,
                    backgroundColor: c.accent,
                  }}
                />
              </View>
            </Pressable>
            <Text style={s.muted}>
              {Math.floor(currentTime)} / {Math.round(player.duration || 0)} sec
            </Text>
          </View>
        </View>
      ) : null}
    </>
  );
}
export function VideoFeed({ start }: { start?: string }) {
  const [mode, setMode] = useState('explore'),
    [scene, setScene] = useState(''),
    [height, setHeight] = useState(600),
    [index, setIndex] = useState(0),
    [focused, setFocused] = useState(false),
    [first, setFirst] = useState<SocialPost | null>(null),
    [error, setError] = useState('');
  const foreground = useForeground();
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const posts = usePostPage({ mode, kind: 'video', ...(scene ? { scene } : {}) }, focused);
  useEffect(() => setIndex(0), [mode, scene]);
  useEffect(() => {
    let live = true;
    if (start)
      call<SocialPost>('getPost', { id: start })
        .then((p) => {
          if (live) setFirst(p);
        })
        .catch((e) => {
          if (live) setError(errorMessage(e));
        });
    return () => {
      live = false;
    };
  }, [start]);
  const data = first ? [first, ...posts.data.filter((p) => p.id !== first.id)] : posts.data;
  const viewable = useRef(({ viewableItems }: { viewableItems: ViewToken<SocialPost>[] }) => {
    const visible = viewableItems.find((v) => v.isViewable);
    if (visible?.index != null) setIndex(visible.index);
  }).current;
  return (
    <View style={s.page}>
      <View style={[s.body, { paddingBottom: space[8], gap: space[8] }]}>
        <View style={s.row}>
          {['explore', 'following'].map((value) => (
            <Chip
              key={value}
              label={value === 'explore' ? 'Explore' : 'Following'}
              selected={mode === value}
              onPress={() => {
                setFirst(null);
                setMode(value);
              }}
            />
          ))}
        </View>
        <View style={s.row}>
          <Text style={s.muted}>Scene</Text>
          <Button
            quiet
            onPress={() => {
              const current = SCENES.indexOf(scene as (typeof SCENES)[number]);
              setFirst(null);
              setScene(current === SCENES.length - 1 ? '' : SCENES[current + 1]);
            }}
          >
            {scene || 'All scenes'} ⌄
          </Button>
        </View>
        <ErrorLine message={error || posts.error} />
      </View>
      <View style={{ flex: 1 }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        <FlatList
          key={`${mode}:${scene}:${height}`}
          data={data}
          extraData={`${index}:${focused}:${foreground}`}
          keyExtractor={(p) => p.id}
          renderItem={({ item, index: i }) => (
            <Clip
              post={item}
              height={height}
              active={i === index && focused && foreground}
              preload={i === index + 1 && focused && foreground}
            />
          )}
          pagingEnabled
          snapToInterval={height}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={viewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          onEndReached={() => {
            if (posts.more && !posts.loading) posts.loadMore();
          }}
          ListEmptyComponent={
            !posts.loading ? (
              <View style={s.body}>
                {posts.more ? (
                  <Button quiet onPress={posts.loadMore}>
                    More videos
                  </Button>
                ) : null}
                <Empty
                  title="No videos yet."
                  detail="Approved clips from the community will appear here."
                />
                <Button quiet onPress={posts.refresh}>
                  Refresh
                </Button>
              </View>
            ) : null
          }
        />
      </View>
    </View>
  );
}
