import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { radius, space } from '../../shared/theme';
import { useActivity } from '../data/activity';
import { c } from './ui';

export function ActivityBell() {
  const { unread } = useActivity();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? `Activity, ${unread} new` : 'Activity'}
      hitSlop={8}
      onPress={() => router.push('/activity')}
      style={styles.button}
    >
      <Ionicons name="notifications-outline" size={24} color={c.text} />
      {unread ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: { paddingHorizontal: space[16] },
  dot: {
    position: 'absolute',
    top: space[0],
    right: space[14],
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
    borderWidth: 1,
    borderColor: c.bg,
  },
});
