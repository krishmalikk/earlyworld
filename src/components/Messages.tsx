import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, fontWeight, lineHeight, radius, space } from '../../shared/theme';
import type { ChatMessage, InboxRow, Release, Stamp, Track, User } from '../data/types';
import { Artwork, c, s } from './ui';

export function Avatar({
  user,
  size = 40,
}: {
  user?: Pick<User, 'avatarUrl' | 'username'>;
  size?: number;
}) {
  return (
    <View style={{ borderRadius: radius.pill, overflow: 'hidden' }}>
      <Artwork uri={user?.avatarUrl} name={user?.username || 'ew'} size={size} />
    </View>
  );
}

/** Group avatars overlap the first two members; DMs show the other listener. */
export function ConversationAvatar({ people }: { people: (User | undefined)[] }) {
  if (people.length < 2) return <Avatar user={people[0]} size={46} />;
  return (
    <View style={{ width: 46, height: 46 }}>
      <View style={{ position: 'absolute', top: 0, left: 0 }}>
        <Avatar user={people[0]} size={32} />
      </View>
      <View
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          borderRadius: radius.pill,
          borderWidth: 2,
          borderColor: c.bg,
        }}
      >
        <Avatar user={people[1]} size={32} />
      </View>
    </View>
  );
}

export const handle = (user?: Pick<User, 'username'>) => `@${user?.username || 'listener'}`;

export function conversationTitle(
  row: Pick<InboxRow, 'type' | 'name' | 'memberIds'>,
  uid: string | null,
  profiles: ReadonlyMap<string, User>,
) {
  const others = row.memberIds.filter((m) => m !== uid);
  if (row.type === 'group' && row.name) return row.name;
  const names = others.map((m) => handle(profiles.get(m)));
  if (row.type === 'dm') return names[0] || 'Conversation';
  return names.length > 3
    ? `${names.slice(0, 3).join(', ')} +${names.length - 3}`
    : names.join(', ');
}

