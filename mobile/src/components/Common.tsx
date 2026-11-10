// Shared Christmas Market pieces: sign-in gate, hidden wonders, coupon ticket, snowfall, house crest.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { colors, radius, space } from '@/theme/tokens';
import { useI18n } from '@/i18n';
import { useCalm } from '@/state/prefs';
import { useSession } from '@/state/session';
import { api } from '@/api';
import { haptic } from '@/lib/haptics';
import { Text } from './ui/Text';
import { Button } from './ui/Button';
import { Card } from './ui/Surface';
import { Icon, starPoints } from './ui/Icon';
import { toast } from './ui/Toast';
import { burst, celebrate } from './Celebration';

/** Shown in place of content that needs an account. */
export function SignInGate({ body, next }: { body?: string; next?: string }) {
  const { t } = useI18n();
  return (
    <Card style={{ alignItems: 'center', gap: space.md }}>
      <Icon name="lock" size={28} color={colors.accent} />
      <Text align="center" tone="muted">{body ?? t('m.signInRequired')}</Text>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button label={t('m.signInCta')} onPress={() => router.push({ pathname: '/login', params: next ? { next } : {} })} />
        <Button label={t('m.registerCta')} variant="secondary" onPress={() => router.push({ pathname: '/register', params: next ? { next } : {} })} />
      </View>
    </Card>
  );
}

/**
 * A hidden wonder: a faint glimmer placed on a screen, like the website's. Finding it is recorded by the server
 * (POST /hidden/:key/find), which also decides the reward.
 */
export function HiddenWonder({ id, style }: { id: string; style?: StyleProp<ViewStyle> }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const calm = useCalm();
  const [found, setFound] = useState(false);
  const pulse = useSharedValue(0.35);
  useEffect(() => {
    if (calm) return;
    pulse.set(withRepeat(withTiming(0.85, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(pulse);
  }, [calm, pulse]);
  const a = useAnimatedStyle(() => ({ opacity: found ? 0.25 : pulse.value }));
  const find = async () => {
    if (found) return;
    haptic.press();
    burst();
    if (!signedIn) {
      toast(t('hidden.signIn'), { icon: 'sparkle' });
      return;
    }
    try {
      const r = await api.games.findHidden(id);
      setFound(true);
      if (r.alreadyFound) toast(t('hidden.already', { name: r.name }), { icon: 'sparkle' });
      else {
        celebrate(r.reward, r.achievement);
        toast(t('hidden.progress', { found: r.found ?? 0, total: r.total ?? 0 }), { icon: 'search' });
      }
      void qc.invalidateQueries({ queryKey: ['hidden'] });
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    }
  };
  return (
    <Animated.View style={[{ position: 'absolute', zIndex: 5 }, style, a]}>
      <Pressable onPress={find} accessibilityRole="button" accessibilityLabel={t('hidden.label')} hitSlop={14} style={{ padding: 6 }}>
        <Svg width={18} height={18} viewBox="0 0 24 24"><Path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" fill={colors.accentHi} /></Svg>
      </Pressable>
    </Animated.View>
  );
}

/** A cream ticket with a discount / reward code and copy action. */
export function CouponTicket({ code, title, note }: { code: string; title?: string; note?: string | null }) {
  const { t } = useI18n();
  return (
    <View style={styles.ticket}>
      <View style={styles.notchL} /><View style={styles.notchR} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text variant="eyebrow" tone="paperMuted">{title}</Text> : null}
        <Text variant="heading" tone="paper" selectable style={{ letterSpacing: 1.5 }}>{code}</Text>
        {note ? <Text variant="caption" tone="paperMuted">{note}</Text> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('m.copy')} ${code}`}
        onPress={async () => { await Clipboard.setStringAsync(code); haptic.success(); toast(t('m.copied'), { tone: 'success', icon: 'copy' }); }}
        style={styles.copy}
        hitSlop={8}
      >
        <Icon name="copy" size={18} color={colors.paperInk} />
      </Pressable>
    </View>
  );
}

/** Gently falling snow behind hero areas. Off in calm mode / reduce motion. */
export function Snowfall({ count = 18, height = 260 }: { count?: number; height?: number }) {
  const calm = useCalm();
  const { width } = useWindowDimensions();
  const flakes = useMemo(() => Array.from({ length: count }, (_, i) => ({ x: (i * 97) % width, r: 1 + (i % 3) * 0.8, d: 5000 + (i % 5) * 1400, delay: (i * 420) % 4000 })), [count, width]);
  if (calm) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height, overflow: 'hidden' }]}>
      {flakes.map((f, i) => <Flake key={i} {...f} height={height} />)}
    </View>
  );
}

function Flake({ x, r, d, delay, height }: { x: number; r: number; d: number; delay: number; height: number }) {
  const y = useSharedValue(-10);
  useEffect(() => {
    y.set(withDelay(delay, withRepeat(withTiming(height + 10, { duration: d, easing: Easing.linear }), -1, false)));
    return () => cancelAnimation(y);
  }, [y, d, delay, height]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { translateX: Math.sin(y.value / 40) * 6 }] }));
  return <Animated.View style={[{ position: 'absolute', left: x, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: 'rgba(246,248,255,0.75)' }, a]} />;
}

/** House crest: shield in house colours with a star. */
export function Crest({ color, accent, size = 64 }: { color: string; accent: string; size?: number }) {
  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 100 115">
      <Path d="M50 4 92 18v38c0 28-20 46-42 55C28 102 8 84 8 56V18L50 4Z" fill={color} stroke={accent} strokeWidth={4} />
      <Path d="M50 16 80 26v30c0 20-14 34-30 41-16-7-30-21-30-41V26l30-10Z" fill="none" stroke={accent} strokeOpacity={0.5} strokeWidth={1.5} />
      <Polygon points={starPoints(50, 56, 20)} fill={accent} />
      <Circle cx={50} cy={56} r={5} fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  ticket: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.paper, borderRadius: radius.md, paddingVertical: space.md, paddingHorizontal: space.xl, borderWidth: 1, borderColor: colors.paperEdge, borderStyle: 'dashed', overflow: 'hidden' },
  notchL: { position: 'absolute', left: -9, top: '50%', marginTop: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.bg },
  notchR: { position: 'absolute', right: -9, top: '50%', marginTop: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.bg },
  copy: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.paperEdge, alignItems: 'center', justifyContent: 'center' },
});
