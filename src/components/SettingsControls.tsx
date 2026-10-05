import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import {
  getIdToken,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
} from '@react-native-firebase/auth';
import { auth, call, errorMessage } from '../lib/firebase';
import { useLocal } from '../state/local';
import { useSocial, useSocialStatus } from '../data/social';
import { clearLocalPostDraft } from '../data/post-drafts';
import { Button, Chip, ErrorLine, Field, Section, c, s } from './ui';
import { radius, space } from '../../shared/theme';

export const appVersion = Constants.nativeAppVersion || Constants.expoConfig?.version || 'Unknown';
export const appBuild = Constants.nativeBuildVersion || 'Development';
export async function contactSupport(email: string | undefined, problem = false) {
  const address =
    email && /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email)
      ? email
      : 'earlyworldofficial@gmail.com';
  const subject = problem ? 'earlyworld — Report a problem' : 'earlyworld support';
  const body = problem
    ? `App: ${appVersion} (${appBuild})\nPlatform: ${Platform.OS}\n\nWhat happened?\n`
    : '';
  try {
    await Linking.openURL(
      `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    );
  } catch {
    throw new Error(`Could not open email. Contact ${address} using your email app.`);
  }
}

/** Ignore completions after navigating away or switching accounts. */
export function useSettingsAction() {
  const uid = useLocal((state) => state.uid);
  const live = useRef(true),
    busyRef = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const current = () => live.current && useLocal.getState().uid === uid;
  async function run(action: () => Promise<unknown>, message = '') {
    if (busyRef.current || !current()) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      if (current()) setNotice(message);
    } catch (e) {
      if (current()) setError(errorMessage(e));
    } finally {
      busyRef.current = false;
      if (current()) setBusy(false);
    }
  }
  return { busy, error, notice, run };
}
export function ActionFeedback({ error, notice }: { error: string; notice: string }) {
  return (
    <>
      <ErrorLine message={error} />
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={s.link}>
          {notice}
        </Text>
      ) : null}
    </>
  );
}
export function SettingsRow({
  icon,
  label,
  detail,
  onPress,
  destructive = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  detail?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const content = (
    <>
      <Ionicons name={icon} size={22} color={destructive ? c.error : c.accent} accessible={false} />
      <View style={styles.label}>
        <Text style={[s.text, destructive && { color: c.error }]}>{label}</Text>
        {detail ? <Text style={s.muted}>{detail}</Text> : null}
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={18} color={c.muted} accessible={false} />
      ) : null}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.65 }]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.row}>{content}</View>
  );
}
export function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Section title={title}>
      <View style={styles.group}>{children}</View>
    </Section>
  );
}
export function AccountControls() {
  const action = useSettingsAction(),
    { changed } = useSocial();
  const user = auth.currentUser;
  return (
    <>
      <Section title="Email">
        <Text selectable style={s.text}>
          {user?.email || 'No email address'}
        </Text>
        <Text style={s.muted}>{user?.emailVerified ? 'Verified' : 'Not verified'}</Text>
      </Section>
      <ActionFeedback {...action} />
      {!user?.emailVerified ? (
        <>
          <Button
            busy={action.busy}
            onPress={() =>
              void action.run(async () => {
                if (user) await sendEmailVerification(user);
              }, 'Verification email sent. Check your inbox.')
            }
          >
            Send verification email
          </Button>
          <Button
            quiet
            busy={action.busy}
            onPress={() =>
              void action.run(async () => {
                if (user) {
                  await reload(user);
                  await getIdToken(user, true);
                  changed();
                  if (!user.emailVerified)
                    throw new Error(
                      'Your email is not verified yet. Open the link in your inbox, then try again.',
                    );
                }
              }, 'Email verified.')
            }
          >
            I’ve verified my email
          </Button>
        </>
      ) : null}
      <Button
        quiet
        busy={action.busy}
        disabled={!user?.email}
        onPress={() =>
          void action.run(async () => {
            if (user?.email) await sendPasswordResetEmail(auth, user.email);
          }, 'Password reset email sent. Check your inbox.')
        }
      >
        Send password reset email
      </Button>
    </>
  );
}
export function CommunityAccessControls() {
  const status = useSocialStatus(),
    { changed } = useSocial(),
    action = useSettingsAction();
  const [age, setAge] = useState(''),
    [us, setUs] = useState(false),
    [agree, setAgree] = useState(false);
  return (
    <>
      <ErrorLine message={status.error} />
      {status.error ? (
        <Button quiet onPress={changed}>
          Retry
        </Button>
      ) : null}
      <ActionFeedback {...action} />
      {!status.data ? (
        <Text style={s.muted}>
          {status.error ? 'Community access could not be loaded.' : 'Loading community access…'}
        </Text>
      ) : status.data.eligible ? (
        <Text style={s.text}>
          Community eligibility confirmed. Publishing also requires a verified email and
          availability of social features.
        </Text>
      ) : (
        <>
          <Text style={s.text}>The initial community is for US listeners aged 13 and older.</Text>
          <Text style={s.muted}>
            Enter your age, not your birthday. This information stays private.
          </Text>
          <Field
            accessibilityLabel="Age in years"
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
            maxLength={3}
          />
          <Chip label="I am based in the United States" selected={us} onPress={() => setUs(!us)} />
          <Button quiet onPress={() => router.push('/community')}>
            Read community rules & privacy information
          </Button>
          <Chip
            label="I agree to the community rules and privacy terms"
            selected={agree}
            onPress={() => setAgree(!agree)}
          />
          <Button
            busy={action.busy}
            disabled={!us || !agree || !/^\d{1,3}$/.test(age)}
            onPress={() =>
              void action.run(async () => {
                await call('setSocialEligibility', {
                  age: Number(age),
                  country: 'US',
                  agreed: agree,
                });
                changed();
              }, 'Community eligibility saved.')
            }
          >
            Save community access
          </Button>
        </>
      )}
    </>
  );
}
export function DeleteAccountControls() {
  const action = useSettingsAction();
  const [needsSignIn, setNeedsSignIn] = useState(false);
  return (
    <>
      <Text style={s.text}>
        Permanently delete your account, posts, uploads, reviews, saves, and profile. This cannot be
        undone.
      </Text>
      <Text style={s.muted}>
        Your content will be hidden when the request is accepted. Removal runs in the background;
        previously issued media links may work briefly until they expire.
      </Text>
      <ActionFeedback {...action} />
      {needsSignIn ? (
        <Button
          busy={action.busy}
          onPress={() =>
            void action.run(async () => {
              await signOut(auth);
              router.replace({ pathname: '/auth', params: { mode: 'signin' } });
            })
          }
        >
          Sign in again
        </Button>
      ) : null}
      <Button
        quiet
        busy={action.busy}
        textStyle={{ color: c.error }}
        onPress={() =>
          Alert.alert(
            'Permanently delete your account?',
            'This cannot be undone. Your content will be hidden and queued for removal.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete account',
                style: 'destructive',
                onPress: () =>
                  void action.run(async () => {
                    const uid = auth.currentUser?.uid;
                    if (!uid) throw new Error('Sign in again to continue.');
                    try {
                      await call('requestAccountDeletion');
                    } catch (e) {
                      if (
                        auth.currentUser?.uid === uid &&
                        typeof e === 'object' &&
                        e &&
                        'code' in e &&
                        String(e.code).includes('unauthenticated')
                      )
                        setNeedsSignIn(true);
                      throw e;
                    }
                    // An accepted deletion must still sign out if local file cleanup fails.
                    try {
                      await clearLocalPostDraft(uid);
                    } finally {
                      if (auth.currentUser?.uid === uid) await signOut(auth);
                    }
                  }),
              },
            ],
          )
        }
      >
        Delete account
      </Button>
      {needsSignIn ? (
        <Text style={s.muted}>
          After signing in, return here to confirm deletion. Nothing is deleted automatically.
        </Text>
      ) : null}
    </>
  );
}
const styles = StyleSheet.create({
  group: { backgroundColor: c.panel, borderRadius: radius.card, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    padding: space[16],
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.line,
  },
  label: { flex: 1, gap: space[4] },
});
