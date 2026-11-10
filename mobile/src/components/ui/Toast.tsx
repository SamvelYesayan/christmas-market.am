// In-app toasts (rewards, confirmations, errors). Announced to screen readers.
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { colors, radius, shadow, space } from '@/theme/tokens';
import { haptic } from '@/lib/haptics';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';

type Tone = 'info' | 'success' | 'reward' | 'error';
interface ToastItem { id: number; message: string; tone: Tone; icon?: IconName }

interface ToastState {
  items: ToastItem[];
  show: (message: string, opts?: { tone?: Tone; icon?: IconName; duration?: number }) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
export const useToasts = create<ToastState>((set, get) => ({
  items: [],
  show: (message, opts = {}) => {
    const id = ++seq;
    const tone = opts.tone ?? 'info';
    set({ items: [...get().items.slice(-2), { id, message, tone, icon: opts.icon }] });
    if (tone === 'error') haptic.error();
    else if (tone === 'reward' || tone === 'success') haptic.success();
    AccessibilityInfo.announceForAccessibility?.(message);
    setTimeout(() => get().dismiss(id), opts.duration ?? (tone === 'reward' ? 5200 : 3800));
  },
  dismiss: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
}));

export const toast = (message: string, opts?: Parameters<ToastState['show']>[1]) => useToasts.getState().show(message, opts);

const TONE_ICON: Record<Tone, IconName> = { info: 'info', success: 'check', reward: 'sparkle', error: 'alert' };
const TONE_COLOR: Record<Tone, string> = { info: colors.frost, success: colors.success, reward: colors.accent, error: colors.danger };

export function ToastHost() {
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);
  const insets = useSafeAreaInsets();
  useEffect(() => undefined, []);
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + space.sm }]}>
      {items.map((it) => (
        <Animated.View key={it.id} entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)}>
          <Pressable onPress={() => dismiss(it.id)} style={[styles.toast, { borderColor: TONE_COLOR[it.tone] }]} accessibilityRole="alert">
            <Icon name={it.icon ?? TONE_ICON[it.tone]} size={20} color={TONE_COLOR[it.tone]} />
            <Text variant="label" style={{ flex: 1 }}>{it.message}</Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: space.lg, right: space.lg, gap: space.sm, zIndex: 1000 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.raisedHi, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.lg, paddingVertical: space.md, ...shadow.lifted },
});
