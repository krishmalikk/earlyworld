import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontSize, fontWeight, radius, space } from '../../shared/theme';
import { follow } from '../data/actions';
import { errorMessage } from '../lib/firebase';
import { useLocal } from '../state/local';
import { tap } from '../lib/haptics';
import { c, ErrorLine } from './ui';

/** Follows a listener from a list row. `following` comes from the owner's shared subscription. */
export function FollowButton({
  uid,
  following,
  disabled = false,
}: {
  uid: string;
  following: boolean;
  disabled?: boolean;
}) {
  const currentUid = useLocal((state) => state.uid);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  if (!currentUid || currentUid === uid) return null;
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: following, busy, disabled }}
        disabled={disabled || busy}
        onPress={async () => {
          setBusy(true);
          setError(null);
          tap();
          try {
            await follow(currentUid, uid, 'user', following);
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
        style={({ pressed }) => [
          styles.button,
          following && styles.following,
          { opacity: disabled || busy ? 0.5 : pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.text, following && { color: c.text }]}>
          {following ? 'Following' : 'Follow'}
        </Text>
      </Pressable>
      <ErrorLine message={error} />
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end', flexShrink: 0, maxWidth: 160, gap: space[4] },
  button: {
    minHeight: 40,
    paddingHorizontal: space[16],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.accent,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  following: { backgroundColor: 'transparent', borderColor: c.line },
  text: { color: c.bg, fontSize: fontSize.label, fontWeight: fontWeight.bold },
});
