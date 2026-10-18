import { Platform } from 'react-native';
import {
  AppleAuthProvider,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { auth } from './firebase';

/** Thrown when the person closes the Google or Apple sheet; callers show nothing. */
export class SignInCancelled extends Error {}

let configured = false;
function configureGoogle() {
  if (configured) return;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) throw Error('Google sign-in is not configured for this build.');
  GoogleSignin.configure({ webClientId });
  configured = true;
}

/** Signs in to Firebase with a Google account. New accounts finish setup in onboarding. */
export async function signInWithGoogle() {
  configureGoogle();
  try {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) throw new SignInCancelled();
    const idToken = response.data.idToken;
    if (!idToken) throw Error('Google did not return a sign-in token. Try again.');
    return await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) throw new SignInCancelled();
    throw e;
  }
}

export const appleSignInAvailable = () =>
  Platform.OS === 'ios' ? AppleAuthentication.isAvailableAsync() : Promise.resolve(false);

/** Signs in to Firebase with an Apple ID, using a one-time nonce Firebase can verify. */
export async function signInWithApple() {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const apple = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!apple.identityToken) throw Error('Apple did not return a sign-in token. Try again.');
    return await signInWithCredential(
      auth,
      AppleAuthProvider.credential(apple.identityToken, rawNonce),
    );
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new SignInCancelled();
    throw e;
  }
}

/** Clears the Google session too, so the next Google sign-in can pick a different account. */
export async function signOutOfGoogle() {
  try {
    if (configured || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
      configureGoogle();
      await GoogleSignin.signOut();
    }
  } catch {
    // Signing out of Firebase still succeeds without a Google session.
  }
}

/** Signs out of earlyworld and of Google, so the next Google sign-in can choose an account. */
export async function signOut() {
  await signOutOfGoogle();
  await firebaseSignOut(auth);
}
