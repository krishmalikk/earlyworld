import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { DocumentData, DocumentReference, Transaction } from 'firebase-admin/firestore';
import { db, FieldValue, hash, rateLimit, requiredText } from './core';
import {
  assertAdmin,
  bad,
  canView,
  publicProfile,
  quota,
  socialContext,
  socialId,
} from './social-core';
import {
  MESSAGE_LIMITS,
  conversationMembers,
  dmId,
  groupName,
  inboxStateFor,
  normalizeMessage,
  previewText,
  type InboxState,
} from '../../shared/messages';

/** Messaging has its own switch so it can open to beta listeners before public posting. */
async function messagingContext(r: CallableRequest) {
  const c = await socialContext(r);
  if (!c.admin && c.flags.messaging !== true)
    throw new HttpsError('failed-precondition', 'Messages are not available yet.');
  if (!c.user.onboardingComplete)
    throw new HttpsError('failed-precondition', 'Finish onboarding first.');
  if (r.auth?.token.email_verified !== true)
    throw new HttpsError('failed-precondition', 'Verify your email before messaging.');
  if (c.account.eligible !== true)
    throw new HttpsError('failed-precondition', 'Complete community eligibility first.');
  return c;
}

type Relation = { available: boolean; state: InboxState; crossesAgeBand: boolean };
/** Reads everything that decides whether `sender` may reach `recipient`, inside a transaction. */
async function relation(
  tx: Transaction,
  sender: string,
  recipient: string,
  senderBand: unknown,
): Promise<Relation> {
  const [blockA, blockB, account, user, follows, matchA, matchB] = await tx.getAll(
    db.doc(`_socialBlocks/${hash(`${sender}:${recipient}`)}`),
    db.doc(`_socialBlocks/${hash(`${recipient}:${sender}`)}`),
    db.doc(`_socialAccounts/${recipient}`),
    db.doc(`users/${recipient}`),
    db.doc(`users/${recipient}/following/${sender}`),
    db.doc(`users/${recipient}/matches/${sender}`),
    db.doc(`users/${sender}/matches/${recipient}`),
  );
  const a = account.data();
  return {
    available:
      !blockA.exists &&
      !blockB.exists &&
      !a?.suspended &&
      !a?.deleting &&
      user.data()?.onboardingComplete === true,
    state: inboxStateFor({
      recipientFollowsSender: follows.data()?.targetType === 'user',
      matched: matchA.exists || matchB.exists,
    }),
    crossesAgeBand: !!a?.ageBand && !!senderBand && a.ageBand !== senderBand,
  };
}
/** Teens and adults only reach each other through an existing follow or match. */
function assertReachable(r: Relation) {
  if (!r.available) throw new HttpsError('not-found', 'This listener is unavailable.');
  if (r.state === 'request' && r.crossesAgeBand)
    throw new HttpsError('failed-precondition', 'This listener isn’t accepting message requests.');
}
const rowRef = (uid: string, cid: string) => db.doc(`users/${uid}/conversations/${cid}`);
const shared = (c: DocumentData) => ({
  type: c.type,
  memberIds: c.memberIds,
  name: c.name || null,
  createdBy: c.createdBy,
});
function parse<T>(fn: () => T) {
  try {
    return fn();
  } catch (error) {
    bad(error);
  }
}
async function member(tx: Transaction, uid: string, cid: string) {
  const ref = db.doc(`conversations/${cid}`),
    snap = await tx.get(ref),
    c = snap.data();
  if (!c || !c.memberIds.includes(uid))
    throw new HttpsError('not-found', 'Conversation unavailable.');
  return { ref, c };
}

export const openConversation = onCall(async (r) => {
  const { uid, account } = await messagingContext(r);
  const others = parse(() => conversationMembers(uid, r.data?.memberIds)),
    name = parse(() => groupName(r.data?.name)),
    requestId = socialId(r.data?.requestId);
  await rateLimit(uid, 'openConversation', 30);
  const type = others.length === 1 ? 'dm' : 'group';
  const cid =
    type === 'dm' ? dmId(uid, others[0]) : `g_${hash(`${uid}:${requestId}`).slice(0, 40)}`;
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`conversations/${cid}`),
      existing = await tx.get(ref);
    if (existing.exists && type === 'group') return;
    const relations: Relation[] = [];
    for (const other of others) relations.push(await relation(tx, uid, other, account.ageBand));
    relations.forEach(assertReachable);
    if (existing.exists) {
      // Reopening a DM restores it for the opener without touching the other listener's inbox.
      const own = await tx.get(rowRef(uid, cid));
      if (own.exists && own.data()!.state !== 'inbox') tx.update(own.ref, { state: 'inbox' });
      return;
    }
    const now = FieldValue.serverTimestamp(),
      conversation = {
        type,
        memberIds: [uid, ...others],
        createdBy: uid,
        name: type === 'group' ? name : null,
      };
    tx.create(ref, { ...conversation, lastMessage: null, lastMessageAt: now, createdAt: now });
    tx.create(rowRef(uid, cid), {
      ...conversation,
      state: 'inbox',
      lastMessage: null,
      lastMessageAt: now,
      unread: 0,
      readAt: now,
    });
    // A DM reaches the recipient with its first message; group members see the group at once.
    if (type === 'group')
      others.forEach((other, i) =>
        tx.create(rowRef(other, cid), {
          ...conversation,
          state: relations[i].state,
          lastMessage: null,
          lastMessageAt: now,
          unread: 0,
          readAt: null,
        }),
      );
  });
  return { id: cid };
});

