// Loading, empty and error states — designed, never a bare spinner or raw error.
import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { colors, radius, space } from '@/theme/tokens';
import { useI18n } from '@/i18n';
import { useCalm } from '@/state/prefs';
import { isApiError } from '@/api/client';
import { Text } from './Text';
import { Button } from './Button';
import { starPoints } from './Icon';
import { Art } from '../Art';
import type { Art as ArtSpec } from '@/api/types';

/** A small swinging lantern — the app's loading mark. */
export function Lantern({ size = 56 }: { size?: number }) {
  const calm = useCalm();
  const swing = useSharedValue(0);
  const glow = useSharedValue(0.6);
  useEffect(() => {
    if (calm) return;
    swing.set(withRepeat(withSequence(withTiming(6, { duration: 900 }), withTiming(-6, { duration: 900 })), -1, true));
    glow.set(withRepeat(withTiming(1, { duration: 700 }), -1, true));
    return () => { cancelAnimation(swing); cancelAnimation(glow); };
  }, [calm, swing, glow]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${swing.value}deg` }], opacity: 0.6 + glow.value * 0.4 }));
  return (
    <Animated.View style={[{ width: size, height: size * 1.3, transformOrigin: 'top' }, a]}>
      <Svg width={size} height={size * 1.3} viewBox="0 0 40 52">
        <Path d="M20 0v6" stroke={colors.accentLo} strokeWidth={1.5} />
        <Path d="M13 10h14l-2-4H15l-2 4Z" fill={colors.accentLo} />
        <Path d="M12 10h16l3 30H9l3-30Z" fill="rgba(242,196,109,0.18)" stroke={colors.accent} strokeWidth={1.4} />
        <Circle cx={20} cy={26} r={6} fill={colors.accent} opacity={0.9} />
        <Polygon points={starPoints(20, 26, 3)} fill={colors.accentHi} />
        <Path d="M8 40h24v4H8z" fill={colors.accentLo} />
      </Svg>
    </Animated.View>
  );
}

export function LoadingState({ label, style }: { label?: string; style?: StyleProp<ViewStyle> }) {
  const { t } = useI18n();
  return (
    <View style={[styles.center, style]} accessibilityRole="progressbar" accessibilityLabel={label ?? t('common.loading')}>
      <Lantern />
      <Text variant="label" tone="muted" align="center">{label ?? t('common.loading')}</Text>
    </View>
  );
}

export function EmptyState({ title, body, art, action, onAction, style }: { title: string; body?: string; art?: ArtSpec; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.center, style]}>
      {art ? <View style={{ width: 120, height: 120 }}><Art art={art} /></View> : null}
      <Text variant="heading" align="center">{title}</Text>
      {body ? <Text tone="muted" align="center">{body}</Text> : null}
      {action && onAction ? <Button label={action} onPress={onAction} style={{ marginTop: space.sm }} /> : null}
    </View>
  );
}

/** Turns any error into a friendly message + retry. Offline / timeouts get their own copy. */
export function ErrorState({ error, onRetry, style, compact }: { error: unknown; onRetry?: () => void; style?: StyleProp<ViewStyle>; compact?: boolean }) {
  const { t } = useI18n();
  const message = errorMessage(error, t);
  return (
    <View style={[compact ? styles.compact : styles.center, style]} accessibilityRole="alert">
      {!compact ? (
        <Svg width={64} height={64} viewBox="0 0 64 64">
          <Circle cx={32} cy={32} r={30} fill={colors.surface} stroke={colors.border} />
          <Path d="M20 38c4-6 20-6 24 0M24 26h.5M40 26h.5" stroke={colors.textMuted} strokeWidth={3} strokeLinecap="round" />
        </Svg>
      ) : null}
      {!compact ? <Text variant="subheading" align="center">{t('m.errorTitle')}</Text> : null}
      <Text tone="muted" align={compact ? 'left' : 'center'}>{message}</Text>
      {onRetry ? <Button label={t('m.retry')} icon="refresh" variant="secondary" size="sm" onPress={onRetry} style={{ marginTop: space.xs, alignSelf: compact ? 'flex-start' : 'center' }} /> : null}
    </View>
  );
}

export function errorMessage(error: unknown, t: (k: string) => string): string {
  if (isApiError(error)) {
    if (error.code === 'network') return t('m.offline');
    if (error.code === 'timeout') return t('m.timeout');
    if (error.status >= 500 && error.code === 'error') return t('m.serverDown');
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return t('common.error');
}

/** Inline error banner for forms. */
export function FormError({ error }: { error: unknown }) {
  const { t } = useI18n();
  if (!error) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Text variant="label" color={colors.danger}>{typeof error === 'string' ? error : errorMessage(error, t)}</Text>
    </View>
  );
}

/** Shimmering placeholder block. */
export function Skeleton({ height = 16, width = '100%', radius: r = radius.sm, style }: { height?: number; width?: DimensionValue; radius?: number; style?: StyleProp<ViewStyle> }) {
  const calm = useCalm();
  const o = useSharedValue(0.5);
  useEffect(() => {
    if (calm) return;
    o.set(withRepeat(withTiming(1, { duration: 800 }), -1, true));
    return () => cancelAnimation(o);
  }, [calm, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height, width, borderRadius: r, backgroundColor: colors.raised }, a, style]} />;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xxl, flexGrow: 1 },
  compact: { gap: space.sm, paddingVertical: space.md },
  banner: { borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,122,136,0.4)', backgroundColor: 'rgba(200,16,46,0.12)', padding: space.md },
});
