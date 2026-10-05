import { useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { auth, call } from '../src/lib/firebase';
import { useLocal } from '../src/state/local';
import { useSocialStatus } from '../src/data/social';
import { Button, Field, Page, s, Section } from '../src/components/ui';
import { CommunityPolicy } from '../src/components/CommunityPolicy';
import {
  AccountControls,
  ActionFeedback,
  CommunityAccessControls,
  contactSupport,
  useSettingsAction,
} from '../src/components/SettingsControls';
export default function Community() {
  const uid = useLocal((state) => state.uid);
  return <CommunityContent key={uid || 'signed-out'} />;
}
function CommunityContent() {
  const params = useLocalSearchParams<{
    reportKind?: string;
    reportId?: string;
    trackId?: string;
  }>();
  const [reason, setReason] = useState('');
  const action = useSettingsAction(),
    status = useSocialStatus();
  return (
    <Page>
      {params.reportId ? (
        <Section title="Report content">
          <Text style={s.muted}>
            Tell us about harassment, unsafe content, a rights concern, or another issue.
          </Text>
          <Field
            accessibilityLabel="Report reason"
            multiline
            value={reason}
            onChangeText={setReason}
            maxLength={500}
          />
          <Button
            busy={action.busy}
            disabled={!reason.trim()}
            onPress={() =>
              void action.run(
                () =>
                  call('reportSocialContent', {
                    kind: params.reportKind,
                    id: params.reportId,
                    trackId: params.trackId,
                    reason,
                  }),
                'Report submitted for review.',
              )
            }
          >
            Send report
          </Button>
        </Section>
      ) : null}
      <ActionFeedback {...action} />
      <CommunityPolicy />
      {auth.currentUser && !status.data?.eligible ? (
        <Section title="Community access">
          <CommunityAccessControls />
        </Section>
      ) : null}
      {auth.currentUser && !auth.currentUser.emailVerified ? (
        <Section title="Verify your email">
          <AccountControls />
        </Section>
      ) : null}
      <Section title="Support">
        <Button
          quiet
          busy={action.busy}
          onPress={() => void action.run(() => contactSupport(status.data?.supportEmail))}
        >
          {status.data?.supportEmail || 'earlyworldofficial@gmail.com'}
        </Button>
      </Section>
      {auth.currentUser ? (
        <Button quiet onPress={() => router.push('/settings')}>
          Settings
        </Button>
      ) : null}
    </Page>
  );
}
