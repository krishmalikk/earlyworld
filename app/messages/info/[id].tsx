import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc } from '@react-native-firebase/firestore';
import { space } from '../../../shared/theme';
import { MESSAGE_LIMITS } from '../../../shared/messages';
import { call, db, errorMessage } from '../../../src/lib/firebase';
import { useLocal } from '../../../src/state/local';
import { useDocument } from '../../../src/data/listeners';
import { useProfiles } from '../../../src/data/inbox';
import { leaveConversation, removeMember, renameConversation } from '../../../src/data/messages';
import type { Conversation } from '../../../src/data/types';
import { Button, Empty, ErrorLine, Field, Page, s, Section } from '../../../src/components/ui';
import { PersonRow, SmallButton, handle } from '../../../src/components/Messages';

export default function ConversationInfo() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    uid = useLocal((s) => s.uid);
  return <Info key={`${uid}:${id}`} id={id} uid={uid} />;
}

function Info({ id, uid }: { id: string; uid: string | null }) {
  const ref = useMemo(() => doc(db, 'conversations', id), [id]);
  const conversation = useDocument<Conversation>(ref);
  const c = conversation.data;
  const profiles = useProfiles(c?.memberIds || []);
  const [name, setName] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  if (!c)
    return (
      <Page>
        <ErrorLine message={conversation.error} />
        <Empty title={conversation.loading ? 'Loading…' : 'Conversation unavailable.'} />
      </Page>
    );
  const creator = c.createdBy === uid,
    group = c.type === 'group',
    other = group ? null : c.memberIds.find((m) => m !== uid) || null;
  async function run(action: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      after?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const confirm = (title: string, detail: string, label: string, action: () => void) =>
    Alert.alert(title, detail, [
      { text: 'Cancel', style: 'cancel' },
      { text: label, style: 'destructive', onPress: action },
    ]);
  return (
    <Page>
      <ErrorLine message={error} />
      {group && creator ? (
        <Section title="Group name">
          <Field
            accessibilityLabel="Group name"
            placeholder="Name this group"
            value={name ?? c.name ?? ''}
            onChangeText={setName}
            maxLength={MESSAGE_LIMITS.groupName}
          />
          {name !== null && name !== (c.name ?? '') ? (
            <Button
              busy={busy}
              onPress={() =>
                void run(
                  () => renameConversation(id, name),
                  () => setName(null),
                )
              }
            >
              Save name
            </Button>
          ) : null}
        </Section>
      ) : null}
      <Section
        title={group ? `${c.memberIds.length} members` : 'Conversation'}
        right={
          group && creator && c.memberIds.length < MESSAGE_LIMITS.groupMembers ? (
            <SmallButton
              label="Add people"
              onPress={() => router.push({ pathname: '/messages/new', params: { addTo: id } })}
            />
          ) : undefined
        }
      >
        {c.memberIds.map((m) => {
          const p = profiles.byId.get(m);
          if (!p) return null;
          return (
            <PersonRow
              key={m}
              user={p}
              detail={
                m === uid ? 'You' : m === c.createdBy && group ? 'Created the group' : undefined
              }
              right={
                group && creator && m !== uid ? (
                  <SmallButton
                    quiet
                    label="Remove"
                    onPress={() =>
                      confirm(
                        `Remove ${handle(p)}?`,
                        'They will no longer see this group.',
                        'Remove',
                        () => void run(() => removeMember(id, m)),
                      )
                    }
                  />
                ) : undefined
              }
            />
          );
        })}
      </Section>
      <View style={{ gap: space[10] }}>
        {group ? (
          <Button
            quiet
            busy={busy}
            onPress={() =>
              confirm(
                'Leave this group?',
                'You won’t see new messages.',
                'Leave',
                () =>
                  void run(
                    () => leaveConversation(id),
                    () => router.dismissTo('/(tabs)/inbox'),
                  ),
              )
            }
          >
            Leave group
          </Button>
        ) : other ? (
          <>
            <Button
              quiet
              onPress={() =>
                router.push({
                  pathname: '/community',
                  params: { reportKind: 'profile', reportId: other },
                })
              }
            >
              Report {handle(profiles.byId.get(other))}
            </Button>
            <Button
              quiet
              busy={busy}
              onPress={() =>
                confirm(
                  `Block ${handle(profiles.byId.get(other))}?`,
                  'They won’t be able to message you, and you won’t see each other’s community content.',
                  'Block',
                  () =>
                    void run(
                      () => call('setUserBlock', { uid: other, blocked: true }),
                      () => router.dismissTo('/(tabs)/inbox'),
                    ),
                )
              }
            >
              Block
            </Button>
          </>
        ) : null}
        <Text style={s.muted}>
          Long-press any message to report it. Reports go to earlyworld moderators with only the
          reported message.
        </Text>
      </View>
    </Page>
  );
}
