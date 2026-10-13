import { radius, space } from '../shared/theme';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { doc, updateDoc } from '@react-native-firebase/firestore';
import { useCommunity } from '../src/data/community';
import { useSession } from '../src/data/session';
import { useSocialStatus } from '../src/data/social';
import { pickProfilePhoto, uploadProfilePhoto } from '../src/data/profile-photo';
import { useLocal } from '../src/state/local';
import { call, db, errorMessage } from '../src/lib/firebase';
import type { TextSubmission, User } from '../src/data/types';
import { SCENES } from '../shared/domain';
import { Artwork, Button, c, Chip, ErrorLine, Field, Page, s, Section } from '../src/components/ui';

const sameScenes = (a: string[], b: string[]) =>
  a.length === b.length && a.every((scene) => b.includes(scene));

export default function EditProfile() {
  const uid = useLocal((state) => state.uid),
    { user } = useSession();
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
    [error, setError] = useState<string | null>(null);
  const baselineBio = pending?.fields?.bio ?? user?.bio ?? '';
  useEffect(() => {
    if (user && !submissions.loading && bio === null) {
      setBio(baselineBio);
      setScenes(user.scenes);
    }
  }, [user, submissions.loading, bio, baselineBio]);
  if (!uid || !user || bio === null) return <Page>{null}</Page>;

  const bioChanged = bio.trim() !== baselineBio.trim(),
    scenesChanged = !sameScenes(scenes, user.scenes),
    profileChanged = !!photo || bioChanged;
  const preview = photo || pending?.photoUrl || profile.data[0]?.avatarUrl;
  const photoNote = photo
    ? 'New photo. It goes live when you save.'
    : pending?.photoMediaId
      ? 'Your new photo is processing and appears in a minute or two.'
      : latest?.reason || null;

  async function choosePhoto() {
    setError(null);
    try {
      const uri = await pickProfilePhoto();
      if (uri) setPhoto(uri);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function save() {
    setError(null);
    setBusy(true);
    try {
      if (scenesChanged) await updateDoc(doc(db, 'users', uid!), { scenes });
      if (profileChanged) {
        const photoMediaId = photo
          ? await uploadProfilePhoto(photo)
          : pending?.photoMediaId || undefined;
        await call('submitProfileText', { bio, ...(photoMediaId ? { photoMediaId } : {}) });
      }
      router.back();
      if (photo)
        Alert.alert(
          'Photo processing',
          'Your new photo appears on your profile in a minute or two.',
        );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <Text style={s.muted}>
        Changes appear on your profile as soon as you save. New photos take a minute to process.
      </Text>
      <View style={styles.photo}>
        <View style={styles.avatar}>
          <Artwork uri={preview} name={user.username || 'ew'} size={AVATAR} />
        </View>
        {photoNote ? <Text style={[s.muted, { textAlign: 'center' }]}>{photoNote}</Text> : null}
        {status.data?.uploads ? (
          <Button quiet onPress={choosePhoto}>
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
          value={bio}
          onChangeText={setBio}
        />
        <Text style={s.mono}>{bio.length}/160</Text>
      </Section>
      <Section title="Sounds like">
        <Text style={s.muted}>Choose at least two scenes.</Text>
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
      </Section>
      <ErrorLine message={error || submissions.error || status.error} />
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
