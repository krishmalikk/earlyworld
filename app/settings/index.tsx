import { router } from 'expo-router';
import { signOut } from '@react-native-firebase/auth';
import { auth } from '../../src/lib/firebase';
import { useSocial, useSocialStatus } from '../../src/data/social';
import { Button, ErrorLine, Page } from '../../src/components/ui';
import {
  ActionFeedback,
  appBuild,
  appVersion,
  contactSupport,
  SettingsGroup,
  SettingsRow,
  useSettingsAction,
} from '../../src/components/SettingsControls';
export default function Settings() {
  const status = useSocialStatus(),
    action = useSettingsAction(),
    { changed } = useSocial();
  return (
    <Page>
      <SettingsGroup title="Account">
        <SettingsRow
          icon="person-circle-outline"
          label="Email & security"
          detail={auth.currentUser?.email || undefined}
          onPress={() => router.push('/settings/account')}
        />
        <SettingsRow
          icon="checkmark-circle-outline"
          label="Community access"
          detail={
            status.data
              ? status.data.eligible
                ? 'Eligibility confirmed'
                : 'Complete your eligibility'
              : undefined
          }
          onPress={() => router.push('/settings/access')}
        />
      </SettingsGroup>
      <SettingsGroup title="Privacy & safety">
        <SettingsRow
          icon="ban-outline"
          label="Blocked listeners"
          onPress={() => router.push('/settings/blocked')}
        />
        <SettingsRow
          icon="people-outline"
          label="Community rules"
          onPress={() =>
            router.push({ pathname: '/settings/policy', params: { section: 'rules' } })
          }
        />
        <SettingsRow
          icon="shield-checkmark-outline"
          label="Privacy & access"
          onPress={() =>
            router.push({ pathname: '/settings/policy', params: { section: 'privacy' } })
          }
        />
      </SettingsGroup>
      <SettingsGroup title="Help & about">
        <SettingsRow
          icon="mail-outline"
          label="Contact support"
          onPress={() => void action.run(() => contactSupport(status.data?.supportEmail))}
        />
        <SettingsRow
          icon="bug-outline"
          label="Report a problem"
          onPress={() => void action.run(() => contactSupport(status.data?.supportEmail, true))}
        />
        <SettingsRow
          icon="information-circle-outline"
          label="App version"
          detail={`${appVersion} (${appBuild})`}
        />
      </SettingsGroup>
      <ErrorLine message={status.error} />
      {status.error ? (
        <Button quiet onPress={changed}>
          Retry account status
        </Button>
      ) : null}
      {status.data?.admin ? (
        <SettingsGroup title="Moderation">
          <SettingsRow
            icon="shield-outline"
            label="Moderation queue"
            onPress={() => router.push('/moderation')}
          />
        </SettingsGroup>
      ) : null}
      <ActionFeedback {...action} />
      <Button quiet busy={action.busy} onPress={() => void action.run(() => signOut(auth))}>
        Sign out
      </Button>
      <SettingsGroup title="Account actions">
        <SettingsRow
          icon="trash-outline"
          label="Delete account"
          destructive
          onPress={() => router.push('/settings/delete')}
        />
      </SettingsGroup>
    </Page>
  );
}
