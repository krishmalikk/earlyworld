import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Tier } from '../../shared/domain';
export const c = {
  bg: '#0d0f0d',
  panel: '#161916',
  line: '#2c322b',
  text: '#e6e9df',
  muted: '#939d8c',
  accent: '#c1ef83',
  error: '#f6988f',
};
export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: c.bg },
  body: { padding: 18, gap: 18, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 29, fontWeight: '800', letterSpacing: -1.2, color: c.text },
  text: { fontSize: 14, lineHeight: 20, color: c.text },
  muted: { fontSize: 12, lineHeight: 18, color: c.muted },
  mono: {
    fontFamily: 'monospace',
    fontSize: 10,
    letterSpacing: 1.6,
    color: c.muted,
    textTransform: 'uppercase',
  },
  panel: { backgroundColor: c.panel, borderWidth: 1, borderColor: c.line, padding: 14, gap: 10 },
  input: {
    color: c.text,
    backgroundColor: c.panel,
    borderColor: c.line,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    minHeight: 48,
  },
  divider: { height: 1, backgroundColor: c.line },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  link: { fontSize: 12, color: c.accent },
  section: { gap: 12 },
  error: { color: c.error, fontSize: 12, lineHeight: 18 },
});
export function Page({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={s.page} edges={['left', 'right', 'bottom']}>
      {scroll ? (
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}
export function Heading({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={s.between}>
      <View style={{ gap: 5 }}>
        <Text style={s.mono}>{eyebrow}</Text>
        <Text style={s.title}>{title}</Text>
      </View>
      {right}
    </View>
  );
}
export function Button({
  children,
  onPress,
  disabled = false,
  quiet = false,
  busy = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  quiet?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 46,
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: quiet ? 'transparent' : c.accent,
        borderWidth: 1,
        borderColor: quiet ? c.line : c.accent,
        opacity: disabled ? 0.35 : pressed ? 0.65 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator size="small" color={quiet ? c.accent : c.bg} />
      ) : (
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.6,
            color: quiet ? c.text : c.bg,
          }}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}
export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={c.muted}
      selectionColor={c.accent}
      {...props}
      style={[s.input, props.style]}
    />
  );
}
export function ErrorLine({ message }: { message?: string | null }) {
  return message ? (
    <Text accessibilityRole="alert" style={s.error}>
      {message}
    </Text>
  ) : null;
}
export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={[s.panel, { paddingVertical: 30 }]}>
      <Ionicons name="disc-outline" size={25} color={c.muted} />
      <Text style={s.text}>{title}</Text>
      {detail ? <Text style={s.muted}>{detail}</Text> : null}
    </View>
  );
}
export function Artwork({
  uri,
  name,
  size = 48,
}: {
  uri?: string | null;
  name: string;
  size?: number;
}) {
  return uri ? (
    <Image
      source={{ uri }}
      accessibilityLabel={name}
      style={{ width: size, height: size, backgroundColor: c.panel }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: '#242c20',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      <Text style={{ color: c.accent, fontFamily: 'monospace', fontSize: size * 0.28 }}>
        {name.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}
const metal = {
  gold: ['#302817', '#e4c778'],
  platinum: ['#282e2e', '#d2dfdb'],
  multiplatinum: ['#242c37', '#b6c9e6'],
  diamond: ['#20322f', '#a2f2d9'],
};
export function TierBadge({ tier }: { tier: Tier }) {
  if (!tier) return null;
  const colors = metal[tier];
  return (
    <View
      accessibilityLabel={`${tier} certified`}
      style={{
        backgroundColor: colors[0],
        borderColor: colors[1],
        borderWidth: 1,
        padding: 3,
        alignSelf: 'flex-start',
      }}
    >
      <View
        style={{
          borderColor: colors[1] + '60',
          borderWidth: 1,
          paddingHorizontal: 7,
          paddingVertical: 4,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <Ionicons
          name={tier === 'diamond' ? 'diamond-outline' : 'disc-outline'}
          size={11}
          color={colors[1]}
        />
        <Text
          style={{
            fontFamily: 'monospace',
            fontSize: 8,
            fontWeight: '700',
            color: colors[1],
            letterSpacing: 0.9,
          }}
        >
          {tier === 'multiplatinum' ? 'MULTI-PLATINUM' : tier.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: selected ? c.accent : c.line,
        backgroundColor: selected ? '#26321d' : c.panel,
      }}
    >
      <Text style={{ color: selected ? c.accent : c.muted, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}
export function Section({
  title,
  children,
  style,
}: {
  title: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[s.section, style]}>
      <Text style={s.mono}>{title}</Text>
      {children}
    </View>
  );
}
