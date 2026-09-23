import React, { useMemo, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  collection,
  deleteDoc,
  doc,
  limit,
  orderBy,
  query,
} from '@react-native-firebase/firestore';
import { db, errorMessage } from '../../src/lib/firebase';
import { useCollection, useDocument } from '../../src/data/listeners';
import { useLocal } from '../../src/state/local';
import { comment } from '../../src/data/actions';
import type { Stamp, Track } from '../../src/data/types';
import {
  Artwork,
  Button,
  c,
  Empty,
  ErrorLine,
  Field,
  Heading,
  Page,
  s,
  Section,
} from '../../src/components/ui';
import { SaveButton } from '../../src/components/TrackRow';
import { Player } from '../../src/components/Player';
import { UserLine } from '../../src/components/UserLine';
export default function TrackDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    uid = useLocal((s) => s.uid);
  const [body, setBody] = useState(''),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const refs = useMemo(
    () => ({
      track: doc(db, 'tracks', id),
      comments: query(
        collection(db, 'tracks', id, 'comments'),
        orderBy('createdAt', 'desc'),
        limit(50),
      ),
    }),
    [id],
  );
  const { data: track, loading, error: trackError } = useDocument<Track>(refs.track),
    comments = useCollection<{ id: string; uid: string; body: string; createdAt: Stamp }>(
      refs.comments,
    );
  if (!track)
    return (
      <Page>
        <ErrorLine message={trackError} />
        <Empty title={loading ? 'Opening track…' : 'This track is no longer in the catalog.'} />
      </Page>
    );
  async function send() {
    if (!uid || !body.trim()) return;
    setBusy(true);
    try {
      await comment(uid, id, body);
      setBody('');
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading eyebrow={`${track.sourcePlatform} / PUBLIC RELEASE`} title={track.title} />
      <View style={s.row}>
        <Artwork uri={track.artworkUrl} name={track.title} size={64} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text
            style={s.text}
            onPress={() =>
              router.push({
                pathname: '/entity/[id]',
                params: { id: track.artistId, type: 'artist' },
              })
            }
          >
            {track.artistName} ↗
          </Text>
          <Text style={s.mono}>{track.saveCount} saves</Text>
        </View>
        <SaveButton track={track} />
      </View>
      <View style={[s.panel, { borderLeftWidth: 3, borderLeftColor: c.accent }]}>
        <Text style={s.mono}>PRODUCED BY</Text>
        {track.producerId ? (
          <Text
            onPress={() =>
              router.push({
                pathname: '/entity/[id]',
                params: { id: track.producerId!, type: 'producer' },
              })
            }
            style={[s.text, { fontWeight: '700', color: c.accent }]}
          >
            {track.producerName} ↗
          </Text>
        ) : (
          <Text style={s.muted}>Not credited yet.</Text>
        )}
      </View>
      <Player key={id} track={track} />
      {track.geniusStatus === 'matched' && track.credits ? (
        <Section title="CREDITS">
          <View style={s.panel}>
            {track.credits.producers.length ? (
              <Text style={s.text}>Producers / {track.credits.producers.join(', ')}</Text>
            ) : null}
            {track.credits.writers.length ? (
              <Text style={s.text}>Writers / {track.credits.writers.join(', ')}</Text>
            ) : null}
            {track.credits.performances.map((p, i) => (
              <Text key={i} style={s.text}>
                {p.role} / {p.artists.join(', ')}
              </Text>
            ))}
            {track.credits.album ? (
              <Text style={s.muted}>Album / {track.credits.album}</Text>
            ) : null}
            {track.credits.releaseDate ? (
              <Text style={s.muted}>Released / {track.credits.releaseDate}</Text>
            ) : null}
            {track.geniusUrl ? (
              <Text style={s.link} onPress={() => Linking.openURL(track.geniusUrl!)}>
                via Genius ↗
              </Text>
            ) : null}
          </View>
        </Section>
      ) : null}
      <Section title="SAVED BY">
        {track.savers.slice(0, 20).map((saver) => (
          <UserLine key={saver} uid={saver} />
        ))}
        {!track.savers.length ? <Text style={s.muted}>Be the first here.</Text> : null}
        {track.savers.length > 20 ? (
          <Text style={s.muted}>+ {track.savers.length - 20} more in the early listener list</Text>
        ) : null}
        {track.saversCapped ? (
          <Text style={s.muted}>
            Showing early listeners. This track has grown beyond rare matching.
          </Text>
        ) : null}
      </Section>
      <Section title={`DISCUSSION / ${comments.data.length}`}>
        <Field
          placeholder="Leave a note"
          value={body}
          onChangeText={setBody}
          maxLength={1000}
          multiline
        />
        <Button disabled={!body.trim()} busy={busy} onPress={send}>
          Post comment
        </Button>
        <ErrorLine message={error || comments.error} />
        {comments.data.map((item) => (
          <View key={item.id} style={s.panel}>
            <UserLine uid={item.uid} />
            <Text style={s.text}>{item.body}</Text>
            {item.uid === uid ? (
              <Text
                style={s.link}
                onPress={async () => {
                  try {
                    await deleteDoc(doc(db, 'tracks', id, 'comments', item.id));
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
              >
                Delete your comment
              </Text>
            ) : null}
          </View>
        ))}
      </Section>
    </Page>
  );
}
