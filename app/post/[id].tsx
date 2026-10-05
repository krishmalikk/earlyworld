import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { call, errorMessage } from '../../src/lib/firebase';
import { useLocal } from '../../src/state/local';
import { useSocial } from '../../src/data/social';
import type { SocialPost, SocialComment } from '../../shared/social';
import { newPostId } from '../../src/data/post-drafts';
import { PostCard } from '../../src/components/PostCard';
import { Button, ErrorLine, Field, Page, s, Section } from '../../src/components/ui';
export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = useLocal((s) => s.uid);
  return <Detail key={`${uid}:${id}`} id={id} />;
}
function Detail({ id }: { id: string }) {
  const uid = useLocal((s) => s.uid),
    { version, changed } = useSocial();
  const [post, setPost] = useState<SocialPost | null>(null),
    [comments, setComments] = useState<SocialComment[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [body, setBody] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const requestId = useRef(newPostId()),
    generation = useRef(0);
  useEffect(() => {
    const run = ++generation.current;
    setError('');
    Promise.all([
      call<SocialPost>('getPost', { id }),
      call<{ items: SocialComment[]; cursor: string | null }>('listPostComments', { postId: id }),
    ])
      .then(([p, c]) => {
        if (generation.current === run) {
          setPost(p);
          setComments(c.items);
          setCursor(c.cursor);
        }
      })
      .catch((e) => {
        if (generation.current === run) {
          setError(errorMessage(e));
          if (/not-found|permission-denied/.test(String(e?.code))) {setPost(null);setComments([]);}
        }
      });
    return () => {
      generation.current++;
    };
  }, [id, version]);
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
      {post ? (
        <>
          <PostCard post={post} detail />
          <Section title="Comments">
            {comments.map((c) => (
              <View key={c.id} style={s.panel}>
                <Text style={s.text}>@{c.author.username}</Text>
                <Text style={s.text}>{c.body}</Text>
                {c.status !== 'approved' ? (
                  <Text style={s.muted}>
                    {c.status === 'pending' ? 'Awaiting review' : c.reason || 'Not approved'}
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
            <Text style={s.muted}>Comments appear after review.</Text>
            <Button busy={busy} disabled={!body.trim()} onPress={() => void submit()}>
              Submit comment
            </Button>
          </Section>
        </>
      ) : null}
    </Page>
  );
}
