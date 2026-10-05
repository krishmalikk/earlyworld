import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useCommunity } from '../../src/data/community';
import { useSocial } from '../../src/data/social';
import { call } from '../../src/lib/firebase';
import { Button, ErrorLine, Page, s } from '../../src/components/ui';
import { ActionFeedback, useSettingsAction } from '../../src/components/SettingsControls';
export default function BlockedListeners() {
  const [count, setCount] = useState(25),
    [removed, setRemoved] = useState<string[]>([]);
  const blocks = useCommunity<{ id: string; username?: string | null }>(
    { kind: 'blockedUsers' },
    count,
  );
  const { changed } = useSocial(),
    action = useSettingsAction();
  const items = blocks.data.filter((b) => !removed.includes(b.id));
  return (
    <Page>
      <Text style={s.muted}>
        Blocked listeners cannot interact with you or see your community content. You won’t see
        theirs.
      </Text>
      <ErrorLine message={blocks.error} />
      <ActionFeedback {...action} />
      {items.map((b) => (
        <View style={s.panel} key={b.id}>
          <Text style={s.text}>{b.username ? `@${b.username}` : 'Unavailable account'}</Text>
          <Button
            quiet
            busy={action.busy}
            onPress={() =>
              Alert.alert(
                'Unblock this listener?',
                'You may see each other’s community content again. This does not restore follows.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Unblock',
                    onPress: () =>
                      void action.run(async () => {
                        await call('setUserBlock', { uid: b.id, blocked: false });
                        setRemoved((ids) => [...ids, b.id]);
                        changed();
                      }, 'Listener unblocked.'),
                  },
                ],
              )
            }
          >
            Unblock
          </Button>
        </View>
      ))}
      {blocks.loading ? (
        <Text style={s.muted}>Loading blocked listeners…</Text>
      ) : !items.length && !blocks.error ? (
        <Text style={s.text}>No blocked listeners.</Text>
      ) : null}
      {blocks.error ? (
        <Button quiet onPress={changed}>
          Retry
        </Button>
      ) : null}
      {blocks.more ? (
        <Button quiet busy={blocks.loading} onPress={() => setCount((n) => n + 25)}>
          Load more
        </Button>
      ) : null}
    </Page>
  );
}
