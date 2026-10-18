import * as FileSystem from 'expo-file-system/legacy';
import type { PostContent } from '../../shared/social';
export type ComposerFile = {
  id: string;
  uri: string;
  kind: 'photo';
  mime: string;
  bytes: number;
  uploaded?: boolean;
};
/** The post being written. It lives in memory only; posts are never kept as drafts. */
export type ComposerPost = PostContent & {
  id: string;
  files: ComposerFile[];
  editing?: boolean;
  mediaLocked?: boolean;
};
// Picked media is copied here so uploads survive the picker's own cache cleanup.
const root = `${FileSystem.cacheDirectory}post-composer/`;
export const newPostId = () =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
export const emptyPost = (): ComposerPost => ({
  id: newPostId(),
  kind: 'post',
  text: '',
  scenes: [],
  attachment: null,
  mediaIds: [],
  files: [],
});
export async function keepComposerFile(uri: string, id: string) {
  await FileSystem.makeDirectoryAsync(root, { intermediates: true });
  const destination = `${root}${id}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}
export async function clearComposerFiles() {
  await FileSystem.deleteAsync(root, { idempotent: true });
}
