import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  collection,
  doc,
  limit,
  orderBy,
  query,
  updateDoc,
} from '@react-native-firebase/firestore';
import { signOut } from '@react-native-firebase/auth';
import { useCollection, useDocument } from '../data/listeners';
import { useCatalog } from '../data/catalog';
import { auth, db, errorMessage } from '../lib/firebase';
import { useLocal } from '../state/local';
import { follow } from '../data/actions';
import type { Follow, Rotation, Save, User } from '../data/types';
import { Artwork, Button, Empty, ErrorLine, Field, Heading, Page, s, Section } from './ui';
import { EntityCard } from './EntityCard';
import { TrackRow } from './TrackRow';
export function Profile({ uid }: { uid: string }) {
  const currentUid = useLocal((s) => s.uid),
    own = uid === currentUid,
    catalog = useCatalog();
  const [error, setError] = useState<string | null>(null),
    [editing, setEditing] = useState(false),
    [bio, setBio] = useState('');
  const refs = useMemo(
    () => ({
      user: doc(db, 'users', uid),
      rotation: query(collection(db, 'users', uid, 'rotation'), orderBy('score', 'desc')),
      saves: query(collection(db, 'users', uid, 'saves'), orderBy('savedAt', 'desc'), limit(30)),
      follow: currentUid ? doc(db, 'users', currentUid, 'following', uid) : null,
    }),
    [uid, currentUid],
  );
  const user = useDocument<User>(refs.user),
    rotation = useCollection<Rotation>(refs.rotation),
    saves = useCollection<Save>(refs.saves),
    following = useDocument<Follow>(refs.follow);
  const certified = rotation.data.filter((r) => r.tier);
  return (
    <Page>
      <Heading
        eyebrow={own ? 'YOUR LISTENING HISTORY' : 'A LISTENER / LIKE YOU'}
        title={user.data ? `@${user.data.username}` : 'Profile'}
      />
      <View style={s.row}>
        <Artwork uri={user.data?.avatarUrl} name={user.data?.username || 'ew'} size={58} />
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={s.text}>{user.data?.bio || 'Still digging.'}</Text>
          <Text style={s.muted}>
            {user.data?.followerCount || 0} followers · {user.data?.saveCount || 0} saves
          </Text>
        </View>
      </View>
      {!own && currentUid ? (
        <Button
          quiet
          onPress={async () => {
            try {
              await follow(currentUid, uid, 'user', !!following.data);
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        >
          {following.data ? 'Following · unfollow' : 'Follow listener'}
        </Button>
      ) : null}
      <ErrorLine message={error || user.error || rotation.error || saves.error} />
      <Section title="ROTATION / EARNED OVER TIME">
        {certified.length ? (
          <View style={s.grid}>
            {certified.map((r) => (
              <EntityCard
                key={r.id}
                entity={{
                  id: r.entityId,
                  name: r.name,
                  imageUrl: r.imageUrl,
                  aliases: [],
                  trackCount: 0,
                }}
                type={r.entityType}
                rotation={r}
              />
            ))}
          </View>
        ) : (
          <Empty
            title="Your Rotation builds as you listen."
            detail="Go deep. Come back. Your artists and producers earn their place here."
          />
        )}
      </Section>
      <Section title="RECENT SAVES">
        {saves.data.map((save) => {
          const track = catalog.tracks.find((t) => t.id === save.trackId);
          return track ? (
            <TrackRow key={save.id} track={track} />
          ) : (
            <Text key={save.id} style={s.muted}>
              {save.title} / {save.artistName}
            </Text>
          );
        })}
        {!saves.data.length ? <Text style={s.muted}>Nothing saved yet.</Text> : null}
      </Section>
      {own ? (
        <>
          <Button
            quiet
            onPress={() => {
              setEditing(!editing);
              setBio(user.data?.bio || '');
            }}
          >
            Edit bio
          </Button>
          {editing ? (
            <>
              <Field multiline maxLength={160} value={bio} onChangeText={setBio} />
              <Button
                onPress={async () => {
                  try {
                    await updateDoc(refs.user, { bio });
                    setEditing(false);
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
              >
                Save bio
              </Button>
            </>
          ) : null}
          <Button quiet onPress={() => signOut(auth)}>
            Sign out
          </Button>
        </>
      ) : null}
    </Page>
  );
}
