import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, limit, orderBy, query } from '@react-native-firebase/firestore';
import { fontSize, fontWeight, lineHeight, radius, space } from '../../shared/theme';
import { MESSAGE_LIMITS } from '../../shared/messages';
import { call, db, errorMessage } from '../../src/lib/firebase';
import { useLocal } from '../../src/state/local';
import { useCollection, useDocument } from '../../src/data/listeners';
import { useCatalogIds, useCatalogPage } from '../../src/data/catalog';
import { markRead, useInbox, useProfiles } from '../../src/data/inbox';
import { respondToRequest, sendShared, sendText } from '../../src/data/messages';
import { newPostId } from '../../src/data/post-drafts';
import type { ChatMessage, Conversation, Track } from '../../src/data/types';
import { Artwork, c, ErrorLine, Field, s } from '../../src/components/ui';
import {
  conversationTitle,
  handle,
  MessageBubble,
  SmallButton,
} from '../../src/components/Messages';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    uid = useLocal((s) => s.uid);
  return <Chat key={`${uid}:${id}`} id={id} uid={uid} />;
}

function Chat({ id, uid }: { id: string; uid: string | null }) {
  const insets = useSafeAreaInsets();
  const [count, setCount] = useState<number>(MESSAGE_LIMITS.page);
  const convRef = useMemo(() => doc(db, 'conversations', id), [id]);
  const messagesRef = useMemo(
    () =>
      query(
        collection(db, 'conversations', id, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(count),
      ),
    [id, count],
  );
  const conversation = useDocument<Conversation>(convRef);
  const messages = useCollection<ChatMessage>(messagesRef, true);
  const inbox = useInbox();
  const row = [...inbox.conversations, ...inbox.requests].find((r) => r.id === id);
  const members = conversation.data?.memberIds || [];
  const profiles = useProfiles(members);
  const tracks = useCatalogIds(
    'tracks',
    messages.data.map((m) => m.trackId),
  );
  const releases = useCatalogIds(
    'releases',
    messages.data.map((m) => m.releaseId),
  );
  const visible = messages.data.filter((m) => !inbox.blocked.has(m.uid));
  const [body, setBody] = useState(''),
    [busy, setBusy] = useState(false),
    [sharing, setSharing] = useState(false),
    [error, setError] = useState<string | null>(null);
  // One id per drafted message: retries reuse it, edits and successful sends replace it.
  const requestId = useRef(newPostId());

  const unread = row?.unread || 0,
    latest = messages.data[0]?.id;
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  // Reading clears the badge only while the conversation is on screen.
  useEffect(() => {
    if (uid && row && unread > 0 && focused) void markRead(uid, id).catch(() => {});
  }, [uid, id, !!row, unread, latest, focused]);

  const title = conversation.data ? conversationTitle(conversation.data, uid, profiles.byId) : '';
  const isRequest = row?.state === 'request';
  const other = conversation.data?.type === 'dm' ? members.find((m) => m !== uid) || null : null;

  async function send() {
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendText(id, body, requestId.current);
      requestId.current = newPostId();
      setBody('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function share(track: Track) {
    setSharing(false);
    setError(null);
    try {
      await sendShared(id, { trackId: track.id });
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  function options(message: ChatMessage) {
    const mine = message.uid === uid;
    Alert.alert('Message', undefined, [
      ...(mine || message.removed
        ? []
        : [
            {
              text: 'Report message',
              onPress: () =>
                router.push({
                  pathname: '/community',
                  params: { reportKind: 'message', reportId: message.id, conversationId: id },
                }),
            },
          ]),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }
  function blockSender() {
    if (!other) return;
    Alert.alert(
      `Block ${handle(profiles.byId.get(other))}?`,
      'They won’t be able to message you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () =>
            void call('setUserBlock', { uid: other, blocked: true })
              .then(() => router.back())
              .catch((e) => setError(errorMessage(e))),
        },
      ],
    );
  }

  const unavailable = !conversation.loading && !conversation.data;
  return (
    <KeyboardAvoidingView
      style={[s.page, { flex: 1 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
    >
      <Stack.Screen
        options={{
          title,
          headerRight: () =>
            conversation.data ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Conversation details"
                hitSlop={8}
                onPress={() => router.push(`/messages/info/${id}`)}
              >
                <Ionicons name="information-circle-outline" size={24} color={c.text} />
              </Pressable>
            ) : null,
        }}
      />
      {unavailable ? (
        <View style={[s.body, { flex: 1 }]}>
          <Text style={s.text}>This conversation is no longer available.</Text>
        </View>
      ) : (
        <FlatList
          inverted
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: space[16], gap: space[10] }}
          data={visible}
          keyExtractor={(m) => m.id}
          keyboardShouldPersistTaps="handled"
          onEndReachedThreshold={0.3}
          onEndReached={() => {
            if (messages.data.length >= count) setCount((n) => n + MESSAGE_LIMITS.page);
          }}
          renderItem={({ item, index }) => {
            const older = visible[index + 1];
            return (
              <MessageBubble
                message={item}
                mine={item.uid === uid}
                author={profiles.byId.get(item.uid)}
                showAuthor={
                  conversation.data?.type === 'group' && item.uid !== uid && older?.uid !== item.uid
                }
                track={item.trackId ? tracks.byId.get(item.trackId) : undefined}
                release={item.releaseId ? releases.byId.get(item.releaseId) : undefined}
                onLongPress={() => options(item)}
              />
            );
          }}
          ListEmptyComponent={
            messages.loading ? null : (
              <Text style={[s.muted, { textAlign: 'center', transform: [{ scaleY: -1 }] }]}>
                Say hi — or share a track you think they’d like.
              </Text>
            )
          }
        />
      )}
      <ErrorLine
        message={error || messages.error || conversation.error}
        textStyle={{ paddingHorizontal: space[16] }}
      />
      {isRequest ? (
        <View style={[s.panel, { margin: space[12], marginBottom: insets.bottom + space[8] }]}>
          <Text style={[s.text, { fontWeight: fontWeight.bold }]}>
            {conversation.data?.type === 'group' ? 'Group invitation' : 'Message request'}
          </Text>
          <Text style={s.muted}>
            {conversation.data?.type === 'group'
              ? 'Accept to see new messages in your inbox. Declining leaves the group.'
              : `${handle(profiles.byId.get(other || ''))} isn’t connected to you. They won’t know you’ve seen this until you reply.`}
          </Text>
          <View style={[s.row, { flexWrap: 'wrap' }]}>
            <SmallButton
              label="Accept"
              onPress={() =>
                void respondToRequest(id, true).catch((e) => setError(errorMessage(e)))
              }
            />
            <SmallButton
              quiet
              label="Delete"
              onPress={() =>
                void respondToRequest(id, false)
                  .then(() => router.back())
                  .catch((e) => setError(errorMessage(e)))
              }
            />
            {other ? <SmallButton quiet label="Block" onPress={blockSender} /> : null}
          </View>
        </View>
      ) : unavailable ? null : (
        <>
          {sharing ? <SharePicker onPick={share} onClose={() => setSharing(false)} /> : null}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: space[8],
              paddingHorizontal: space[12],
              paddingTop: space[8],
              paddingBottom: insets.bottom + space[8],
              borderTopWidth: 1,
              borderColor: c.line,
              backgroundColor: c.bg,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share a track"
              onPress={() => setSharing(!sharing)}
              style={{ padding: space[8] }}
            >
              <Ionicons
                name={sharing ? 'close' : 'musical-notes-outline'}
                size={24}
                color={c.accent}
              />
            </Pressable>
            <TextInput
              accessibilityLabel="Message"
              placeholder="Message"
              placeholderTextColor={c.muted}
              selectionColor={c.accent}
              multiline
              maxLength={MESSAGE_LIMITS.body}
              value={body}
              onChangeText={(text) => {
                setBody(text);
                requestId.current = newPostId();
              }}
              style={{
                flex: 1,
                maxHeight: 120,
                color: c.text,
                fontSize: fontSize.body,
                lineHeight: lineHeight.content,
                backgroundColor: c.panel,
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: c.line,
                paddingHorizontal: space[14],
                paddingTop: space[10],
                paddingBottom: space[10],
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              accessibilityState={{ disabled: !body.trim() || busy, busy }}
              disabled={!body.trim() || busy}
              onPress={() => void send()}
              style={{
                padding: space[9],
                borderRadius: radius.pill,
                backgroundColor: c.accent,
                opacity: !body.trim() || busy ? 0.35 : 1,
              }}
            >
              <Ionicons name="arrow-up" size={20} color={c.bg} />
            </Pressable>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

/** Inline catalog search for sharing a track into the conversation. */
function SharePicker({ onPick, onClose }: { onPick: (t: Track) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const page = useCatalogPage('tracks', { text, enabled: text.trim().length > 1 });
  return (
    <View
      style={{
        maxHeight: 280,
        gap: space[8],
        padding: space[12],
        borderTopWidth: 1,
        borderColor: c.line,
        backgroundColor: c.panel,
      }}
    >
      <Field
        autoFocus
        accessibilityLabel="Search tracks to share"
        placeholder="Search tracks, artists, producers"
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => !text && onClose()}
      />
      {page.data.slice(0, 8).map((t) => (
        <Pressable
          key={t.id}
          accessibilityRole="button"
          accessibilityLabel={`Share ${t.title} by ${t.artistName}`}
          onPress={() => onPick(t)}
          style={[s.row, { minHeight: 44 }]}
        >
          <View style={{ borderRadius: radius.medium, overflow: 'hidden' }}>
            <Artwork uri={t.artworkUrl} name={t.title} size={36} />
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={s.text}>
              {t.title}
            </Text>
            <Text numberOfLines={1} style={s.muted}>
              {t.artistName}
              {t.producerName ? ` · prod. ${t.producerName}` : ''}
            </Text>
          </View>
          <Ionicons name="paper-plane-outline" size={18} color={c.accent} />
        </Pressable>
      ))}
    </View>
  );
}
