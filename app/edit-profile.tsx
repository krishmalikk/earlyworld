import { radius, space } from '../shared/theme';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { doc, updateDoc } from '@react-native-firebase/firestore';
import { useCommunity } from '../src/data/community';
import { useSession } from '../src/data/session';
import { useSocial, useSocialStatus } from '../src/data/social';
import { pickProfilePhoto, uploadProfilePhoto } from '../src/data/profile-photo';
import { useLocal } from '../src/state/local';
import { call, db, errorMessage } from '../src/lib/firebase';
import type { TextSubmission, User } from '../src/data/types';
import { SCENES } from '../shared/domain';
import { Artwork, Button, c, Chip, ErrorLine, Field, Page, s, Section } from '../src/components/ui';

const sameScenes = (a: string[], b: string[]) =>
  a.length === b.length && a.every((scene) => b.includes(scene));

export default function EditProfile() {
  const uid = useLocal((state) => state.uid);
  return <Editor key={uid || 'signed-out'} uid={uid} />;
}
function Editor({ uid }: { uid: string | null }) {
  const session = useSession(),
    { user } = session;
  const { changed } = useSocial(),
    navigation = useNavigation();
  const profile = useCommunity<User>({ kind: 'profile', uid }),
    submissions = useCommunity<TextSubmission>({ kind: 'textSubmissions' }),
    status = useSocialStatus();
  // A profile change waits only while its new photo processes. A new submission
  // replaces it, so edits start from it.
  const latest = submissions.data.find((p) => p.kind === 'profile'),
    pending = latest?.status === 'pending' ? latest : undefined;
  const [bio, setBio] = useState<string | null>(null),
    [scenes, setScenes] = useState<string[]>([]),
    [photo, setPhoto] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null),
    [saved, setSaved] = useState(false);
  const baselineBio = pending?.fields?.bio ?? user?.bio ?? '';
  useEffect(() => {
    if (user && !submissions.loading && !submissions.error && bio === null) {
      setBio(baselineBio);
      setScenes(user.scenes);
    }
  }, [user, submissions.loading, submissions.error, bio, baselineBio]);
  const bioChanged = bio !== null && bio.trim() !== baselineBio.trim(),
    scenesChanged = bio !== null && !!user && !sameScenes(scenes, user.scenes),
    profileChanged = !!photo || bioChanged;
  usePreventRemove(
    !!uid && bio !== null && !saved && (busy || profileChanged || scenesChanged),
    ({ data }) => {
      if (busy) {
        Alert.alert('Saving changes', 'Wait for this save to finish before leaving.');
        return;
      }
      Alert.alert(
        'Discard changes?',
        'Your unsaved bio, scenes and photo selection will be lost.',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(data.action),
          },
        ],
      );
    },
  );
  useEffect(() => {
    if (saved) router.back();
  }, [saved]);
  if (!uid || !user || bio === null) {
    const initialError = session.error || submissions.error;
    const loading = session.loading || submissions.loading;
    return (
      <Page>
        {loading && !initialError ? (
          <>
            <ActivityIndicator color={c.accent} accessibilityLabel="Loading profile" />
            <Text style={s.muted}>Loading your profile…</Text>
          </>
        ) : (
          <>
            <ErrorLine message={initialError || 'Your profile could not be loaded.'} />
            <Button
              onPress={() => {
                session.retry();
                changed();
              }}
            >
              Retry
            </Button>
          </>
        )}
        <Button quiet onPress={() => router.back()}>
          Back
        </Button>
      </Page>
    );
  }
  const preview = photo || pending?.photoUrl || profile.data[0]?.avatarUrl;
  const photoNote = photo
    ? 'New photo. It will appear after processing.'
    : pending?.photoMediaId
      ? 'Your new photo is processing. Your current photo stays visible until it is ready.'
      : latest?.reason || null;

  async function choosePhoto() {
    setError(null);
    try {
      const uri = await pickProfilePhoto();
      if (uri) {
        setPhoto(uri);
        setUploadedPhoto(null);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function save() {
    setError(null);
    setBusy(true);
    let scenesSaved = false;
    try {
      if (scenesChanged) {
        await updateDoc(doc(db, 'users', uid!), { scenes });
        scenesSaved = true;
      }
      if (profileChanged) {
        const photoMediaId = photo
          ? uploadedPhoto || (await uploadProfilePhoto(photo))
          : pending?.photoMediaId || undefined;
        if (photo && photoMediaId) setUploadedPhoto(photoMediaId);
        await call('submitProfileText', { bio, ...(photoMediaId ? { photoMediaId } : {}) });
      }
      changed();
      setSaved(true);
      if (photo)
        Alert.alert(
          'Photo processing',
          'Your changes were saved. Your new photo will appear after processing; you can check its status on your profile.',
        );
    } catch (e) {
      setError(
        `${scenesSaved ? 'Your scenes were saved, but your bio/photo was not. ' : ''}${errorMessage(e)} Your edits are still here; try saving again.`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <Text style={s.muted}>
        Your bio and scenes update when you save. New photos appear after processing.
      </Text>
      <View style={styles.photo}>
        <View style={styles.avatar}>
          <Artwork uri={preview} name={user.username || 'ew'} size={AVATAR} />
        </View>
        {photoNote ? <Text style={[s.muted, { textAlign: 'center' }]}>{photoNote}</Text> : null}
        {status.data?.uploads ? (
          <Button quiet disabled={busy} onPress={choosePhoto}>
            {photo || pending?.photoMediaId ? 'Choose another photo' : 'Change photo'}
          </Button>
        ) : status.data ? (
          <Text style={[s.muted, { textAlign: 'center' }]}>
            Photo changes open when community uploads are enabled.
          </Text>
        ) : null}
      </View>
      <Section title="Bio">
        <Field
          accessibilityLabel="Profile bio"
          placeholder="A little about you"
          multiline
          maxLength={160}
          editable={!busy}
          value={bio}
          onChangeText={setBio}
        />
        <Text style={s.mono}>{bio.length}/160</Text>
      </Section>
      <Section title="Sounds like">
        <Text style={s.muted}>Choose 2–12 scenes.</Text>
        <View style={s.grid}>
          {SCENES.map((scene) => (
            <Chip
              key={scene}
              label={scene}
              selected={scenes.includes(scene)}
              onPress={() => {
                if (busy) return;
                setScenes((current) =>
                  current.includes(scene)
                    ? current.filter((x) => x !== scene)
                    : current.length < 12
                      ? [...current, scene]
                      : current,
                );
              }}
            />
          ))}
        </View>
      </Section>
      <ErrorLine
        message={error || profile.error || submissions.error || status.error || session.error}
      />
      {profile.error || submissions.error || status.error || session.error ? (
        <Button
          quiet
          onPress={() => {
            session.retry();
            changed();
          }}
        >
          Retry loading profile
        </Button>
      ) : null}
      <Button
        disabled={!(profileChanged || scenesChanged) || scenes.length < 2}
        busy={busy}
        busyLabel="Saving…"
        onPress={save}
      >
        Save changes
      </Button>
    </Page>
  );
}
const AVATAR = 112;
const styles = StyleSheet.create({
  photo: { alignItems: 'center', gap: space[12] },
  avatar: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: c.accent,
  },
});
