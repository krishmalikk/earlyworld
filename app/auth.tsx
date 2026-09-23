import React, { useState } from 'react';
import { Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from '@react-native-firebase/auth';
import { doc, serverTimestamp, setDoc } from '@react-native-firebase/firestore';
import { auth, db, errorMessage } from '../src/lib/firebase';
import { Button, c, ErrorLine, Field, s } from '../src/components/ui';
export default function Auth() {
  const [signup, setSignup] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState('');
  async function submit() {
    setError(null);
    setBusy(true);
    try {
      if (signup) {
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
      } else await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={s.page}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, padding: 24, justifyContent: 'space-between' }}
      >
        <View style={{ paddingTop: 28, gap: 14 }}>
          <Text style={[s.mono, { color: c.accent }]}>PUBLIC ACCESS / UNDERGROUND MUSIC</Text>
          <Text style={{ fontSize: 48, fontWeight: '900', letterSpacing: -3, color: c.text }}>
            earlyworld
          </Text>
          <View style={[s.divider, { marginTop: 16 }]} />
          <Text style={[s.title, { fontSize: 33, marginTop: 14 }]}>
            Find your people.{'\n'}Stay in rotation.
          </Text>
          <Text style={s.muted}>The tracks you save say more than the numbers they do.</Text>
        </View>
        <View style={{ gap: 12, paddingVertical: 28 }}>
          <Text style={s.mono}>{signup ? '01 / 06 — ACCOUNT' : 'BACK IN THE LOOP'}</Text>
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
            placeholder={signup ? 'Password · 8 characters minimum' : 'Password'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={signup ? 'new-password' : 'current-password'}
          />
          <ErrorLine message={error} />
          {notice ? <Text style={s.muted}>{notice}</Text> : null}
          <Button onPress={submit} busy={busy} disabled={!email || !password}>
            {signup ? 'Create account' : 'Sign in'}
          </Button>
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
        <Text style={[s.mono, { paddingBottom: 18, fontSize: 8 }]}>
          SOUNDCLOUD / YOUTUBE / BANDCAMP
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
