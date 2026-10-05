import { validSocialId } from './social';

export const MESSAGE_LIMITS = {
  body: 1000,
  groupMembers: 20,
  groupName: 60,
  /** Messages a sender may send into an unaccepted request. */
  requestMessages: 3,
  hourly: 120,
  daily: 1000,
  inbox: 50,
  page: 50,
} as const;

export type ConversationType = 'dm' | 'group';
export type InboxState = 'inbox' | 'request' | 'declined';
export type MessageKind = 'text' | 'track' | 'release';
export type MessageContent = {
  kind: MessageKind;
  body: string;
  trackId: string | null;
  releaseId: string | null;
};
export type LastMessage = { senderId: string; preview: string; at: number };

/** Deterministic, so opening the same DM twice always reaches one conversation. */
export function dmId(a: string, b: string) {
  if (!validSocialId(a) || !validSocialId(b) || a === b) throw Error('Choose another listener.');
  return `dm_${[a, b].sort().join('_')}`;
}

/** Normalizes the people a sender wants to talk with, excluding the sender. */
export function conversationMembers(sender: string, input: unknown) {
  if (!Array.isArray(input)) throw Error('Choose who to message.');
  const others = [...new Set(input)].filter((id) => id !== sender);
  if (!others.length) throw Error('Choose who to message.');
  if (others.length + 1 > MESSAGE_LIMITS.groupMembers)
    throw Error(`Groups can have up to ${MESSAGE_LIMITS.groupMembers} people.`);
  if (!others.every(validSocialId)) throw Error('Invalid listener.');
  return others as string[];
}

export function groupName(input: unknown) {
  if (input == null || input === '') return null;
  if (typeof input !== 'string' || input.trim().length > MESSAGE_LIMITS.groupName)
    throw Error(`Keep group names within ${MESSAGE_LIMITS.groupName} characters.`);
  return input.trim() || null;
}

export type Connection = {
  /** The recipient follows the sender. */
  recipientFollowsSender: boolean;
  /** Either listener appears in the other's matches. */
  matched: boolean;
};

/** Connected listeners reach the inbox; everyone else starts as a message request. */
export function inboxStateFor(connection: Connection): InboxState {
  return connection.recipientFollowsSender || connection.matched ? 'inbox' : 'request';
}

export function normalizeMessage(input: unknown): MessageContent {
  if (!input || typeof input !== 'object') throw Error('Check your message.');
  const d = input as Record<string, unknown>;
  const body = typeof d.body === 'string' ? d.body.trim() : '';
  if (body.length > MESSAGE_LIMITS.body)
    throw Error(`Keep messages within ${MESSAGE_LIMITS.body.toLocaleString('en-US')} characters.`);
  if (d.kind === 'text') {
    if (!body) throw Error('Write a message.');
    return { kind: 'text', body, trackId: null, releaseId: null };
  }
  if (d.kind === 'track' || d.kind === 'release') {
    const id = d.kind === 'track' ? d.trackId : d.releaseId;
    if (!validSocialId(id)) throw Error('Choose something to share.');
    return {
      kind: d.kind,
      body,
      trackId: d.kind === 'track' ? id : null,
      releaseId: d.kind === 'release' ? id : null,
    };
  }
  throw Error('Unsupported message.');
}

export function previewText(content: Pick<MessageContent, 'kind' | 'body'>, label = '') {
  const shared =
    content.kind === 'track'
      ? `Shared a track${label ? `: ${label}` : ''}`
      : content.kind === 'release'
        ? `Shared a release${label ? `: ${label}` : ''}`
        : '';
  const text = content.body || shared;
  return text.length > 120 ? `${text.slice(0, 119)}…` : text;
}
