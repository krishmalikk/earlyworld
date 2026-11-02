import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { fontSize, space } from '../../shared/theme';
import { Button, c, Field, s } from './ui';
import { UserLine } from './UserLine';

/** Track and post discussions share one composer and one row, even though they are stored apart. */
export function CommentComposer({
  value,
  onChange,
  onSubmit,
  busy,
}: {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  return (
    <View style={{ gap: space[10] }}>
      <Field
        accessibilityLabel="Comment"
        placeholder="Add to the conversation…"
        value={value}
        onChangeText={onChange}
        maxLength={1000}
        multiline
        editable={!busy}
      />
      <Button busy={busy} busyLabel="Posting…" disabled={!value.trim()} onPress={onSubmit}>
        Post comment
      </Button>
    </View>
  );
}

export function CommentRow({
  uid,
  body,
  createdAt,
  status = 'approved',
  reason,
  own,
  onDelete,
  onReport,
}: {
  uid: string;
  body: string;
  createdAt?: Date;
  status?: 'pending' | 'approved' | 'rejected' | string;
  reason?: string;
  own: boolean;
  onDelete?: () => void;
  onReport?: () => void;
}) {
  const note =
    status === 'approved' ? null : status === 'pending' ? 'Posting…' : reason || 'Not posted';
  return (
    <View style={styles.row}>
      <UserLine uid={uid} detail={createdAt ? createdAt.toLocaleDateString() : undefined} />
      <Text style={s.text}>{body}</Text>
      {note ? <Text style={s.muted}>{note}</Text> : null}
      <View style={styles.actions}>
        {own && onDelete ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() =>
              Alert.alert('Delete comment?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: onDelete },
              ])
            }
          >
            <Text style={styles.action}>Delete</Text>
          </Pressable>
        ) : null}
        {!own && onReport ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onReport}>
            <Text style={styles.action}>Report</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    gap: space[6],
    paddingVertical: space[10],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.line,
  },
  actions: { flexDirection: 'row', gap: space[16], minHeight: 28, alignItems: 'center' },
  action: { color: c.muted, fontSize: fontSize.label },
});
