import { socialEvent } from '../../../src/data/social-telemetry';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, router } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { putFile, ref as storageRef } from '@react-native-firebase/storage';
import { useLocal } from '../../../src/state/local';
import { call, errorMessage, storage } from '../../../src/lib/firebase';
import { useSocial, useSocialStatus } from '../../../src/data/social';
import {
  clearComposerFiles,
  emptyPost,
  keepComposerFile,
  newPostId,
  type ComposerPost,
} from '../../../src/data/post-composer';
import { useCatalogPage } from '../../../src/data/catalog';
import { PostAttachment } from '../../../src/components/PostAttachment';
import { TrackRow } from '../../../src/components/TrackRow';
import { ReleaseCard } from '../../../src/components/Releases';
import { EntityCard } from '../../../src/components/EntityCard';
import type { Entity, Release, Track } from '../../../src/data/types';
import type { SocialPost, CatalogAttachment } from '../../../shared/social';
import { SOCIAL_LIMITS } from '../../../shared/social';
import { SCENES } from '../../../shared/domain';
import { space } from '../../../shared/theme';
import {
  Artwork,
  Button,
  Chip,
  ErrorLine,
  Field,
  Heading,
  Page,
  s,
  Section,
} from '../../../src/components/ui';
export default function Create() {
  const uid = useLocal((s) => s.uid);
  return uid ? <Composer key={uid} uid={uid} /> : null;
}
function compositionKey(post: ComposerPost) {
  return JSON.stringify([
    post.text,
    post.scenes,
    post.attachment,
    post.files.map((file) => file.id),
  ]);
}
function Composer({ uid }: { uid: string }) {
  const navigation = useNavigation();
  const { edit, cardUri, cardTrackId, cardTrackTitle } = useLocalSearchParams<{
      edit?: string;
      cardUri?: string;
      cardTrackId?: string;
      cardTrackTitle?: string;
    }>(),
    status = useSocialStatus(),
    { changed } = useSocial();
  const [draft, setDraft] = useState<ComposerPost>(emptyPost),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [progress, setProgress] = useState(''),
    [preview, setPreview] = useState(false),
    [search, setSearch] = useState(''),
    [kind, setKind] = useState<CatalogAttachment['kind']>('track'),
    [picking, setPicking] = useState(false);
  const task = useRef<ReturnType<typeof putFile> | null>(null),
    alive = useRef(true),
    cancelled = useRef(false),
    baseline = useRef(compositionKey(draft));
  usePreventRemove(ready && compositionKey(draft) !== baseline.current, ({ data }) => {
    if (busy) {
      Alert.alert(
        'Upload in progress',
        'Wait for submission to finish, or cancel the upload first.',
      );
      return;
    }
    Alert.alert('Discard post changes?', 'This composition is only kept while the app is open.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });
  const collection = {
    track: 'tracks',
    release: 'releases',
    artist: 'artists',
    producer: 'producers',
  } as const;
  const catalog = useCatalogPage(collection[kind], { text: search, enabled: picking });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancelled.current = true;
      void task.current?.cancel();
    };
  }, []);
  useEffect(() => {
    let live = true;
    setReady(false);
    (async () => {
      if (edit) {
        const post = await call<SocialPost>('getPost', { id: edit, own: true });
        if (post.uid !== uid) throw Error('This is not your post.');
        if (live) {
          const loaded: ComposerPost = {
            id: post.id,
            kind: post.kind,
            text: post.text,
            scenes: post.scenes,
            attachment: post.attachment,
            mediaIds: post.mediaIds,
            files: post.media.map((m) => ({
              id: m.id,
              uri: m.url || m.thumbnailUrl || '',
              kind: m.kind,
              mime: 'image/jpeg',
              bytes: 0,
              uploaded: true,
            })),
            editing: true,
            mediaLocked: !!post.publishedAt,
          };
          baseline.current = compositionKey(loaded);
          setDraft(loaded);
        }
      }
      if (live) setReady(true);
    })().catch((e) => {
      if (live) setError(errorMessage(e));
    });
    return () => {
      live = false;
    };
  }, [uid, edit]);
  // A share card arrives as a captured image; it starts a fresh post with the card attached.
  useEffect(() => {
    if (!cardUri) return;
    const start = async () => {
      try {
        const info = await FileSystem.getInfoAsync(cardUri);
        if (!info.exists) throw Error('The card image is no longer available. Try again.');
        const id = newPostId();
        setDraft({
          ...emptyPost(),
          files: [
            {
              id,
              uri: await keepComposerFile(cardUri, id),
              kind: 'photo',
              mime: 'image/png',
              bytes: info.size,
            },
          ],
          attachment: cardTrackId
            ? { kind: 'track', id: cardTrackId, label: cardTrackTitle || 'Track' }
            : null,
        });
        setPreview(false);
      } catch (e) {
        setError(errorMessage(e));
      }
    };
    const consume = () => router.setParams({ cardUri: '', cardTrackId: '', cardTrackTitle: '' });
    const writing = draft.text.trim() || draft.files.length || draft.attachment;
    if (writing && !draft.editing)
      Alert.alert('Replace what you’re writing?', 'Posting this card starts a new post.', [
        { text: 'Keep writing', style: 'cancel', onPress: consume },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () => {
            consume();
            void start();
          },
        },
      ]);
    else {
      consume();
      void start();
    }
  }, [cardUri]);
  function update(patch: Partial<ComposerPost>) {
    setDraft((d) => ({ ...d, ...patch }));
  }
  async function choose() {
    setError('');
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: SOCIAL_LIMITS.photos - draft.files.length,
        quality: 0.9,
        exif: false,
      });
      if (picked.canceled) return;
      const files = [];
      for (const asset of picked.assets) {
        const info = await FileSystem.getInfoAsync(asset.uri),
          bytes = asset.fileSize || (info.exists ? info.size : 0);
        if (bytes > SOCIAL_LIMITS.photoBytes) throw Error('Choose photos under 15 MB.');
        const id = newPostId();
        files.push({
          id,
          uri: await keepComposerFile(asset.uri, id),
          kind: 'photo' as const,
          mime: asset.mimeType || 'image/jpeg',
          bytes,
        });
      }
      update({ files: [...draft.files, ...files].slice(0, SOCIAL_LIMITS.photos) });
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function submit() {
    setBusy(true);
    setError('');
    cancelled.current = false;
    setProgress('Saving your post…');
    try {
      const content = {
        kind: draft.kind,
        text: draft.text,
        attachment: draft.attachment,
        scenes: draft.scenes,
        mediaIds: draft.editing
          ? draft.mediaIds
          : draft.files.filter((f) => f.uploaded).map((f) => f.id),
      };
      await call('savePostDraft', { id: draft.id, content });
      const files = [...draft.files];
      for (let i = 0; i < files.length; i++) {
        if (cancelled.current) throw Error('Upload cancelled.');
        const file = files[i];
        if (file.uploaded) continue;
        const ticket = await call<{ path: string; status: string }>('authorizePostUpload', {
          postId: draft.id,
          id: file.id,
          kind: file.kind,
          mime: file.mime,
          bytes: file.bytes,
        });
        if (ticket.status === 'failed')
          throw Error('This file could not be processed. Remove it and choose another.');
        if (ticket.status === 'authorized') {
          task.current = putFile(storageRef(storage, ticket.path), file.uri, {
            contentType: file.mime,
          });
          const detach = task.current.on('state_changed', (snap) => {
            if (alive.current)
              setProgress(
                `Uploading ${i + 1}/${files.length} · ${Math.round((snap.bytesTransferred / Math.max(1, snap.totalBytes)) * 100)}%`,
              );
          });
          try {
            await task.current;
          } finally {
            detach();
            task.current = null;
          }
        }
        await call('completePostUpload', { id: file.id });
        socialEvent('social_upload_complete');
        files[i] = { ...file, uploaded: true };
        if (alive.current) update({ files: [...files] });
      }
      if (cancelled.current) throw Error('Submission cancelled.');
      await call('savePostDraft', {
        id: draft.id,
        content: {
          ...content,
          mediaIds: draft.mediaLocked ? draft.mediaIds : files.map((f) => f.id),
        },
      });
      setProgress('Finishing submission…');
      await call<{ status: string }>('submitPost', {
        id: draft.id,
      });
      await clearComposerFiles().catch(() => undefined);
      if (alive.current) {
        const next = emptyPost();
        baseline.current = compositionKey(next);
        setDraft(next);
        setPreview(false);
        changed();
        router.setParams({ edit: '' });
        router.push({ pathname: '/post/[id]', params: { id: draft.id, own: 'true' } });
      }
    } catch (e) {
      if (alive.current) setError(errorMessage(e));
      socialEvent('social_upload_failed');
    } finally {
      if (alive.current) {
        setBusy(false);
        setProgress('');
      }
    }
  }
  return (
    <Page>
      <View style={[s.panel, { gap: space[6] }]}>
        <Heading display title={draft.editing ? 'Edit your post' : 'What’s on your mind?'} />
        <Text style={s.muted}>Share a find, a take, or a moment from your scene.</Text>
      </View>
      <ErrorLine message={error || status.error} />
      {!ready && error ? (
        <Button quiet onPress={() => router.back()}>
          Back to post
        </Button>
      ) : null}
      {preview ? (
        <View style={s.panel}>
          <Text style={s.text}>{draft.text}</Text>
          {draft.files.map((file) => (
            <Artwork key={file.id} uri={file.uri} name="Photo preview" size={220} />
          ))}
          {draft.attachment ? <PostAttachment attachment={draft.attachment} /> : null}
          <Text style={s.muted}>
            {draft.files.length} photos · {draft.scenes.join(', ')}
          </Text>
        </View>
      ) : (
        <Field
          accessibilityLabel="Post text"
          placeholder="What have you been getting into?"
          multiline
          maxLength={1000}
          value={draft.text}
          onChangeText={(text) => update({ text })}
          editable={!busy}
          style={{ minHeight: 140, textAlignVertical: 'top' }}
        />
      )}
      <Text style={s.muted}>{draft.text.length}/1000</Text>
      <Text style={s.muted}>
        Unsent posts stay here while the app is open. Closing the app may discard them.
      </Text>
      {!draft.mediaLocked ? (
        <Section title="Photos">
          {draft.files.map((file, i) => (
            <View key={file.id} style={s.panel}>
              <Artwork uri={file.uri} name={`Photo ${i + 1}`} size={100} />
              <View style={s.row}>
                <Button
                  quiet
                  disabled={busy || i === 0}
                  onPress={() => {
                    const files = [...draft.files];
                    [files[i - 1], files[i]] = [files[i], files[i - 1]];
                    update({ files });
                  }}
                >
                  Move earlier
                </Button>
                <Button
                  quiet
                  disabled={busy}
                  onPress={() => update({ files: draft.files.filter((f) => f.id !== file.id) })}
                >
                  Remove
                </Button>
              </View>
            </View>
          ))}
          <Button
            quiet
            disabled={busy || draft.files.length >= SOCIAL_LIMITS.photos}
            onPress={() => void choose()}
          >
            Add photos
          </Button>
        </Section>
      ) : (
        <Text style={s.muted}>
          The published media stays the same. You can change the text, link and scenes.
        </Text>
      )}
      <Section title="Link to music">
        <Button quiet disabled={busy} onPress={() => setPicking(!picking)}>
          {draft.attachment?.label || 'Choose a track, release, artist, or producer'}
        </Button>
        {draft.attachment ? (
          <Button quiet disabled={busy} onPress={() => update({ attachment: null })}>
            Remove link
          </Button>
        ) : null}
        {picking ? (
          <>
            <View style={s.grid}>
              {(['track', 'release', 'artist', 'producer'] as const).map((k) => (
                <Chip key={k} label={k} selected={kind === k} onPress={() => setKind(k)} />
              ))}
            </View>
            <Field
              accessibilityLabel="Search music attachment"
              value={search}
              onChangeText={setSearch}
              placeholder="Search catalog"
            />
            <ErrorLine message={catalog.error} />
            {(() => {
              const choose = (item: { id: string }, label: string) => {
                update({ attachment: { kind, id: item.id, label } });
                setPicking(false);
              };
              if (kind === 'track')
                return (catalog.data as Track[]).map((item) => (
                  <TrackRow
                    key={item.id}
                    track={item}
                    variant="card"
                    showOwnRating={false}
                    selected={draft.attachment?.id === item.id}
                    onSelect={() => choose(item, item.title)}
                  />
                ));
              if (kind === 'release')
                return (catalog.data as Release[]).map((item) => (
                  <ReleaseCard
                    key={item.id}
                    release={item}
                    selected={draft.attachment?.id === item.id}
                    onSelect={() => choose(item, item.title)}
                  />
                ));
              return (
                <View style={s.grid}>
                  {(catalog.data as Entity[]).map((item) => (
                    <EntityCard
                      key={item.id}
                      entity={item}
                      type={kind}
                      selected={draft.attachment?.id === item.id}
                      onPress={() => choose(item, item.name)}
                    />
                  ))}
                </View>
              );
            })()}
            {catalog.hasMore ? (
              <Button quiet onPress={catalog.loadMore}>
                More results
              </Button>
            ) : null}
          </>
        ) : null}
      </Section>
      <Section title="Scenes">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space[8] }}
        >
          {SCENES.map((scene) => (
            <Chip
              key={scene}
              label={scene}
              selected={draft.scenes.includes(scene)}
              onPress={() => {
                if (!busy)
                  update({
                    scenes: draft.scenes.includes(scene)
                      ? draft.scenes.filter((s) => s !== scene)
                      : draft.scenes.length < 3
                        ? [...draft.scenes, scene]
                        : draft.scenes,
                  });
              }}
            />
          ))}
        </ScrollView>
      </Section>
      <Button quiet onPress={() => setPreview(!preview)}>
        {preview ? 'Keep editing' : 'Preview post'}
      </Button>
      <Button
        disabled={!ready}
        busy={busy}
        busyLabel={progress || 'Submitting'}
        onPress={() => void submit()}
      >
        Post
      </Button>
      {busy && progress.startsWith('Uploading') ? (
        <Button
          quiet
          onPress={() => {
            cancelled.current = true;
            void task.current?.cancel();
          }}
        >
          Cancel upload
        </Button>
      ) : null}
    </Page>
  );
}
