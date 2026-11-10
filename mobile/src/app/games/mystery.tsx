// The Mystery Gift Box — one box a day; the server draws the reward and its rarity.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { useCalm } from '@/state/prefs';
import { haptic } from '@/lib/haptics';
import { space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Badge, Card } from '@/components/ui/Surface';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { Art } from '@/components/Art';
import { CouponTicket, SignInGate } from '@/components/Common';
import { celebrate } from '@/components/Celebration';
import type { Grant } from '@/api/types';

export default function Mystery() {
  const { t, lang, has } = useI18n();
  const qc = useQueryClient();
  const calm = useCalm();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const q = useQuery({ queryKey: ['mystery', lang, signedIn], queryFn: ({ signal }) => api.games.mystery({ signal }) });
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState<{ reward: Grant | null; rarity: string } | null>(null);
  const wobble = useSharedValue(0);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${wobble.value}deg` }, { scale: 1 + Math.abs(wobble.value) / 80 }] }));

  const open = async () => {
    if (busy || q.data?.openedToday) return;
    setBusy(true);
    haptic.thud();
    if (!calm) wobble.set(withSequence(withTiming(-8, { duration: 90 }), withTiming(8, { duration: 90 }), withTiming(-6, { duration: 90 }), withTiming(6, { duration: 90 }), withSpring(0)));
    try {
      const r = await api.games.openMystery();
      setWon(r);
      celebrate(r.reward);
      void qc.invalidateQueries({ queryKey: ['mystery'] });
      void qc.invalidateQueries({ queryKey: ['games'] });
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally { setBusy(false); }
  };

  if (!signedIn) return <Screen back title={t('games.mystery.title')}><SignInGate body={t('games.signInBody')} next="/games/mystery" /></Screen>;
  if (q.isLoading) return <Screen back title={t('games.mystery.title')}><LoadingState /></Screen>;
  if (q.isError || !q.data) return <Screen back title={t('games.mystery.title')}><ErrorState error={q.error} onRetry={() => q.refetch()} /></Screen>;
  const reward = won?.reward ?? q.data.lastReward;
  const rarity = won?.rarity ?? (q.data.lastReward?.payload?.rarity as string | undefined);
  const opened = q.data.openedToday || !!won;
  return (
    <Screen back title={t('games.mystery.title')}>
      <Text align="center" tone="muted">{opened ? t('games.mystery.midnight') : t('games.mystery.hint')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('games.mystery.aria')} disabled={opened || busy} onPress={open} style={{ alignItems: 'center' }}>
        <Animated.View style={[{ width: 240, height: 240 }, a]}>
          <Art art={{ type: 'giftbox', c1: '#2a4fa8', c2: '#f2c46d', mystery: !opened }} />
        </Animated.View>
        {!opened ? <Text variant="label" tone="accent">{t('m.tapToOpen')}</Text> : null}
      </Pressable>
      {reward ? (
        <Card tone="paper" style={{ gap: space.sm }}>
          {rarity && has(`games.mystery.${rarity}`) ? <Badge label={t(`games.mystery.${rarity}`)} tone={rarity === 'legendary' ? 'ember' : rarity === 'rare' ? 'gold' : 'muted'} /> : null}
          <Text variant="subheading" tone="paper">{reward.title}</Text>
          {reward.couponCode ? <CouponTicket code={reward.couponCode} title={t('games.mystery.code')} /> : null}
          {typeof reward.payload?.text === 'string' ? <Text tone="paperMuted">{reward.payload.text}</Text> : null}
        </Card>
      ) : null}
      <View />
    </Screen>
  );
}
