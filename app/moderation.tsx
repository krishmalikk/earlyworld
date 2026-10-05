import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { call, errorMessage } from '../src/lib/firebase';
import { useSocial, useSocialStatus } from '../src/data/social';
import { Artwork, Button, Chip, ErrorLine, Field, Page, s, Section } from '../src/components/ui';
import { PostCard } from '../src/components/PostCard';
import type { SocialPost } from '../shared/social';
import { ModerationVideo } from '../src/components/ModerationVideo';
type Item = {
  id: string;
  kind: string;
  uid: string;
  targetId: string;
  subjectUid?: string;
  reason?: string;
  content:
    | SocialPost
    | {
        body?: string;
        fields?: { bio?: string; avatarUrl?: string; username?: string };
        photo?: { url?: string; status: string };
        status?: string;
      }
    | null;
};
export default function Moderation() {
  const status = useSocialStatus(),
    { version, changed } = useSocial(),
    [reports, setReports] = useState(false),
    [items, setItems] = useState<Item[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    if (status.data?.admin)
      call<{ items: Item[]; cursor: string | null }>('listModeration', { reports })
        .then((p) => {
          if (live) {
            setItems(p.items);
            setCursor(p.cursor);
          }
        })
        .catch((e) => {
          if (live) setError(errorMessage(e));
        });
    return () => {
      live = false;
    };
  }, [reports, version, status.data?.admin]);
  async function act(name: string, data: unknown) {
    setBusy(true);
    setError('');
    try {
      await call(name, data);
      changed();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (!status.data?.admin)
    return (
      <Page>
        <Text style={s.text}>Moderator access required.</Text>
        <ErrorLine message={status.error} />
      </Page>
    );
  return (
    <Page>
      <View style={s.row}>
        <Chip label="Submissions" selected={!reports} onPress={() => setReports(false)} />
        <Chip label="Reports" selected={reports} onPress={() => setReports(true)} />
      </View>
      <ErrorLine message={error} />
      <Field
        placeholder="Rejection reason or report resolution"
        accessibilityLabel="Moderation decision reason"
        value={reason}
        onChangeText={setReason}
        maxLength={500}
        multiline
      />
      {items.map((item) => (
        <Section key={item.id} title={item.kind}>
          {item.content && 'media' in item.content ? (
            <>
              <PostCard post={item.content} />
              {item.content.kind === 'video' && item.content.media[0]?.url ? (
                <ModerationVideo uri={item.content.media[0].url} />
              ) : null}
            </>
          ) : (
            <Text style={s.text}>
              {(item.content && 'body' in item.content ? item.content.body : '') ||
                (item.content && 'fields' in item.content
                  ? [item.content.fields?.username, item.content.fields?.bio]
                      .filter(Boolean)
                      .join(' · ')
                  : '')}
            </Text>
          )}
          {item.content && 'photo' in item.content && item.content.photo?.url ? (
            <Artwork uri={item.content.photo.url} name="Profile photo for review" size={220} />
          ) : null}
          {item.reason ? <Text style={s.muted}>{item.reason}</Text> : null}
          {reports ? (
            <>
              <Text style={s.muted}>
                {item.kind} · {item.targetId}
              </Text>
              <Button
                disabled={busy || !reason.trim()}
                onPress={() => void act('resolveSocialReport', { id: item.id, resolution: reason })}
              >
                Resolve report
              </Button>
              <Button
                quiet
                disabled={busy || !item.subjectUid}
                onPress={() =>
                  void act('suspendSocialAccount', { uid: item.subjectUid, suspended: true })
                }
              >
                Suspend reported account
              </Button>
            </>
          ) : (
            <View style={s.row}>
              <Button
                disabled={busy}
                onPress={() => void act('moderateSocialContent', { id: item.id, approve: true })}
              >
                Approve
              </Button>
              <Button
                quiet
                disabled={busy || !reason.trim()}
                onPress={() =>
                  void act('moderateSocialContent', { id: item.id, approve: false, reason })
                }
              >
                Reject
              </Button>
            </View>
          )}
        </Section>
      ))}
      {!items.length ? <Text style={s.muted}>The queue is clear.</Text> : null}
      {cursor ? (
        <Button
          busy={busy}
          quiet
          onPress={async () => {
            try {
              const p = await call<{ items: Item[]; cursor: string | null }>('listModeration', {
                reports,
                cursor,
              });
              setItems((old) => [...old, ...p.items]);
              setCursor(p.cursor);
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        >
          More submissions
        </Button>
      ) : null}
    </Page>
  );
}
