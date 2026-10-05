import * as FileSystem from 'expo-file-system/legacy';
import type { PostContent } from '../../shared/social';
export type DraftFile = {
  id: string;
  uri: string;
  kind: 'photo' | 'video';
  mime: string;
  bytes: number;
  uploaded?: boolean;
};
export type LocalPostDraft = PostContent & {
  id: string;
  files: DraftFile[];
  rights: boolean;
  editing?: boolean;
  mediaLocked?: boolean;
  savedAt?: number;
};
const root = (uid: string) => `${FileSystem.documentDirectory}post-drafts/${uid}/`;
export const newPostId = () =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
export const emptyPostDraft = (): LocalPostDraft => ({
  id: newPostId(),
  kind: 'post',
  text: '',
  scenes: [],
  attachment: null,
  mediaIds: [],
  files: [],
  rights: false,
});
export async function readPostDraft(uid: string): Promise<LocalPostDraft | null> {
  try {
    const draft = JSON.parse(
      await FileSystem.readAsStringAsync(`${root(uid)}draft.json`),
    ) as LocalPostDraft;
    if (draft.savedAt && Date.now() - draft.savedAt > 7 * 86400000) {
      await clearLocalPostDraft(uid);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}
export async function saveLocalPostDraft(uid: string, draft: LocalPostDraft) {
  await FileSystem.makeDirectoryAsync(root(uid), { intermediates: true });
  await FileSystem.writeAsStringAsync(
    `${root(uid)}draft.json`,
    JSON.stringify({ ...draft, savedAt: Date.now() }),
  );
}
export async function keepDraftFile(uid: string, uri: string, id: string) {
  await FileSystem.makeDirectoryAsync(root(uid), { intermediates: true });
  const destination = `${root(uid)}${id}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}
export async function clearLocalPostDraft(uid: string) {
  await FileSystem.deleteAsync(root(uid), { idempotent: true });
}