export const sendMessage = onCall(async (r) => {
  const { uid, account } = await messagingContext(r);
  const cid = socialId(r.data?.cid),
    requestId = socialId(r.data?.requestId),
    content = parse(() => normalizeMessage(r.data));
  await rateLimit(uid, 'message', MESSAGE_LIMITS.hourly);
  let label = '';
  if (content.kind !== 'text') {
    const item = await db
      .doc(content.kind === 'track' ? `tracks/${content.trackId}` : `releases/${content.releaseId}`)
      .get();
    if (!item.exists) throw new HttpsError('not-found', 'That item is no longer in the catalog.');
    label = item.data()!.title || '';
  }
  const messageRef = db.doc(
    `conversations/${cid}/messages/${hash(`${uid}:${requestId}`).slice(0, 40)}`,
  );
  await db.runTransaction(async (tx) => {
    if ((await tx.get(messageRef)).exists) return;
    const { ref, c } = await member(tx, uid, cid);
    const rows = await tx.getAll(...(c.memberIds as string[]).map((m) => rowRef(m, cid)));
    const charge = await quota(tx, uid, 'message', MESSAGE_LIMITS.daily);
    const states = new Map<string, InboxState>();
    for (const [i, m] of (c.memberIds as string[]).entries()) {
      if (m === uid) continue;
      const row = rows[i].data();
      if (c.type === 'dm') {
        const rel = await relation(tx, uid, m, account.ageBand);
        if (!rel.available)
          throw new HttpsError('failed-precondition', 'This conversation is no longer available.');
        // A later follow or match promotes a pending request; a declined one stays hidden.
        const state: InboxState =
          row?.state === 'declined'
            ? 'declined'
            : rel.state === 'inbox'
              ? 'inbox'
              : row?.state || 'request';
        if (state === 'request') {
          assertReachable(rel);
          if ((row?.requestCount || 0) >= MESSAGE_LIMITS.requestMessages)
            throw new HttpsError(
              'resource-exhausted',
              'Wait for them to accept your message request.',
            );
        }
        states.set(m, state);
      } else states.set(m, row?.state || 'request');
    }
    const now = FieldValue.serverTimestamp(),
      lastMessage = { senderId: uid, preview: previewText(content, label), at: now };
    charge();
    tx.create(messageRef, {
      uid,
      kind: content.kind,
      body: content.body,
      trackId: content.trackId,
      releaseId: content.releaseId,
      createdAt: now,
    });
    tx.update(ref, { lastMessage, lastMessageAt: now });
    (c.memberIds as string[]).forEach((m, i) => {
      const row = rows[i].data();
      if (m === uid) {
        tx.set(rows[i].ref, {
          ...shared(c),
          state: 'inbox',
          lastMessage,
          lastMessageAt: now,
          unread: 0,
          readAt: now,
        });
        return;
      }
      const state = states.get(m)!;
      tx.set(rows[i].ref, {
        ...shared(c),
        state,
        lastMessage,
        lastMessageAt: now,
        unread: (row?.unread || 0) + 1,
        readAt: row?.readAt || null,
        requestCount: (row?.requestCount || 0) + Number(c.type === 'dm' && state === 'request'),
      });
    });
  });
  return { id: messageRef.id };
});

export const respondToRequest = onCall(async (r) => {
  const { uid } = await messagingContext(r);
  const cid = socialId(r.data?.cid),
    accept = r.data?.accept === true;
  await db.runTransaction(async (tx) => {
    const { ref, c } = await member(tx, uid, cid);
    const own = await tx.get(rowRef(uid, cid));
    if (!own.exists) throw new HttpsError('not-found', 'Conversation unavailable.');
    if (accept) {
      tx.update(own.ref, { state: 'inbox' });
      return;
    }
    if (c.type === 'dm') {
      // Declining hides the request; the sender is not told.
      tx.update(own.ref, { state: 'declined', unread: 0 });
      return;
    }
    await leave(tx, ref, c, uid);
  });
  return { ok: true };
});

/** Removes one member from a group and keeps every remaining inbox row consistent. */
async function leave(tx: Transaction, ref: DocumentReference, c: DocumentData, uid: string) {
  const memberIds = (c.memberIds as string[]).filter((m) => m !== uid);
  const rows = await tx.getAll(...memberIds.map((m) => rowRef(m, ref.id)));
  const createdBy = c.createdBy === uid ? memberIds[0] || null : c.createdBy;
  tx.update(ref, { memberIds, createdBy });
  tx.delete(rowRef(uid, ref.id));
  rows.forEach((row) => row.exists && tx.update(row.ref, { memberIds, createdBy }));
}

