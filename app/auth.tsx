import { space } from '../shared/theme';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Pressable, Text, View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from '@react-native-firebase/auth';
import { doc, serverTimestamp, setDoc } from '@react-native-firebase/firestore';
import { auth, db, call, errorMessage, report } from '../src/lib/firebase';
import { Brand } from '../src/components/Brand';
import { AuthWaves, ReturningOrbit } from '../src/components/AuthDecor';
import { Button, c, Chip, ErrorLine, Field, s } from '../src/components/ui';
import {
  appleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
  SignInCancelled,
} from '../src/lib/social-sign-in';
import { fontSize, fontWeight, radius } from '../shared/theme';
export default function Auth() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [signup, setSignup] = useState(mode === 'signup'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState(''),
    [age, setAge] = useState(''),
    [us, setUs] = useState(false),
    [agreed, setAgreed] = useState(false),
    [apple, setApple] = useState(false),
    [provider, setProvider] = useState<'google' | 'apple' | null>(null);
  useEffect(() => {
    void appleSignInAvailable().then(setApple);
  }, []);
  // New Google and Apple accounts have no profile yet; the root layout sends them to onboarding.
  async function social(which: 'google' | 'apple') {
    setError(null);
    setProvider(which);
    try {
      await (which === 'google' ? signInWithGoogle() : signInWithApple());
    } catch (e) {
      if (!(e instanceof SignInCancelled)) setError(errorMessage(e));
    } finally {
      setProvider(null);
    }
  }
  async function submit() {
    setError(null);
    setBusy(true);
    try {
      if (signup) {
        if (!/^\d{1,3}$/.test(age) || Number(age) < 13 || Number(age) > 120 || !us || !agreed)
          throw Error(
            'Account creation is currently available to US users aged 13 and older. Confirm your age, region, and agreement.',
          );
        if (password.length < 8) throw new Error('Use at least 8 characters.');
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await setDoc(doc(db, 'users', result.user.uid), {
          username: '',
          usernameLower: '',
          avatarUrl: '',
          bio: '',
          createdAt: serverTimestamp(),
          saveCount: 0,
          followerCount: 0,
          onboardingComplete: false,
          onboardingStep: 1,
          scenes: [],
        });
        await call('setSocialEligibility', { age: Number(age), country: 'US', agreed: true });
        // Written reviews need a verified email; Settings can resend this if it fails.
        await sendEmailVerification(result.user).catch(report);
      } else await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={s.page}>
      {signup ? <AuthWaves /> : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, padding: space[24] }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, gap: space[12] }}
        >
          {signup ? (
            <View style={{ height: 112, alignItems: 'center', justifyContent: 'center' }}>
              <Brand variant="hero" />
            </View>
          ) : (
            <>
              <View style={{ marginHorizontal: -space[24] }}>
                <ReturningOrbit />
              </View>
              <Brand variant="hero" />
            </>
          )}
          <View style={{ gap: space[12], paddingVertical: space[16] }}>
            <Text style={[s.title, s.displayTitle]}>{signup ? 'Create account' : 'Sign in'}</Text>
            <Field
              accessibilityLabel="Email"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Field
              accessibilityLabel="Password"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={signup ? 'new-password' : 'current-password'}
            />
            {signup ? <Text style={s.muted}>Use at least 8 characters.</Text> : null}
            {signup ? (
              <>
                <Text style={s.muted}>Community access · US, ages 13+</Text>
                <Field
                  accessibilityLabel="Your age"
                  placeholder="Your age"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Chip
                  label="I live in the United States"
                  selected={us}
                  onPress={() => setUs(!us)}
                />
                <Text style={s.muted}>
                  Be respectful. Share only content you have permission to post. No harassment,
                  sexual content, exploitation, or private information. Age eligibility is private;
                  we do not collect your location or contacts.
                </Text>
                <Button quiet onPress={() => router.push('/community')}>
                  Read community rules & privacy terms
                </Button>
                <Chip
                  label="I agree to the community rules and privacy terms"
                  selected={agreed}
                  onPress={() => setAgreed(!agreed)}
                />
              </>
            ) : null}
            <ErrorLine message={error} />
            {notice ? <Text style={s.muted}>{notice}</Text> : null}
            <Button onPress={submit} busy={busy} disabled={!email || !password}>
              {signup ? 'Create account' : 'Sign in'}
            </Button>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[12] }}>
              <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
              <Text style={s.muted}>or</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
            </View>
            {apple ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  signup
                    ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
                    : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                }
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={radius.pill}
                style={{ height: 50, opacity: provider ? 0.6 : 1 }}
                onPress={() => {
                  if (!provider) void social('apple');
                }}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: provider === 'google', disabled: !!provider }}
              disabled={!!provider}
              onPress={() => void social('google')}
              style={({ pressed }) => ({
                height: 50,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: c.line,
                backgroundColor: c.panel,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: space[10],
                opacity: pressed || provider ? 0.7 : 1,
              })}
            >
              <Ionicons name="logo-google" size={18} color={c.text} />
              <Text style={{ color: c.text, fontSize: fontSize.body, fontWeight: fontWeight.bold }}>
                {provider === 'google' ? 'Opening Google…' : 'Continue with Google'}
              </Text>
            </Pressable>
            <Button
              quiet
              onPress={() => {
                setSignup(!signup);
                setError(null);
              }}
            >
              {signup ? 'Already here? Sign in' : 'New here? Create account'}
            </Button>
            {!signup ? (
              <Button
                quiet
                onPress={async () => {
                  try {
                    await sendPasswordResetEmail(auth, email.trim());
                    setNotice('Check your email for a reset link.');
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
              >
                Reset password
              </Button>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
