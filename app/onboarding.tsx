import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  where,
} from '@react-native-firebase/firestore';
import { signOut } from '@react-native-firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref as storageRef, putFile, getDownloadURL } from '@react-native-firebase/storage';
import { useSession } from '../src/data/session';
import { useCatalog } from '../src/data/catalog';
import { useCollection } from '../src/data/listeners';
import { useLocal } from '../src/state/local';
import { auth, call, db, errorMessage, storage } from '../src/lib/firebase';
import { reserveUsername } from '../src/data/actions';
import type { Follow, Save } from '../src/data/types';
import { SCENES } from '../shared/domain';
import {
  Artwork,
  Button,
  c,
  Chip,
  Empty,
  ErrorLine,
  Field,
  Heading,
  s,
} from '../src/components/ui';
import { EntityCard } from '../src/components/EntityCard';
import { TrackRow } from '../src/components/TrackRow';
import { Player } from '../src/components/Player';
export default function Onboarding() {
  const { user, loading } = useSession(),
    uid = useLocal((s) => s.uid),
    catalog = useCatalog();
  const step = user?.onboardingStep || 1;
  const [name, setName] = useState(''),
    [availability, setAvailability] = useState(''),
    [bio, setBio] = useState(''),
    [avatar, setAvatar] = useState<string | null>(null),
    [scenes, setScenes] = useState<string[]>([]),
    [artists, setArtists] = useState<string[]>([]),
    [preview, setPreview] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const saveRef = useMemo(() => (uid ? collection(db, 'users', uid, 'saves') : null), [uid]),
    followRef = useMemo(
      () =>
        uid
          ? query(collection(db, 'users', uid, 'following'), where('targetType', '==', 'artist'))
          : null,
      [uid],
    );
  const saves = useCollection<Save>(saveRef),
    follows = useCollection<Follow>(followRef);
  useEffect(() => {
    if (user) {
      setScenes(user.scenes);
      setBio(user.bio);
    }
  }, [user?.id]);
  useEffect(() => {
    setArtists(follows.data.map((f) => f.id));
  }, [follows.data]);
  useEffect(() => {
    if (!uid || !name.match(/^[a-z0-9_]{3,20}$/)) {
      setAvailability('');
      return;
    }
    setAvailability('checking');
    let unsubscribe: (() => void) | undefined;
    const timer = setTimeout(() => {
      unsubscribe = onSnapshot(
        doc(db, 'usernames', name),
        (snap) =>
          setAvailability(snap.exists() && snap.data()?.uid !== uid ? 'taken' : 'available'),
        () => setAvailability('Could not check. Try again.'),
      );
    }, 400);
    return () => {
      clearTimeout(timer);
      unsubscribe?.();
    };
  }, [name, uid]);
  const eligible = catalog.artists
    .filter((a) => (a.scenes || []).some((scene) => scenes.includes(scene)))
    .sort((a, b) => (a.discoveryRank || 0) - (b.discoveryRank || 0));
  const tracks = catalog.tracks
    .filter((t) => artists.includes(t.artistId))
    .sort((a, b) => a.saveCount - b.saveCount)
    .slice(0, 30);
  async function act(work: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await work();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const advance = (next: number, fields: object = {}) =>
    updateDoc(doc(db, 'users', uid!), { onboardingStep: next, ...fields });
  async function photo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled) {
      const resized = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 512 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );
      setAvatar(resized.uri);
    }
  }
  if (loading) return <SafeAreaView style={s.page} />;
  if (!user)
    return (
      <SafeAreaView style={[s.page, s.body]}>
        <Heading eyebrow="ACCOUNT" title="Finish creating your profile." />
        <ErrorLine message={error} />
        <Button
          busy={busy}
          onPress={() =>
            act(async () => {
              if (!uid) return;
              await setDoc(doc(db, 'users', uid), {
                username: '',
                usernameLower: '',
                avatarUrl: '',
                bio: '',
                createdAt: serverTimestamp(),
                saveCount: 0,
                followerCount: 0,
                onboardingComplete: false,
                onboardingStep: 1,
                scenes: [],
              });
            })
          }
        >
          Continue
        </Button>
        <Button quiet onPress={() => signOut(auth)}>
          Sign out
        </Button>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={s.page}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
        <View style={s.between}>
          <Text style={[s.text, { fontWeight: '800' }]}>earlyworld</Text>
          <Text style={s.mono}>{Math.min(step + 1, 6)} / 06</Text>
        </View>
        <View style={{ height: 3, backgroundColor: c.line }}>
          <View
            style={{
              height: 3,
              width: `${Math.min((step + 1) / 6, 1) * 100}%`,
              backgroundColor: c.accent,
            }}
          />
        </View>
        {step === 1 ? (
          <>
            <Heading eyebrow="02 / YOUR HANDLE" title="Make a name." />
            <Text style={s.muted}>Lowercase letters, numbers, underscore. 3–20 characters.</Text>
            <Field
              accessibilityLabel="Username"
              placeholder="your_name"
              value={name}
              onChangeText={(t) => setName(t.toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            <Text style={[s.muted, { color: availability === 'available' ? c.accent : c.muted }]}>
              {availability}
            </Text>
            <Button
              disabled={availability !== 'available'}
              busy={busy}
              onPress={() =>
                act(async () => {
                  await reserveUsername(uid!, name);
                })
              }
            >
              Claim username
            </Button>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <Heading eyebrow="03 / THE DETAILS" title="Put a face to it." />
            <Text style={s.muted}>Or stay low. Both work.</Text>
            <Artwork uri={avatar || user.avatarUrl} name={user.username} size={90} />
            <Button quiet onPress={() => act(photo)}>
              Choose photo
            </Button>
            <Field
              placeholder="A little about you"
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={160}
            />
            <Text style={s.mono}>{bio.length}/160</Text>
            <Button
              busy={busy}
              onPress={() =>
                act(async () => {
                  let avatarUrl = user.avatarUrl;
                  if (avatar) {
                    const ref = storageRef(storage, `avatars/${uid}`);
                    await putFile(ref, avatar, { contentType: 'image/jpeg' });
                    avatarUrl = await getDownloadURL(ref);
                  }
                  await advance(3, { bio, avatarUrl });
                })
              }
            >
              Continue
            </Button>
            <Button
              quiet
              onPress={() =>
                act(async () => {
                  await advance(3);
                })
              }
            >
              Skip photo and bio
            </Button>
          </>
        ) : null}
        {step === 3 ? (
          <>
            <Heading eyebrow="04 / YOUR CORNER" title="Pick your scenes." />
            <Text style={s.muted}>Choose at least two. Nothing outside them is locked.</Text>
            <View style={s.grid}>
              {SCENES.map((scene) => (
                <Chip
                  key={scene}
                  label={scene}
                  selected={scenes.includes(scene)}
                  onPress={() =>
                    setScenes((current) =>
                      current.includes(scene)
                        ? current.filter((x) => x !== scene)
                        : [...current, scene],
                    )
                  }
                />
              ))}
            </View>
            <Button
              disabled={scenes.length < 2}
              busy={busy}
              onPress={() =>
                act(async () => {
                  await advance(4, { scenes });
                })
              }
            >
              Continue · {scenes.length} selected
            </Button>
          </>
        ) : null}
        {step === 4 ? (
          <>
            <Heading eyebrow="05 / ALREADY LISTENING" title="Who are you already on?" />
            <Text style={s.muted}>Follow five or more. Your Rotation builds as you listen.</Text>
            {eligible.length < 5 ? (
              <Empty
                title="The catalog is still filling up."
                detail="Choose additional scenes below to see more artists."
              />
            ) : null}
            <View style={s.grid}>
              {eligible.map((entity) => (
                <EntityCard
                  key={entity.id}
                  entity={entity}
                  type="artist"
                  selected={artists.includes(entity.id)}
                  onPress={() =>
                    setArtists((a) =>
                      a.includes(entity.id) ? a.filter((x) => x !== entity.id) : [...a, entity.id],
                    )
                  }
                />
              ))}
            </View>
            <Text style={s.mono}>Explore more scenes</Text>
            <View style={s.grid}>
              {SCENES.map((scene) => (
                <Chip
                  key={scene}
                  label={scene}
                  selected={scenes.includes(scene)}
                  onPress={() =>
                    setScenes((a) =>
                      a.includes(scene) ? a.filter((x) => x !== scene) : [...a, scene],
                    )
                  }
                />
              ))}
            </View>
            <Button
              disabled={artists.length < 5 || scenes.length < 2}
              busy={busy}
              onPress={() =>
                act(async () => {
                  const batch = writeBatch(db);
                  follows.data
                    .filter((f) => !artists.includes(f.id))
                    .forEach((f) => batch.delete(doc(db, 'users', uid!, 'following', f.id)));
                  artists.forEach((id) => {
                    if (!follows.data.some((f) => f.id === id))
                      batch.set(doc(db, 'users', uid!, 'following', id), {
                        targetId: id,
                        targetType: 'artist',
                        followedAt: serverTimestamp(),
                      });
                  });
                  batch.update(doc(db, 'users', uid!), { onboardingStep: 5, scenes });
                  await batch.commit();
                })
              }
            >
              Continue · {artists.length} selected
            </Button>
          </>
        ) : null}
        {step >= 5 ? (
          <>
            <Heading eyebrow="06 / FIRST CONNECTIONS" title="Save a few." />
            <Text style={s.muted}>Save at least five. Rare overlap finds your people.</Text>
            <Text style={[s.mono, { color: c.accent }]}>{saves.data.length} / 5 SAVED</Text>
            {tracks.map((track, i) => (
              <View key={track.id}>
                <TrackRow track={track} index={i} />
                <Text
                  onPress={() => setPreview(preview === track.id ? null : track.id)}
                  style={[s.link, { paddingVertical: 10 }]}
                >
                  {preview === track.id ? 'Close preview' : 'Preview ↗'}
                </Text>
                {preview === track.id ? <Player track={track} /> : null}
              </View>
            ))}
            {!tracks.length ? (
              <Empty
                title="No tracks loaded."
                detail="Check the catalog seed and your connection."
              />
            ) : null}
            <Button
              disabled={saves.data.length < 5}
              busy={busy}
              onPress={() =>
                act(async () => {
                  await call('completeOnboarding');
                  await call('computeMatches');
                  router.replace('/(tabs)/matches');
                })
              }
            >
              Find my people
            </Button>
          </>
        ) : null}
        <ErrorLine message={error || catalog.error || saves.error} />
        <View style={[s.panel, { marginTop: 10 }]}>
          <Text style={s.mono}>ROTATION / NOT YET CERTIFIED</Text>
          <Text style={s.text}>Your Rotation builds as you listen.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
