import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref as storageRef, putFile } from '@react-native-firebase/storage';
import { call, storage } from '../lib/firebase';
import { newPostId } from './post-drafts';

/** Square-cropped library photo, resized to a 512px JPEG. Null when cancelled. */
export async function pickProfilePhoto() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  });
  if (result.canceled) return null;
  const resized = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: 512 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );
  return resized.uri;
}

/** Uploads against a server ticket and returns the media ID to submit for review. */
export async function uploadProfilePhoto(uri: string) {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw Error('Choose your photo again.');
  const id = newPostId();
  const ticket = await call<{ path: string }>('authorizeProfilePhoto', { id, bytes: info.size });
  await putFile(storageRef(storage, ticket.path), uri, { contentType: 'image/jpeg' });
  return id;
}
