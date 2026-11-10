// Rewards: achievements, codes waiting, and the reward history with each grant's Pioneer sync status.
import { View } from 'react-native';
import { useDashboard } from '@/api/queries';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { colors, space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card, Row, SectionHeader } from '@/components/ui/Surface';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { Art } from '@/components/Art';
import { CouponTicket, SignInGate } from '@/components/Common';
import { couponLabel } from '@/features/account/coupon';

const ACH_ICON: Record<string, string> = { snowflake: 'snowflake', crest: 'star', sleigh: 'sleigh', door: 'door', star: 'star', gift: 'giftbox', book: 'book', eye: 'key', card: 'card', heart: 'heart' };

export default function Rewards() {
  const { t, dateShort, has } = useI18n();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const dash = useDashboard();
  if (!signedIn) return <Screen back title={t('account.rewards')}><SignInGate next="/account/rewards" /></Screen>;
  const d = dash.data;
  return (
    <Screen back title={t('account.rewards')} refreshing={dash.isRefetching} onRefresh={() => dash.refetch()}>
      {dash.isLoading ? <LoadingState /> : dash.isError || !d ? <ErrorState error={dash.error} onRetry={() => dash.refetch()} /> : (
        <>
          <Card tone="paper" style={{ alignItems: 'center', gap: 2 }}>
            <Text variant="eyebrow" tone="paperMuted">{t('common.stardust')}</Text>
            <Text variant="number" tone="paper">{d.stardust}</Text>
            <Text variant="caption" tone="paperMuted">{t('account.earned')}</Text>
          </Card>
          <View>
            <SectionHeader title={t('account.achievements')} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
              {d.achievements.map((a) => (
                <Card key={a.key} tone={a.earnedAt ? 'raised' : 'outline'} style={{ width: '30.5%', alignItems: 'center', gap: 4, opacity: a.earnedAt ? 1 : 0.6 }} accessibilityLabel={`${a.title}${a.earnedAt ? '' : `, ${t('advent.s_locked')}`}`}>
                  <View style={{ width: 52, height: 52 }}>
                    <Art art={{ type: ACH_ICON[a.icon] ?? 'star', c1: a.earnedAt ? '#c8102e' : '#3a4566', c2: a.earnedAt ? '#f2c46d' : '#6b7896' }} glow={!!a.earnedAt} />
                  </View>
                  <Text variant="caption" font="bodyBold" align="center" numberOfLines={2}>{a.title}</Text>
                  {a.earnedAt ? <Text variant="caption" tone="accent">{dateShort(a.earnedAt)}</Text> : null}
                </Card>
              ))}
            </View>
          </View>
          {d.coupons.length ? (
            <View style={{ gap: space.md }}>
              <SectionHeader title={t('account.codes')} />
              {d.coupons.map((c) => <CouponTicket key={c.code} code={c.code} title={couponLabel(c, t)} note={[c.description, c.endsAt ? t('account.until', { date: dateShort(c.endsAt) }).replace(/^ · /, '') : null].filter(Boolean).join(' · ')} />)}
            </View>
          ) : null}
          <View style={{ gap: space.sm }}>
            <SectionHeader title={t('account.history')} />
            {d.rewards.length === 0 ? <Text tone="muted">{t('account.noRewards')}</Text> : d.rewards.map((r) => (
              <Row key={r.id} gap={space.md} align="flex-start" style={{ paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Icon name={r.kind === 'coupon' ? 'ticket' : r.kind === 'points' ? 'sparkle' : 'scroll'} size={18} color={colors.accent} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label">{r.title}</Text>
                  <Text variant="caption" tone="faint">{dateShort(r.createdAt)}{r.couponCode ? ` · ${r.couponCode}` : ''}{(r.points ?? 0) > 0 && r.pioneerSyncStatus && has(`account.sync_${r.pioneerSyncStatus}`) ? ` · ${t(`account.sync_${r.pioneerSyncStatus}`)}` : ''}</Text>
                </View>
                {(r.points ?? 0) > 0 ? <Text variant="bodyStrong" tone="success">+{r.points}</Text> : null}
              </Row>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
