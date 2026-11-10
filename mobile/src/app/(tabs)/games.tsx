// The Frost Fair — games hub, today's challenges, and the doors to the Academy and Hidden Wonders.
// Plays left and rewards are decided by the server (/games, /challenges/today).
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { colors, space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Badge, Card, Row, SectionHeader } from '@/components/ui/Surface';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { Art } from '@/components/Art';
import { HiddenWonder } from '@/components/Common';
import { celebrate } from '@/components/Celebration';
import { GAME_ART } from '@/features/games/art';


function Challenges() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const user = useSession((s) => s.user);
  const q = useQuery({ queryKey: ['challenges', lang, user?.id], queryFn: ({ signal }) => api.games.challenges({ signal }) });
  const claim = useMutation({
    mutationFn: (id: number) => api.games.claimChallenge(id),
    onSuccess: (r) => { celebrate(r.reward); void qc.invalidateQueries({ queryKey: ['challenges'] }); void qc.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: (e: Error) => toast(e.message, { tone: 'error' }),
  });
  const list = q.data?.challenges ?? [];
  if (!list.length) return null;
  return (
    <Card tone="paper" style={{ gap: space.md }}>
      <Text variant="eyebrow" tone="paperMuted">{t('games.challenge')}</Text>
      {list.map((c) => (
        <View key={c.id} style={{ gap: space.sm }}>
          <Row justify="space-between" align="flex-start">
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong" tone="paper">{c.title}</Text>
              <Text variant="caption" tone="paperMuted">{c.description}</Text>
            </View>
            <Text variant="bodyStrong" tone="paper">+{c.rewardPoints}</Text>
          </Row>
          {c.claimed ? <Badge label={t('games.claimed')} tone="green" /> : user ? (
            <Button size="sm" variant="paper" label={c.complete ? t('games.claim') : t('games.notDone')} disabled={!c.complete || claim.isPending} loading={claim.isPending && claim.variables === c.id} onPress={() => claim.mutate(c.id)} style={{ alignSelf: 'flex-start' }} />
          ) : <Button size="sm" variant="paperOutline" label={t('common.signIn')} onPress={() => router.push('/login')} style={{ alignSelf: 'flex-start' }} />}
        </View>
      ))}
    </Card>
  );
}

export default function Games() {
  const { t, lang } = useI18n();
  const user = useSession((s) => s.user);
  const q = useQuery({ queryKey: ['games', lang, user?.id], queryFn: ({ signal }) => api.games.list({ signal }) });
  return (
    <Screen tabBar eyebrow={t('games.title')} title={`${t('games.h1a')} ${t('games.h1b')}`} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <HiddenWonder id="sugar-quill" style={{ right: 6, top: 0 }} />
      <Text tone="muted">{t('games.intro')}</Text>
      <Challenges />
      {q.isLoading ? <LoadingState label={t('games.setting')} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          {q.data?.games.map((g) => {
            const used = g.playsPerDay != null && g.playsToday >= g.playsPerDay;
            return (
              <Card key={g.key} style={{ width: '47.5%', gap: space.xs }} onPress={() => router.push(`/games/${g.key}` as never)} accessibilityLabel={g.title}>
                <View style={{ height: 96 }}><Art art={GAME_ART[g.key]} /></View>
                <Text variant="subheading" numberOfLines={2}>{g.title}</Text>
                <Text variant="caption" tone="muted" numberOfLines={3}>{g.description}</Text>
                {user && g.playsPerDay != null ? (
                  <Text variant="caption" tone={used ? 'faint' : 'accent'}>{used ? t('games.tomorrow') : t('games.playsLeft', { left: g.playsPerDay - g.playsToday, total: g.playsPerDay })}</Text>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}
      <Card tone="surface" onPress={() => router.push('/academy')} style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
        <View style={{ width: 64, height: 64 }}><Art art={{ type: 'wand', c1: '#e8dcc4', c2: '#a9c7ff' }} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="eyebrow" tone="accent">{t('academy.eyebrow')}</Text>
          <Text variant="subheading">{t('academy.title')}</Text>
          <Text variant="caption" tone="muted">{t('nav.academyHint')}</Text>
        </View>
      </Card>
      <View style={{ gap: space.sm }}>
        <SectionHeader eyebrow={t('games.rules')} title={t('games.rulesTitle')} />
        {[1, 2, 3, 4].map((i) => <Text key={i} variant="label" tone="muted"><Text variant="label" color={colors.text} font="bodyBold">{t(`games.rule${i}`)}</Text>{t(`games.rule${i}b`)}</Text>)}
      </View>
    </Screen>
  );
}
