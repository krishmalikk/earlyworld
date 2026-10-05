import { socialEvent } from '../../src/data/social-telemetry';
import { ModerationVideo } from '../../src/components/ModerationVideo';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { putFile, ref as storageRef } from '@react-native-firebase/storage';
import { useLocal } from '../../src/state/local';
import { call, errorMessage, storage } from '../../src/lib/firebase';
import { useSocial, useSocialStatus } from '../../src/data/social';
import {
  clearLocalPostDraft,
  emptyPostDraft,
  keepDraftFile,
  newPostId,
  readPostDraft,
  saveLocalPostDraft,
  type LocalPostDraft,
} from '../../src/data/post-drafts';
import { useCatalogPage } from '../../src/data/catalog';
import type { SocialPost, CatalogAttachment } from '../../shared/social';
import { SOCIAL_LIMITS } from '../../shared/social';
import { SCENES } from '../../shared/domain';
import { space } from '../../shared/theme';
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
} from '../../src/components/ui';
export default function Create() {
  const uid = useLocal((s) => s.uid);
  return uid ? <Composer key={uid} uid={uid} /> : null;
}
function Composer({ uid }: { uid: string }) {
  const { edit } = useLocalSearchParams<{ edit?: string }>(),
    status = useSocialStatus(),
    { changed } = useSocial();
  const [draft, setDraft] = useState<LocalPostDraft>(emptyPostDraft),
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
    persist = useRef(Promise.resolve());
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
        const local = await readPostDraft(uid);
        if (live && local?.id === post.id && !post.publishedAt) {
          setDraft(local);
          return;
        }
        if (live)
          setDraft({
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
              mime: m.kind === 'video' ? 'video/mp4' : 'image/jpeg',
              bytes: 0,
              uploaded: true,
            })),
            rights: true,
            editing: true,
            mediaLocked: !!post.publishedAt,
          });
      } else {
        const saved = await readPostDraft(uid);
        if (live && saved) setDraft(saved);
      }
    })()
      .catch((e) => {
        if (live) setError(errorMessage(e));
      })
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, [uid, edit]);
  useEffect(() => {
    if (!ready) return;
    persist.current = persist.current
      .then(() => saveLocalPostDraft(uid, draft))
      .catch(() => {
        if (alive.current) setError('Could not save this draft on your device.');
      });
  }, [uid, draft, ready]);
  function update(patch: Partial<LocalPostDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }
  async function choose() {
    setError('');
    try {
      const video = draft.kind === 'video';
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: video ? ['videos'] : ['images'],
        allowsMultipleSelection: !video,
        selectionLimit: video ? 1 : 4 - draft.files.length,
        quality: 0.9,
        exif: false,
      });
      if (picked.canceled) return;
      const files = [];
      for (const asset of picked.assets) {
        const info = await FileSystem.getInfoAsync(asset.uri),
          bytes = asset.fileSize || (info.exists ? info.size : 0);
        if (bytes > (video ? SOCIAL_LIMITS.videoBytes : SOCIAL_LIMITS.photoBytes))
          throw Error(video ? 'Choose a video under 150 MB.' : 'Choose photos under 15 MB.');
        if (video && asset.duration != null && (asset.duration < 5000 || asset.duration > 60000))
          throw Error('Choose a video between 5 and 60 seconds.');
        const id = newPostId();
        files.push({
          id,
          uri: await keepDraftFile(uid, asset.uri, id),
          kind: video ? ('video' as const) : ('photo' as const),
          mime: asset.mimeType || (video ? 'video/mp4' : 'image/jpeg'),
          bytes,
        });
      }
      update({ files: video ? files : [...draft.files, ...files].slice(0, 4) });
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function submit() {
    setBusy(true);
    setError('');
    cancelled.current = false;
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
        if (cancelled.current) throw Error('Upload cancelled. Your draft is saved.');
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
        await saveLocalPostDraft(uid, { ...draft, files });
        if (alive.current) update({ files: [...files] });
      }
      if (cancelled.current) throw Error('Submission cancelled. Your draft is saved.');
      await call('savePostDraft', {
        id: draft.id,
        content: {
          ...content,
          mediaIds: draft.mediaLocked ? draft.mediaIds : files.map((f) => f.id),
        },
      });
      const result = await call<{ status: string }>('submitPost', {
        id: draft.id,
        rightsConfirmed: draft.rights,
      });
      await persist.current;
      await clearLocalPostDraft(uid);
      if (alive.current) {
        setDraft(emptyPostDraft());
        setPreview(false);
        changed();
        Alert.alert(
          result.status === 'processing' ? 'Processing your media' : 'Awaiting review',
          'Your submission will appear after moderator approval.',
        );
        router.push({ pathname: '/posts', params: { mode: 'own' } });
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
        <Heading title={draft.editing ? 'Edit your post' : 'What’s on your mind?'} />
        <Text style={s.muted}>Share a find, a take, or a moment from your scene.</Text>
      </View>
      {!draft.mediaLocked ? (
        <View style={s.grid}>
          {(['post', 'video'] as const).map((k) => (
            <Chip
              key={k}
              label={k === 'post' ? 'Post' : 'Video'}
              selected={draft.kind === k}
              onPress={() => {
                if (!busy) update({ kind: k, files: [], mediaIds: [] });
              }}
            />
          ))}
        </View>
      ) : null}
      {!status.data?.eligible || !status.data?.creation ? (
        <View style={s.panel}>
          <Text style={s.text}>
            {status.data?.creation
              ? 'Join the community before publishing.'
              : 'Creation is being prepared. You can save a draft now.'}
          </Text>
          <Button quiet onPress={() => router.push('/community')}>
            Community access
          </Button>
        </View>
      ) : null}
      <ErrorLine message={error || status.error} />
      {preview ? (
        <View style={s.panel}>
          <Text style={s.text}>{draft.text}</Text>
          {draft.files.map((file) =>
            file.kind === 'photo' ? (
              <Artwork key={file.id} uri={file.uri} name="Photo preview" size={220} />
            ) : (
              <ModerationVideo key={file.id} uri={file.uri} />
            ),
          )}
          {draft.attachment ? <Text style={s.link}>{draft.attachment.label}</Text> : null}
          <Text style={s.muted}>
            {draft.files.length} {draft.kind === 'video' ? 'video' : 'photos'} ·{' '}
            {draft.scenes.join(', ')}
          </Text>
        </View>
      ) : (
        <Field
          accessibilityLabel="Post text"
          placeholder={
            draft.kind === 'video' ? 'Add a caption…' : 'What have you been getting into?'
          }
          multiline
          maxLength={1000}
          value={draft.text}
          onChangeText={(text) => update({ text })}
          editable={!busy}
          style={{ minHeight: 140, textAlignVertical: 'top' }}
        />
      )}
      <Text style={s.muted}>{draft.text.length}/1000</Text>
      {!draft.mediaLocked ? (
        <Section title={draft.kind === 'video' ? 'Your clip' : 'Photos'}>
          {draft.kind === 'video' ? <Text style={s.muted}>5–60 seconds · up to 150 MB</Text> : null}
          {draft.files.map((file, i) => (
            <View key={file.id} style={s.panel}>
              {file.kind === 'photo' ? (
                <Artwork uri={file.uri} name={`Photo ${i + 1}`} size={100} />
              ) : (
                <Text style={s.text}>
                  Video selected · {(file.bytes / 1024 / 1024).toFixed(1)} MB
                </Text>
              )}
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
            disabled={busy || (draft.kind === 'post' && draft.files.length >= 4)}
            onPress={() => void choose()}
          >
            {draft.kind === 'video' ? 'Choose video' : 'Add photos'}
          </Button>
        </Section>
      ) : (
        <Text style={s.muted}>
          The published media stays the same. Text and link changes will be reviewed.
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
            {catalog.data.map((item) => (
              <Button
                key={item.id}
                quiet
                onPress={() => {
                  update({
                    attachment: {
                      kind,
                      id: item.id,
                      label: 'title' in item ? item.title : item.name,
                    },
                  });
                  setPicking(false);
                }}
              >
                {'title' in item ? item.title : item.name}
              </Button>
            ))}
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
      <Chip
        label="I have permission to share this content"
        selected={draft.rights}
        onPress={() => {
          if (!busy) update({ rights: !draft.rights });
        }}
      />
      <Button quiet onPress={() => setPreview(!preview)}>
        {preview ? 'Keep editing' : 'Preview post'}
      </Button>
      <Button
        disabled={!ready || !draft.rights || !status.data?.creation || !status.data?.eligible}
        busy={busy}
        busyLabel={progress || 'Submitting'}
        onPress={() => void submit()}
      >
        Submit for review
      </Button>
      {busy ? (
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
