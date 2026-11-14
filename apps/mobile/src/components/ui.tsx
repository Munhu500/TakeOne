import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text as RNText, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type TextProps, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, radius, useColors, type Colors } from '@/lib/theme';
import { create } from '@/lib/store';

type Tone = 'fg' | 'muted' | 'faint' | 'accent' | 'ok' | 'warn' | 'bad' | 'accentFg';
const SIZES = { xs: 11, sm: 13, md: 15, lg: 18, xl: 24, xxl: 32 } as const;
export function Text({ size = 'md', tone = 'fg', weight = 'regular', style, ...p }: TextProps & { size?: keyof typeof SIZES; tone?: Tone; weight?: keyof typeof font }) {
  const c = useColors();
  return <RNText {...p} style={[{ color: c[tone], fontSize: SIZES[size], fontFamily: font[weight], lineHeight: Math.round(SIZES[size] * 1.38), letterSpacing: SIZES[size] >= 24 ? -0.5 : 0 }, style]} />;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, small, style, textColor, ...p }: Omit<PressableProps, 'style'> & { title: string; textColor?: string; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean; icon?: ReactNode; small?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const bg = { primary: c.accent, secondary: c.raised, ghost: 'transparent', danger: `${c.bad}26` }[variant];
  const fg: Tone = variant === 'primary' ? 'accentFg' : variant === 'danger' ? 'bad' : 'fg';
  return (
    <Pressable {...p} accessibilityRole="button" accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }} disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => [{ backgroundColor: bg, borderRadius: radius.md, minHeight: small ? 36 : 50, paddingHorizontal: small ? 14 : 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: disabled ? 0.45 : pressed ? 0.8 : 1, borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0, borderColor: c.line }, style]}>
      {loading ? <ActivityIndicator color={c[fg]} /> : icon}
      <Text weight="semibold" size={small ? 'sm' : 'md'} tone={fg} style={textColor ? { color: textColor } : undefined}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[{ backgroundColor: c.surface, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, padding: 16 }, style]}>{children}</View>;
}
export function Badge({ label, tone = 'muted', icon }: { label: string; tone?: Tone; icon?: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: tone === 'muted' ? c.raised : `${c[tone]}22`, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3 }}>
      {icon}<Text size="xs" weight="medium" tone={tone}>{label}</Text>
    </View>
  );
}
export function Field({ label, error, hint, ...p }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text size="sm" tone="muted" weight="medium">{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={c.faint} {...p} style={[{ backgroundColor: c.raised, borderColor: error ? c.bad : c.line, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 48, color: c.fg, fontFamily: font.regular, fontSize: 15 }, p.multiline ? { paddingVertical: 12, minHeight: 90, textAlignVertical: 'top' } : null, p.style]} />
      {(error || hint) && <Text size="xs" tone={error ? 'bad' : 'faint'}>{error ?? hint}</Text>}
    </View>
  );
}
export function Chip({ label, on, onPress, plain }: { label: string; on: boolean; onPress: () => void; plain?: boolean }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={{ borderRadius: 99, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: on ? `${c.accent}26` : c.raised, borderWidth: 1, borderColor: on ? c.accent : c.line }}>
      <Text size="sm" weight="medium" tone={on ? 'fg' : 'muted'} style={plain ? undefined : { textTransform: 'capitalize' }}>{label}</Text>
    </Pressable>
  );
}
export function Skeleton({ height = 20, width, style }: { height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const o = useSharedValue(0.5);
  useEffect(() => { o.value = withRepeat(withTiming(1, { duration: 700 }), -1, true); }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View accessibilityLabel="Loading" style={[{ height, width: width ?? '100%', borderRadius: radius.md, backgroundColor: c.raised }, a, style]} />;
}
export function Screen({ children, scroll = true, padded = true, edges = true, footer }: { children: ReactNode; scroll?: boolean; padded?: boolean; edges?: boolean; footer?: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const pad = { paddingHorizontal: padded ? 20 : 0, paddingTop: (edges ? insets.top : 0) + (padded ? 12 : 0), paddingBottom: 28 };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {scroll ? <ScrollView contentContainerStyle={[pad, { gap: 16 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView> : <View style={[{ flex: 1 }, pad]}>{children}</View>}
      {footer && <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, backgroundColor: c.bg }}>{footer}</View>}
    </View>
  );
}
export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return <View style={{ alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24 }}><Text weight="semibold" size="lg" style={{ textAlign: 'center' }}>{title}</Text>{body && <Text tone="muted" size="sm" style={{ textAlign: 'center' }}>{body}</Text>}{action && <View style={{ marginTop: 10 }}>{action}</View>}</View>;
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return <Empty title="Couldn’t load this" body={error instanceof Error ? error.message : 'Check your connection and try again.'} action={retry ? <Button small variant="secondary" title="Try again" onPress={retry} /> : undefined} />;
}
export function Row({ children, gap = 8, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const hue = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360;
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue}, 55%, 42%)`, alignItems: 'center', justifyContent: 'center' }}><RNText style={{ color: '#fff', fontFamily: font.semibold, fontSize: size * 0.36 }}>{name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</RNText></View>;
}
export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'ok' }) {
  const c = useColors();
  return <View accessibilityRole="progressbar" accessibilityValue={{ now: Math.round(value * 100), min: 0, max: 100 }} style={{ height: 6, borderRadius: 3, backgroundColor: c.raised, overflow: 'hidden' }}><View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: 6, backgroundColor: c[tone] }} /></View>;
}

// ── toast ──
const toastStore = create<{ text: string; tone: 'ok' | 'bad' } | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;
export function toast(text: string, tone: 'ok' | 'bad' = 'ok') {
  toastStore.set({ text, tone });
  clearTimeout(timer);
  timer = setTimeout(() => toastStore.set(null), 3500);
}
export const toastError = (e: unknown) => toast(e instanceof Error ? e.message : 'Something went wrong', 'bad');
export function ToastHost() {
  const t = toastStore.use();
  const c: Colors = useColors();
  const insets = useSafeAreaInsets();
  if (!t) return null;
  return <View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 10, backgroundColor: c.raised, borderRadius: radius.md, borderWidth: 1, borderColor: t.tone === 'ok' ? c.ok : c.bad, padding: 14, zIndex: 100 }}><Text size="sm" weight="medium">{t.text}</Text></View>;
}
