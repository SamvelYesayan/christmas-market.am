// Reward moments: a short gold sparkle burst + toast + success haptic. Skipped visually in calm mode.
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';
import { create } from 'zustand';
import { colors } from '@/theme/tokens';
import { usePrefs } from '@/state/prefs';
import { t } from '@/i18n';
import { toast } from './ui/Toast';
import { starPoints } from './ui/Icon';
import type { Achievement, Grant } from '@/api/types';

const useBurst = create<{ n: number; palette: 'gold' | 'frost'; fire: (p?: 'gold' | 'frost') => void }>((set, get) => ({
  n: 0,
  palette: 'gold',
  fire: (palette = 'gold') => set({ n: get().n + 1, palette }),
}));

export const burst = (palette?: 'gold' | 'frost') => {
  const s = usePrefs.getState();
  if (s.calm || s.systemReduceMotion) return;
  useBurst.getState().fire(palette);
};

/** Show a reward that the SERVER granted (never computed on the phone). */
export function celebrate(reward?: Grant | null, achievement?: Achievement | null) {
  if (reward) {
    burst();
    const msg = reward.kind === 'points'
      ? t('reward.stardust', { n: reward.points ?? 0, title: reward.title })
      : reward.kind === 'coupon' ? t('reward.code', { title: reward.title, code: reward.couponCode ?? '' }) : reward.title;
    toast(msg, { tone: 'reward', icon: reward.kind === 'coupon' ? 'ticket' : 'sparkle' });
  }
  if (achievement) {
    setTimeout(() => {
      burst('frost');
      toast(t('reward.achievement', { title: achievement.title }), { tone: 'reward', icon: 'star' });
    }, reward ? 900 : 0);
  }
}

function Particle({ i, total, run, color }: { i: number; total: number; run: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(0);
    p.set(withDelay((i % 5) * 30, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) })));
  }, [run, i, p]);
  const angle = (i / total) * Math.PI * 2;
  const dist = 90 + (i % 4) * 34;
  const a = useAnimatedStyle(() => ({
    opacity: p.value === 0 ? 0 : 1 - p.value,
    transform: [
      { translateX: Math.cos(angle) * dist * p.value },
      { translateY: Math.sin(angle) * dist * p.value + 60 * p.value * p.value },
      { scale: 1 - p.value * 0.4 },
      { rotate: `${p.value * 180}deg` },
    ],
  }));
  return (
    <Animated.View style={[styles.particle, a]}>
      <Svg width={14} height={14} viewBox="0 0 20 20"><Polygon points={starPoints(10, 10.5, 9)} fill={color} /></Svg>
    </Animated.View>
  );
}

export function CelebrationHost() {
  const n = useBurst((s) => s.n);
  const palette = useBurst((s) => s.palette);
  const { width, height } = useWindowDimensions();
  if (!n) return null;
  const tones = palette === 'gold' ? [colors.accent, colors.accentHi, '#FFFFFF'] : [colors.frost, '#FFFFFF', colors.accentHi];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 999 }]}>
      <View style={{ position: 'absolute', left: width / 2, top: height * 0.4 }}>
        {Array.from({ length: 22 }, (_, i) => <Particle key={`${n}-${i}`} i={i} total={22} run={n} color={tones[i % tones.length]} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ particle: { position: 'absolute', left: -7, top: -7 } });
