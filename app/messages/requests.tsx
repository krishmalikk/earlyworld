import { useState } from 'react';
import { Text, View } from 'react-native';
import { errorMessage } from '../../src/lib/firebase';
import { useLocal } from '../../src/state/local';
import { useInbox, useProfiles } from '../../src/data/inbox';
import { respondToRequest } from '../../src/data/messages';
import { Empty, ErrorLine, Page, s } from '../../src/components/ui';
import { ConversationRow, SmallButton } from '../../src/components/Messages';

export default function Requests() {
  const uid = useLocal((s) => s.uid);
  const { requests, loading } = useInbox();
  const profiles = useProfiles(requests.flatMap((r) => r.memberIds).filter((m) => m !== uid));
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null);
  async function respond(cid: string, accept: boolean) {
    setBusy(cid);
    setError(null);
    try {
      await respondToRequest(cid, accept);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <Page>
      <Text style={s.muted}>
        Messages from listeners you aren’t connected to. They won’t know you’ve seen a request until
        you accept and reply.
      </Text>
      <ErrorLine message={error} />
      {!requests.length ? (
        <Empty title={loading ? 'Loading requests…' : 'No message requests.'} />
      ) : (
        requests.map((row) => (
          <View key={row.id} style={s.panel}>
            <ConversationRow row={row} uid={uid} profiles={profiles.byId} />
            <View style={s.row}>
              <SmallButton
                label="Accept"
                disabled={busy === row.id}
                onPress={() => void respond(row.id, true)}
              />
              <SmallButton
                quiet
                label="Delete"
                disabled={busy === row.id}
                onPress={() => void respond(row.id, false)}
              />
            </View>
          </View>
        ))
      )}
    </Page>
  );
}
