import { getApp } from '@react-native-firebase/app';
import { getAuth, connectAuthEmulator } from '@react-native-firebase/auth';
import { getFirestore, connectFirestoreEmulator } from '@react-native-firebase/firestore';
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} from '@react-native-firebase/functions';
import { getStorage, connectStorageEmulator } from '@react-native-firebase/storage';
import { getCrashlytics, recordError } from '@react-native-firebase/crashlytics';
export const auth = getAuth(getApp());
export const db = getFirestore(getApp());
export const functions = getFunctions(getApp(), 'us-central1');
export const storage = getStorage(getApp());
const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;
if (__DEV__ && host) {
  connectAuthEmulator(auth, `http://${host}:9099`);
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
  connectStorageEmulator(storage, host, 9199);
}
export async function call<T = unknown>(
  name: string,
  data: unknown = {},
  timeout?: number,
): Promise<T> {
  const response = await httpsCallable(functions, name, timeout ? { timeout } : undefined)(data);
  return response.data as T;
}
export function report(error: unknown) {
  if (!__DEV__)
    recordError(getCrashlytics(), new Error((error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g, '[URL removed]')));
}
export function errorMessage(error: unknown) {
  report(error);
  return error instanceof Error
    ? error.message.replace(/^\[[^\]]+\]\s*/, '')
    : 'Something went wrong. Try again.';
}
