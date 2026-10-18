import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { call, errorMessage } from '../../src/lib/firebase';
import { useLocal } from '../../src/state/local';
import { useSocial } from '../../src/data/social';
import type { SocialPost, SocialComment } from '../../shared/social';
import { useForeground } from '../../src/data/listeners';
import { newPostId } from '../../src/data/post-composer';
import { PostCard } from '../../src/components/PostCard';
import { Button, c, ErrorLine, Field, Page, s, Section } from '../../src/components/ui';
export default function PostDetail() {
  const { id, own } = useLocalSearchParams<{ id: string; own?: string }>();
  const uid = useLocal((s) => s.uid);
  return <Detail key={`${uid}:${id}`} id={id} own={own === 'true'} />;
}
function Detail({ id, own }: { id: string; own: boolean }) {
  const uid = useLocal((s) => s.uid),
    { version, changed } = useSocial();
  const [post, setPost] = useState<SocialPost | null>(null),
    [comments, setComments] = useState<SocialComment[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [body, setBody] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0);
  const active = useForeground();
  useFocusEffect(
    useCallback(() => {
      setReload((n) => n + 1);
    }, [id, own]),
  );
  const requestId = useRef(newPostId()),
    generation = useRef(0);
  useEffect(() => {
    const run = ++generation.current;
    setError('');
    if (!active) return;
    setLoading(true);
    (async () => {
      let p = await call<SocialPost>('getPost', { id, own });
      // The private revision has no public counters. Switch to the public record once live.
      if (own && p.status === 'published') p = await call<SocialPost>('getPost', { id });
      if (generation.current !== run) return;
      setPost(p);
      if (p.status !== 'published') {
        setComments([]);
        setCursor(null);
        return;
      }
      const c = await call<{ items: SocialComment[]; cursor: string | null }>('listPostComments', {
        postId: id,
      });
      if (generation.current === run) {
        setComments(c.items);
        setCursor(c.cursor);
      }
    })()
      .catch((e) => {
        if (generation.current === run) {
          setError(errorMessage(e));
          if (/not-found|permission-denied/.test(String(e?.code))) {
            setPost(null);
            setComments([]);
          }
        }
      })
      .finally(() => {
        if (generation.current === run) setLoading(false);
      });
    return () => {
      generation.current++;
    };
  }, [id, own, version, reload, active]);
  async function submit() {
    setBusy(true);
    setError('');
    try {
      await call('createPostComment', { postId: id, body, requestId: requestId.current });
      setBody('');
      requestId.current = newPostId();
      changed();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <ErrorLine message={error} />
      {error ? (
        <Button quiet busy={loading} onPress={() => setReload((n) => n + 1)}>
          Retry
        </Button>
      ) : null}
      {loading && !post ? (
        <ActivityIndicator color={c.accent} accessibilityLabel="Loading post" />
      ) : null}
      {post ? (
        <>
          <PostCard post={post} detail />
          {own && post.status === 'published' ? (
            <Text accessibilityLiveRegion="polite" style={s.link}>
              Published
            </Text>
          ) : null}
          {post.status !== 'published' ? (
            <View style={s.panel}>
              <Text accessibilityLiveRegion="polite" style={s.text}>
                {post.status === 'processing'
                  ? 'Your photos are processing. You can leave this screen; find this post on your profile.'
                  : post.status === 'pending'
                    ? 'Your post is waiting to publish.'
                    : 'Your post hasn’t been published. Edit it to fix the problem and try again.'}
              </Text>
              <Button quiet busy={loading} onPress={() => setReload((n) => n + 1)}>
                Refresh status
              </Button>
              {post.status === 'draft' || post.status === 'rejected' ? (
                <Button
                  onPress={() => router.push({ pathname: '/(tabs)/create', params: { edit: id } })}
                >
                  Edit & retry
                </Button>
              ) : null}
            </View>
          ) : (
            <Section title="Comments">
              {comments.map((c) => (
                <View key={c.id} style={s.panel}>
                  <Text style={s.text}>@{c.author.username}</Text>
                  <Text style={s.text}>{c.body}</Text>
                  {c.status !== 'approved' ? (
                    <Text style={s.muted}>
                      {c.status === 'pending' ? 'Posting…' : c.reason || 'Not posted'}
                    </Text>
                  ) : null}
                  {c.uid === uid ? (
                    <Button
                      quiet
                      onPress={() =>
                        Alert.alert('Delete comment?', undefined, [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () =>
                              void call('deleteSocialContent', { kind: 'comment', id: c.id })
                                .then(changed)
                                .catch((e) => setError(errorMessage(e))),
                          },
                        ])
                      }
                    >
                      Delete
                    </Button>
                  ) : (
                    <Button
                      quiet
                      onPress={() =>
                        router.push({
                          pathname: '/community',
                          params: { reportKind: 'comment', reportId: c.id },
                        })
                      }
                    >
                      Report
                    </Button>
                  )}
                </View>
              ))}
              {cursor ? (
                <Button
                  quiet
                  onPress={async () => {
                    const run = generation.current;
                    try {
                      const next = await call<{ items: SocialComment[]; cursor: string | null }>(
                        'listPostComments',
                        { postId: id, cursor },
                      );
                      if (generation.current === run) {
                        setComments((old) => [
                          ...new Map([...old, ...next.items].map((c) => [c.id, c])).values(),
                        ]);
                        setCursor(next.cursor);
                      }
                    } catch (e) {
                      setError(errorMessage(e));
                    }
                  }}
                >
                  More comments
                </Button>
              ) : null}
              <Field
                accessibilityLabel="Comment"
                value={body}
                onChangeText={(text) => {
                  setBody(text);
                  requestId.current = newPostId();
                }}
                maxLength={1000}
                multiline
                placeholder="Add to the conversation…"
              />

              <Button busy={busy} disabled={!body.trim()} onPress={() => void submit()}>
                Submit comment
              </Button>
            </Section>
          )}
        </>
      ) : null}
    </Page>
  );
}
