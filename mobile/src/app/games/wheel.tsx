// The Christmas Wheel — the SERVER picks the segment (CSPRNG); the wheel only animates to it.
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Path, Polygon, Text as SvgText } from 'react-native-svg';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { useCalm } from '@/state/prefs';
import { haptic } from '@/lib/haptics';
import { colors, space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Surface';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { CouponTicket, SignInGate } from '@/components/Common';
import { celebrate } from '@/components/Celebration';
import { targetRotation } from '@/features/games/geometry';
import type { Grant } from '@/api/types';

export default function Wheel() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const calm = useCalm();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const q = useQuery({ queryKey: ['wheel', lang, signedIn], queryFn: ({ signal }) => api.games.wheel({ signal }) });
  const rot = useSharedValue(0);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<Grant | null>(null);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

  const spin = async () => {
    if (spinning || !q.data) return;
    setSpinning(true);
    haptic.thud();
    try {
      const r = await api.games.spin();
      const to = targetRotation(r.segmentIndex, q.data.segments.length, rot.get());
      const reveal = () => { setWon(r.reward); celebrate(r.reward); setSpinning(false); void qc.invalidateQueries({ queryKey: ['wheel'] }); void qc.invalidateQueries({ queryKey: ['games'] }); };
      if (calm) { rot.set(to); reveal(); } else {
        rot.set(withTiming(to, { duration: 4200, easing: Easing.out(Easing.cubic) }));
        setTimeout(reveal, 4300);
      }
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
      setSpinning(false);
    }
  };

  if (!signedIn) return <Screen back title={t('games.wheel.title')}><SignInGate body={t('games.signInBody')} next="/games/wheel" /></Screen>;
  if (q.isLoading) return <Screen back title={t('games.wheel.title')}><LoadingState /></Screen>;
  if (q.isError || !q.data) return <Screen back title={t('games.wheel.title')}><ErrorState error={q.error} onRetry={() => q.refetch()} /></Screen>;
  const segs = q.data.segments;
  const n = segs.length || 1;
  const prize = won ?? q.data.lastReward;
  const R = 96;
  return (
    <Screen back title={t('games.wheel.title')}>
      <View style={{ alignItems: 'center' }} accessibilityLabel={t('games.wheel.aria')}>
        <Svg width={36} height={28} viewBox="0 0 36 28" style={{ marginBottom: -12, zIndex: 2 }}><Polygon points="18,28 2,0 34,0" fill={colors.accent} /></Svg>
        <Animated.View style={[{ width: 300, height: 300 }, a]}>
          <Svg width={300} height={300} viewBox="0 0 200 200">
            {segs.map((s, i) => {
              const a1 = (i / n) * Math.PI * 2 - Math.PI / 2;
              const a2 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
              const mid = (a1 + a2) / 2;
              return (
                <G key={s.id}>
                  <Path d={`M100 100 L${100 + Math.cos(a1) * R} ${100 + Math.sin(a1) * R} A${R} ${R} 0 0 1 ${100 + Math.cos(a2) * R} ${100 + Math.sin(a2) * R} Z`} fill={s.color || ['#c8102e', '#0f6b4f', '#f2c46d', '#2a4fa8'][i % 4]} stroke="#0b1430" strokeWidth={1} />
                  <SvgText x={100 + Math.cos(mid) * 62} y={100 + Math.sin(mid) * 62} fill="#fff" fontSize={8} fontWeight="700" textAnchor="middle" transform={`rotate(${(mid * 180) / Math.PI + 90} ${100 + Math.cos(mid) * 62} ${100 + Math.sin(mid) * 62})`}>{s.label.slice(0, 14)}</SvgText>
                </G>
              );
            })}
            <Circle cx={100} cy={100} r={R} fill="none" stroke={colors.accent} strokeWidth={5} />
            <Circle cx={100} cy={100} r={12} fill={colors.accent} />
          </Svg>
        </Animated.View>
      </View>
      {q.data.spunToday && !spinning ? <Text align="center" tone="muted">{t('games.wheel.rests')}</Text> : null}
      <Button label={spinning ? t('games.wheel.spinning') : t('games.wheel.spin')} loading={spinning} disabled={q.data.spunToday || spinning} onPress={spin} />
      {prize && !spinning ? (
        <Card tone="paper" style={{ gap: space.sm }}>
          <Text variant="eyebrow" tone="paperMuted">{t('games.wheel.today')}</Text>
          <Text variant="subheading" tone="paper">{prize.title}</Text>
          {prize.couponCode ? <CouponTicket code={prize.couponCode} title={t('games.wheel.code')} /> : null}
          {typeof prize.payload?.text === 'string' ? <Text tone="paperMuted">{prize.payload.text}</Text> : null}
        </Card>
      ) : null}
    </Screen>
  );
}
