import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  radius,
  space,
  tracking,
} from '../../shared/theme';
import React, { createContext, useContext } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Tier } from '../../shared/domain';
import { colors as c, tierColors as metal } from '../../shared/brand';
export { colors as c } from '../../shared/brand';
export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: c.bg },
  body: { padding: space[18], gap: space[18], paddingBottom: space[40] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[10] },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[12],
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.heavy,
    letterSpacing: tracking.title,
    color: c.text,
  },
  displayTitle: {
    fontFamily: fontFamily.display,
    fontWeight: fontWeight.regular,
    fontSize: fontSize.studio,
    letterSpacing: tracking.brand,
  },
  text: { fontSize: fontSize.body, lineHeight: lineHeight.content, color: c.text },
  muted: { fontSize: fontSize.label, lineHeight: lineHeight.body, color: c.muted },
  mono: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    letterSpacing: tracking.mono,
    color: c.muted,
    textTransform: 'uppercase',
  },
  panel: {
    backgroundColor: c.panel,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.line,
    padding: space[14],
    gap: space[10],
  },
  input: {
    borderRadius: radius.large,
    color: c.text,
    backgroundColor: c.panel,
    borderColor: c.line,
    borderWidth: 1,
    padding: space[14],
    fontSize: fontSize.body,
    minHeight: 48,
  },
  divider: { height: 1, backgroundColor: c.line },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[10] },
  link: { fontSize: fontSize.label, color: c.accent },
  section: { gap: space[12] },
  error: { color: c.error, fontSize: fontSize.label, lineHeight: lineHeight.body },
});
// The tab navigator already reserves the home-indicator area below its scenes.
// Root stack screens retain their own bottom protection.
export const BottomInsetHandledContext = createContext(false);
export function Page({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const bottomInsetHandled = useContext(BottomInsetHandledContext);
  return (
    <SafeAreaView
      style={s.page}
      edges={bottomInsetHandled ? ['left', 'right'] : ['left', 'right', 'bottom']}
    >
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
  eyebrow?: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={s.between}>
      <View style={{ flex: 1, gap: space[5] }}>
        {eyebrow ? <Text style={s.mono}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={s.title}>
          {title}
        </Text>
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
  busyLabel,
  textStyle,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  quiet?: boolean;
  busy?: boolean;
  busyLabel?: string;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      accessibilityState={{ disabled: disabled || busy, busy }}
      accessibilityLabel={busy ? busyLabel || 'In progress' : undefined}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 46,
        borderRadius: radius.large,
        paddingHorizontal: space[16],
        paddingVertical: space[12],
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: quiet ? 'transparent' : c.accent,
        borderWidth: 1,
        borderColor: quiet ? c.line : c.accent,
        opacity: disabled ? 0.35 : pressed ? 0.65 : 1,
      })}
    >
      {busy ? (
        <View style={s.row}>
          <ActivityIndicator size="small" color={quiet ? c.accent : c.bg} />
          {busyLabel ? (
            <Text style={[s.text, { color: quiet ? c.text : c.bg }, textStyle]}>{busyLabel}</Text>
          ) : null}
        </View>
      ) : (
        <Text
          style={[
            {
              fontSize: fontSize.label,
              fontWeight: fontWeight.bold,
              letterSpacing: tracking.button,
              color: quiet ? c.text : c.bg,
            },
            textStyle,
          ]}
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
export function ErrorLine({
  message,
  textStyle,
}: {
  message?: string | null;
  textStyle?: StyleProp<TextStyle>;
}) {
  return message ? (
    <Text accessibilityRole="alert" style={[s.error, textStyle]}>
      {message}
    </Text>
  ) : null;
}
export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={[s.panel, { paddingVertical: space[30] }]}>
      <Ionicons name="disc-outline" size={25} color={c.muted} />
      <Text style={s.text}>{title}</Text>
      {detail ? <Text style={s.muted}>{detail}</Text> : null}
    </View>
  );
}
export { Artwork } from './Artwork';
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
        padding: space[3],
        alignSelf: 'flex-start',
      }}
    >
      <View
        style={{
          borderColor: colors[1] + '60',
          borderWidth: 1,
          paddingHorizontal: space[7],
          paddingVertical: space[4],
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[5],
        }}
      >
        <Ionicons
          name={tier === 'diamond' ? 'diamond-outline' : 'disc-outline'}
          size={11}
          color={colors[1]}
        />
        <Text
          style={{
            fontFamily: fontFamily.mono,
            fontSize: fontSize.micro,
            fontWeight: fontWeight.bold,
            color: colors[1],
            letterSpacing: tracking.badge,
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
  textStyle,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={{
        borderRadius: radius.pill,
        paddingHorizontal: space[16],
        paddingVertical: space[10],
        borderWidth: 1,
        borderColor: selected ? c.accent : c.line,
        backgroundColor: selected ? c.accent : c.panel,
      }}
    >
      <Text style={[{ color: selected ? c.bg : c.muted, fontSize: fontSize.label }, textStyle]}>
        {label}
      </Text>
    </Pressable>
  );
}
export function Section({
  title,
  children,
  style,
  right,
}: {
  title: string;
  children: React.ReactNode;
  style?: ViewStyle;
  right?: React.ReactNode;
}) {
  return (
    <View style={[s.section, style]}>
      <View style={s.between}>
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            color: c.text,
            fontSize: fontSize.section,
            fontWeight: fontWeight.bold,
          }}
        >
          {title}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );
}
