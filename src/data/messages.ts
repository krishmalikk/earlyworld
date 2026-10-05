import { call } from '../lib/firebase';
import { newPostId } from './post-drafts';

export type Shared = { trackId?: string; releaseId?: string };

/** Opens (or reuses) a DM for one listener, or creates a group for several. */
export async function openConversation(memberIds: string[], name?: string) {
  const { id } = await call<{ id: string }>('openConversation', {
    memberIds,
    name: name?.trim() || null,
    requestId: newPostId(),
  });
  return id;
}

/** `requestId` must stay stable across retries of one message so the server can deduplicate. */
export function sendText(cid: string, body: string, requestId: string) {
  return call<{ id: string }>('sendMessage', { cid, kind: 'text', body, requestId });
}

export function sendShared(cid: string, shared: Shared, requestId = newPostId()) {
  return call<{ id: string }>('sendMessage', {
    cid,
    kind: shared.trackId ? 'track' : 'release',
    trackId: shared.trackId,
    releaseId: shared.releaseId,
    requestId,
  });
}

export const respondToRequest = (cid: string, accept: boolean) =>
  call('respondToRequest', { cid, accept });
export const leaveConversation = (cid: string) => call('leaveConversation', { cid });
export const removeMember = (cid: string, uid: string) =>
  call('removeConversationMember', { cid, uid });
export const addMembers = (cid: string, memberIds: string[]) =>
  call('addConversationMembers', { cid, memberIds });
export const renameConversation = (cid: string, name: string) =>
  call('renameConversation', { cid, name });