export const leaveConversation = onCall(async (r) => {
  const { uid } = await socialContext(r);
  const cid = socialId(r.data?.cid);
  await db.runTransaction(async (tx) => {
    const { ref, c } = await member(tx, uid, cid);
    if (c.type !== 'group') throw new HttpsError('invalid-argument', 'Only groups can be left.');
    await leave(tx, ref, c, uid);
  });
  return { ok: true };
});

export const removeConversationMember = onCall(async (r) => {
  const { uid } = await messagingContext(r);
  const cid = socialId(r.data?.cid),
    target = socialId(r.data?.uid);
  await db.runTransaction(async (tx) => {
    const { ref, c } = await member(tx, uid, cid);
    if (c.type !== 'group' || c.createdBy !== uid || target === uid)
      throw new HttpsError('permission-denied', 'Only the group creator can remove people.');
    if (!c.memberIds.includes(target)) return;
    await leave(tx, ref, c, target);
  });
  return { ok: true };
});

export const addConversationMembers = onCall(async (r) => {
  const { uid, account } = await messagingContext(r);
  const cid = socialId(r.data?.cid);
  await rateLimit(uid, 'addMembers', 60);
  await db.runTransaction(async (tx) => {
    const { ref, c } = await member(tx, uid, cid);
    if (c.type !== 'group' || c.createdBy !== uid)
      throw new HttpsError('permission-denied', 'Only the group creator can add people.');
    const added = parse(() => conversationMembers(uid, r.data?.memberIds)).filter(
      (m) => !c.memberIds.includes(m),
    );
    if (!added.length) return;
    const memberIds = [...c.memberIds, ...added];
    if (memberIds.length > MESSAGE_LIMITS.groupMembers)
      throw new HttpsError(
        'invalid-argument',
        `Groups can have up to ${MESSAGE_LIMITS.groupMembers} people.`,
      );
    const relations: Relation[] = [];
    for (const m of added) relations.push(await relation(tx, uid, m, account.ageBand));
    relations.forEach(assertReachable);
    const rows = await tx.getAll(...(c.memberIds as string[]).map((m) => rowRef(m, cid)));
    const next = { ...c, memberIds };
    tx.update(ref, { memberIds });
    rows.forEach((row) => row.exists && tx.update(row.ref, { memberIds }));
    added.forEach((m, i) =>
      tx.set(rowRef(m, cid), {
        ...shared(next),
        state: relations[i].state,
        lastMessage: c.lastMessage || null,
        lastMessageAt: FieldValue.serverTimestamp(),
        unread: 0,
        readAt: null,
      }),
    );
  });
  return { ok: true };
});

export const renameConversation = onCall(async (r) => {
  const { uid } = await messagingContext(r);
  const cid = socialId(r.data?.cid),
    name = parse(() => groupName(r.data?.name));
  await db.runTransaction(async (tx) => {
    const { ref, c } = await member(tx, uid, cid);
    if (c.type !== 'group' || c.createdBy !== uid)
      throw new HttpsError('permission-denied', 'Only the group creator can rename it.');
    const rows = await tx.getAll(...(c.memberIds as string[]).map((m) => rowRef(m, cid)));
    tx.update(ref, { name });
    rows.forEach((row) => row.exists && tx.update(row.ref, { name }));
  });
  return { ok: true };
});

/** Exact-prefix username lookup for starting a conversation. */
export const searchUsers = onCall(async (r) => {
  const { uid } = await messagingContext(r);
  const query = requiredText(r.data?.query, 'username', 21).toLowerCase().replace(/^@/, '');
  if (!/^[a-z0-9_]{1,20}$/.test(query))
    throw new HttpsError('invalid-argument', 'Usernames use letters, numbers and underscores.');
  await rateLimit(uid, 'userSearch', 300);
  const docs = await db
    .collection('users')
    .where('usernameLower', '>=', query)
    .where('usernameLower', '<=', `${query}`)
    .orderBy('usernameLower')
    .limit(25)
    .get();
  const items = [];
  for (const d of docs.docs) {
    const p = d.data();
    // Only approved usernames are searchable; pending reservations stay private.
    if (d.id === uid || !p.username || !p.onboardingComplete) continue;
    if (!(await canView(uid, d.id))) continue;
    items.push(await publicProfile(d.id, p));
    if (items.length === 10) break;
  }
  return { items };
});

/** Moderator action for a reported message: the record stays, its content does not. */
export const removeReportedMessage = onCall(async (r) => {
  assertAdmin(r);
  const cid = socialId(r.data?.cid),
    id = socialId(r.data?.id);
  const ref = db.doc(`conversations/${cid}/messages/${id}`);
  await db.runTransaction(async (tx) => {
    const m = await tx.get(ref);
    if (!m.exists) return;
    tx.update(ref, {
      removed: true,
      body: '',
      trackId: null,
      releaseId: null,
      removedBy: r.auth!.uid,
    });
  });
  return { ok: true };
});