export function timeLabel(stamp?: Stamp | null) {
  if (!stamp) return '';
  const date = stamp.toDate(),
    minutes = (Date.now() - date.getTime()) / 60000;
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function PersonRow({
  user,
  detail,
  onPress,
  right,
  selected,
}: {
  user: User;
  detail?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={selected === undefined ? 'button' : 'checkbox'}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      accessibilityLabel={`${handle(user)}${detail ? `, ${detail}` : ''}`}
      onPress={onPress || (() => router.push(`/user/${user.id}`))}
      style={[s.row, { paddingVertical: space[8], minHeight: 48 }]}
    >
      <Avatar user={user} />
      <View style={{ flex: 1, gap: space[2] }}>
        <Text style={s.text} numberOfLines={1}>
          {handle(user)}
        </Text>
        {detail ? (
          <Text style={s.muted} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {selected !== undefined ? (
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={selected ? c.accent : c.muted}
        />
      ) : (
        right
      )}
    </Pressable>
  );
}

export function SmallButton({
  label,
  onPress,
  quiet = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  quiet?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: quiet ? c.line : c.accent,
        backgroundColor: quiet ? 'transparent' : c.accent,
        paddingHorizontal: space[14],
        paddingVertical: space[7],
        opacity: disabled ? 0.35 : pressed ? 0.65 : 1,
      })}
    >
      <Text
        style={{
          color: quiet ? c.text : c.bg,
          fontSize: fontSize.label,
          fontWeight: fontWeight.bold,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ConversationRow({
  row,
  uid,
  profiles,
}: {
  row: InboxRow;
  uid: string | null;
  profiles: ReadonlyMap<string, User>;
}) {
  const others = row.memberIds.filter((m) => m !== uid);
  const unread = row.unread > 0;
  const from =
    row.type === 'group' && row.lastMessage && row.lastMessage.senderId !== uid
      ? `${handle(profiles.get(row.lastMessage.senderId))}: `
      : row.lastMessage?.senderId === uid
        ? 'You: '
        : '';
  const title = conversationTitle(row, uid, profiles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}${unread ? ', unread' : ''}`}
      onPress={() => router.push(`/messages/${row.id}`)}
      style={({ pressed }) => [
        s.row,
        { paddingVertical: space[10], minHeight: 64, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <ConversationAvatar people={others.slice(0, 2).map((m) => profiles.get(m))} />
      <View style={{ flex: 1, gap: space[3] }}>
        <View style={s.between}>
          <Text
            numberOfLines={1}
            style={[s.text, { flex: 1, fontWeight: unread ? fontWeight.bold : fontWeight.regular }]}
          >
            {title}
          </Text>
          <Text style={[s.muted, { fontSize: fontSize.smallLabel }]}>
            {timeLabel(row.lastMessage?.at || row.lastMessageAt)}
          </Text>
        </View>
        <View style={s.between}>
          <Text numberOfLines={1} style={[s.muted, { flex: 1 }, unread ? { color: c.text } : null]}>
            {row.lastMessage ? `${from}${row.lastMessage.preview}` : 'New group'}
          </Text>
          {unread ? (
            <View
              accessibilityElementsHidden
              style={{ width: 9, height: 9, borderRadius: radius.pill, backgroundColor: c.accent }}
            />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Shared catalog items render as compact, tappable cards. */
export function SharedCard({
  message,
  track,
  release,
}: {
  message: ChatMessage;
  track?: Track;
  release?: Release;
}) {
  const item = track || release;
  const id = message.trackId || message.releaseId;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={item ? `${item.title} by ${item.artistName}` : 'Shared item'}
      onPress={() => id && router.push(message.trackId ? `/track/${id}` : `/release/${id}`)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[10],
        padding: space[8],
        borderRadius: radius.large,
        backgroundColor: c.artworkBg,
      }}
    >
      <View style={{ borderRadius: radius.medium, overflow: 'hidden' }}>
        <Artwork uri={item?.artworkUrl} name={item?.title || '♪'} size={48} />
      </View>
      <View style={{ flex: 1, gap: space[2] }}>
        <Text numberOfLines={1} style={[s.text, { fontWeight: fontWeight.bold }]}>
          {item?.title || 'Loading…'}
        </Text>
        <Text numberOfLines={1} style={s.muted}>
          {item?.artistName || ''}
        </Text>
        {track?.producerName ? (
          <Text numberOfLines={1} style={[s.link, { fontSize: fontSize.smallLabel }]}>
            prod. {track.producerName}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function MessageBubble({
  message,
  mine,
  author,
  showAuthor,
  track,
  release,
  onLongPress,
}: {
  message: ChatMessage;
  mine: boolean;
  author?: User;
  showAuthor: boolean;
  track?: Track;
  release?: Release;
  onLongPress: () => void;
}) {
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: space[3] }}>
      {showAuthor ? (
        <Text style={[s.muted, { fontSize: fontSize.smallLabel, marginLeft: space[12] }]}>
          {handle(author)}
        </Text>
      ) : null}
      <Pressable
        onLongPress={onLongPress}
        accessibilityHint="Long press for options"
        style={{
          maxWidth: '82%',
          gap: space[6],
          paddingHorizontal: space[12],
          paddingVertical: space[9],
          borderRadius: radius.card,
          backgroundColor: mine ? c.accent : c.panel,
          borderWidth: mine ? 0 : 1,
          borderColor: c.line,
        }}
      >
        {message.removed ? (
          <Text style={[s.muted, { fontStyle: 'italic' }]}>Removed by a moderator.</Text>
        ) : (
          <>
            {message.kind !== 'text' ? (
              <SharedCard message={message} track={track} release={release} />
            ) : null}
            {message.body ? (
              <Text
                style={{
                  color: mine ? c.bg : c.text,
                  fontSize: fontSize.body,
                  lineHeight: lineHeight.content,
                }}
              >
                {message.body}
              </Text>
            ) : null}
          </>
        )}
      </Pressable>
    </View>
  );
}
