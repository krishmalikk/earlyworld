import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { doc } from '@react-native-firebase/firestore';
import { space } from '../../shared/theme';
import { MESSAGE_LIMITS } from '../../shared/messages';
import { db, errorMessage } from '../../src/lib/firebase';
import { useLocal } from '../../src/state/local';
import { useDocument } from '../../src/data/listeners';
import { useCatalogIds } from '../../src/data/catalog';
import { addMembers, openConversation, sendShared } from '../../src/data/messages';
import type { Conversation, User } from '../../src/data/types';
import { Button, Chip, ErrorLine, Field, Page, s } from '../../src/components/ui';
import { SharedCard, handle } from '../../src/components/Messages';
import { PeopleSections } from '../../src/components/PeopleSections';

/** Compose a DM or group; also adds people to a group and shares a track or release. */
export default function NewMessage() {
  const uid = useLocal((s) => s.uid);
  const params = useLocalSearchParams<{ trackId?: string; releaseId?: string; addTo?: string }>();
  return <Compose key={`${uid}:${params.addTo || ''}`} uid={uid} {...params} />;
}

function Compose({
  uid,
  trackId,
  releaseId,
  addTo,
}: {
  uid: string | null;
  trackId?: string;
  releaseId?: string;
  addTo?: string;
}) {
  const [selected, setSelected] = useState<Map<string, User>>(new Map()),
    [query, setQuery] = useState(''),
    [name, setName] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const groupRef = useMemo(() => (addTo ? doc(db, 'conversations', addTo) : null), [addTo]);
  const group = useDocument<Conversation>(groupRef);
  const track = useCatalogIds('tracks', [trackId]).byId.get(trackId || ''),
    release = useCatalogIds('releases', [releaseId]).byId.get(releaseId || '');
  const existing = group.data?.memberIds || [];
  const limit = MESSAGE_LIMITS.groupMembers - (addTo ? existing.length : 1);

  function toggle(user: User) {
    if (!selected.has(user.id) && selected.size >= limit) {
      setError(`Groups can have up to ${MESSAGE_LIMITS.groupMembers} people.`);
      return;
    }
    setError(null);
    setSelected((old) => {
      const next = new Map(old);
      if (next.has(user.id)) next.delete(user.id);
      else next.set(user.id, user);
      return next;
    });
  }
  async function start() {
    setBusy(true);
    setError(null);
    try {
      const ids = [...selected.keys()];
      if (addTo) {
        await addMembers(addTo, ids);
        router.back();
        return;
      }
      const cid = await openConversation(ids, ids.length > 1 ? name : undefined);
      if (trackId || releaseId) await sendShared(cid, { trackId, releaseId });
      router.replace(`/messages/${cid}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const people = [...selected.values()];
  return (
    <Page scroll={false}>
      <Stack.Screen
        options={{
          title: addTo ? 'Add people' : trackId || releaseId ? 'Send to…' : 'New message',
        }}
      />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {track || release ? (
          <SharedCard
            message={{
              id: 'preview',
              uid: uid || '',
              kind: trackId ? 'track' : 'release',
              body: '',
              trackId: trackId || null,
              releaseId: releaseId || null,
              createdAt: null,
            }}
            track={track}
            release={release}
          />
        ) : null}
        {people.length ? (
          <View style={s.grid}>
            {people.map((p) => (
              <Chip key={p.id} label={`${handle(p)} ✕`} selected onPress={() => toggle(p)} />
            ))}
          </View>
        ) : (
          <Text style={s.muted}>
            {addTo
              ? 'Choose who to add to the group.'
              : 'Choose one listener for a direct message, or several to start a group.'}
          </Text>
        )}
        {!addTo && people.length > 1 ? (
          <Field
            accessibilityLabel="Group name"
            placeholder="Group name (optional)"
            value={name}
            onChangeText={setName}
            maxLength={MESSAGE_LIMITS.groupName}
          />
        ) : null}
        <PeopleSections
          mode="pick"
          selected={new Set(selected.keys())}
          onPick={toggle}
          exclude={[...(uid ? [uid] : []), ...existing]}
          query={query}
          onQuery={setQuery}
        />
      </ScrollView>
      <View style={{ padding: space[16], gap: space[8] }}>
        <ErrorLine message={error} />
        <Button
          disabled={!people.length}
          busy={busy}
          busyLabel={addTo ? 'Adding…' : 'Starting…'}
          onPress={() => void start()}
        >
          {addTo
            ? people.length
              ? `Add ${people.length} to group`
              : 'Add to group'
            : trackId || releaseId
              ? 'Send'
              : people.length > 1
                ? `Start group with ${people.length}`
                : 'Start conversation'}
        </Button>
      </View>
    </Page>
  );
}
