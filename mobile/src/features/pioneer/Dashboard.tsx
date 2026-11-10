// My Pioneer Card — everything shown comes from GET /pioneer/summary, which the server reads from Magical.
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import { refreshUserData } from '@/api/queries';
import { useI18n } from '@/i18n';
import { points, signedPoints } from '@/lib/format';
import { colors, palette, radius, space } from '@/theme/tokens';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card, Row, SectionHeader } from '@/components/ui/Surface';
import { ErrorState } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { toast } from '@/components/ui/Toast';
import { CouponTicket } from '@/components/Common';
import { CardVisual } from './CardVisual';
import { activityState, balanceView, rewardState, txLabel } from './logic';
import type { PioneerReward, PioneerSummary } from '@/api/types';

type Linked = Extract<PioneerSummary, { linked: true }>;

export function BalancePanel({ s, refreshing, onRefresh }: { s: Linked; refreshing: boolean; onRefresh: () => void }) {
  const { t, dateShort, dateTime } = useI18n();
  const b = balanceView(s);
  return (
    <Card tone="paper" style={{ gap: space.sm }} accessibilityLabel={b.kind === 'live' ? `${t('pc.points')} ${points(b.points)}` : t('pc.unavailableNow')}>
      <Text variant="eyebrow" tone="paperMuted">{t('pc.points')}</Text>
      <Text variant="number" tone="paper" testID="pc-balance">{b.kind === 'live' ? points(b.points) : '—'}</Text>
      {b.kind === 'live' ? (
        <Row gap={6}><Icon name="sparkle" size={14} color={palette.emerald} /><Text variant="caption" tone="paperMuted">{t('pc.live')} · {dateTime(b.asOf)}</Text></Row>
      ) : null}
      {b.kind === 'stale' ? (
        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.primary} testID="pc-stale">{t('pc.unavailableNow')}</Text>
          {b.lastConfirmed ? <Text variant="caption" tone="paperMuted">{t('pc.lastConfirmed', { n: points(b.lastConfirmed.points), date: dateShort(b.lastConfirmed.asOf) })}</Text> : null}
        </View>
      ) : null}
      {s.card.status === 'inactive' ? <Text variant="label" color={colors.primary}>{t('pc.cardInactive')}</Text> : null}
      <Button variant="paperOutline" size="sm" icon="refresh" label={refreshing ? t('pc.refreshing') : t('pc.refresh')} loading={refreshing} onPress={onRefresh} style={{ alignSelf: 'flex-start', marginTop: space.xs }} testID="pc-refresh" />
    </Card>
  );
}

function Reward({ r, balance }: { r: PioneerReward; balance: number | null }) {
  const { t } = useI18n();
  const [check, setCheck] = useState(false);
  const elig = useQuery({ queryKey: ['eligibility', r.id], queryFn: ({ signal }) => api.pioneer.eligibility(r.id, { signal }), enabled: check, staleTime: 0 });
  const st = rewardState(elig.data ? { ...r, ...elig.data } as PioneerReward : r, t);
  return (
    <Card style={{ gap: space.sm }}>
      <Text variant="bodyStrong">{r.title}</Text>
      {r.description ? <Text variant="caption" tone="muted">{r.description}</Text> : null}
      <Row justify="space-between">
        <Text variant="label" tone="accent">{t('common.points', { n: points(r.pointsCost) })}</Text>
        <Text variant="caption" tone={st.ok ? 'success' : 'muted'}>{st.text}</Text>
      </Row>
      {st.short && balance != null ? (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' }}>
          <View style={{ height: 6, width: `${Math.max(4, Math.min(100, (balance / r.pointsCost) * 100))}%`, backgroundColor: colors.accent, borderRadius: radius.pill }} />
        </View>
      ) : null}
      <Button variant="ghost" size="sm" label={t('m.checkEligibility')} loading={elig.isFetching} onPress={() => (check ? elig.refetch() : setCheck(true))} style={{ alignSelf: 'flex-start' }} />
      {elig.isError ? <Text variant="caption" tone="danger">{(elig.error as Error).message}</Text> : null}
      {elig.data ? <Text variant="caption" tone={elig.data.eligible ? 'success' : 'muted'}>{elig.data.eligible ? t('m.eligibleNow') : t('m.notEligibleNow')}</Text> : null}
    </Card>
  );
}

function Transactions({ first }: { first: Linked['transactions'] }) {
  const { t, dateShort, has } = useI18n();
  const [page, setPage] = useState(first?.page ?? 1);
  const q = useQuery({ queryKey: ['pioneerTx', page], queryFn: ({ signal }) => api.pioneer.transactions(page, { signal }), enabled: page !== (first?.page ?? 1), placeholderData: (prev) => prev });
  const data = page === (first?.page ?? 1) ? first : q.data;
  if (!first) return <Text tone="muted">{t('pc.unavailable')}</Text>;
  const items = data?.items ?? [];
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize || 20)));
  return (
    <View style={{ gap: space.sm }}>
      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} compact /> : null}
      {items.length === 0 ? <Text tone="muted">{t('pc.noHistory')}</Text> : items.map((h) => (
        <Row key={String(h.id)} gap={space.md} style={{ paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label">{txLabel(h.type, h.label, t, has)}</Text>
            <Text variant="caption" tone="faint">{dateShort(h.createdAt)}{h.description ? ` · ${h.description}` : ''}</Text>
          </View>
          <Text variant="bodyStrong" tone={h.amount >= 0 ? 'success' : 'danger'}>{signedPoints(h.amount)}</Text>
        </Row>
      ))}
      {pages > 1 ? (
        <Row justify="space-between">
          <Button variant="ghost" size="sm" label={t('pc.prev')} disabled={page <= 1 || q.isFetching} onPress={() => setPage(page - 1)} />
          <Text variant="caption" tone="muted">{t('pc.pageOf', { page, pages })}</Text>
          <Button variant="ghost" size="sm" label={t('pc.next')} disabled={page >= pages || q.isFetching} onPress={() => setPage(page + 1)} />
        </Row>
      ) : null}
    </View>
  );
}

export function Dashboard({ s, refreshing, onRefresh, onChanged }: { s: Linked; refreshing: boolean; onRefresh: () => void; onChanged: () => void }) {
  const { t, dateShort, has } = useI18n();
  const qc = useQueryClient();
  const [disconnecting, setDisconnecting] = useState(false);
  const balance = s.live && s.balance ? s.balance.points : null;
  const credits = s.activity.filter((x) => x.kind === 'credit');
  const debits = s.activity.filter((x) => x.kind === 'debit');
  const disconnect = () => Alert.alert(t('pc.disconnectTitle'), t('pc.disconnectBody'), [
    { text: t('pc.cancel'), style: 'cancel' },
    {
      text: t('pc.disconnectYes'), style: 'destructive', onPress: async () => {
        setDisconnecting(true);
        try {
          await api.pioneer.unlink();
          toast(t('pc.disconnected'), { icon: 'lock' });
          await refreshUserData();
          void qc.invalidateQueries();
          onChanged();
        } catch (e) {
          toast((e as Error).message, { tone: 'error' });
        } finally {
          setDisconnecting(false);
        }
      },
    },
  ]);
  const activityRow = (x: Linked['activity'][number]) => {
    const st = activityState(x, t, has);
    return (
      <View key={x.id} style={{ paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 4 }}>
        <Row gap={space.md}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label">{x.title ?? '—'}</Text>
            <Text variant="caption" tone={st.tone}>{dateShort(x.createdAt)} · {st.text}</Text>
          </View>
          <Text variant="bodyStrong" tone={x.kind === 'credit' ? 'success' : 'danger'}>{x.kind === 'credit' ? '+' : '−'}{points(x.points)}</Text>
        </Row>
        {x.status === 'done' && x.couponCode ? <CouponTicket code={x.couponCode} title={t('pc.yourCode')} /> : null}
        {x.status === 'done' && x.fulfilment === 'awaiting_handover' ? <Text variant="caption" tone="muted">{t('pc.collect')}</Text> : null}
        {x.fulfilment === 'handed_over' ? <Text variant="caption" tone="muted">{t('pc.handedOver')}</Text> : null}
      </View>
    );
  };
  return (
    <View style={{ gap: space.xl }}>
      <CardVisual masked={s.card.masked} holder={s.card.holderName} />
      <BalancePanel s={s} refreshing={refreshing} onRefresh={onRefresh} />
      <Card tone="surface" style={{ gap: space.sm }}>
        <Row justify="space-between"><Text variant="caption" tone="muted">{t('pc.holder')}</Text><Text variant="label">{s.card.holderName ?? t('pc.member')}</Text></Row>
        <Row justify="space-between"><Text variant="caption" tone="muted">{t('pc.cardNo')}</Text><Text variant="label">{s.card.masked}</Text></Row>
        {s.card.memberSince ? <Row justify="space-between"><Text variant="caption" tone="muted">{t('pc.memberSinceLabel')}</Text><Text variant="label">{dateShort(s.card.memberSince)}</Text></Row> : null}
        <Row justify="space-between"><Text variant="caption" tone="muted">{t('pc.discount')}</Text><Text variant="label" tone="accent">{t('pc.discountBody', { p: s.discountPercent })}</Text></Row>
      </Card>
      {s.partialError ? <Text variant="caption" tone="muted">{s.partialError}</Text> : null}
      {s.live ? (
        <View style={{ gap: space.md }}>
          <SectionHeader title={t('pc.rewards')} />
          {s.rewards.length === 0 ? <Text tone="muted">{t('pc.noRewards')}</Text> : s.rewards.map((r) => <Reward key={String(r.id)} r={r} balance={balance} />)}
          {s.rewards.length ? <Text variant="caption" tone="faint">{t('pc.claimIn')}</Text> : null}
        </View>
      ) : null}
      <View style={{ gap: space.sm }}>
        <SectionHeader title={t('pc.storeActivity')} />
        <Text variant="caption" tone="muted">{s.pointsEarnable ? t('pc.earnOn') : t('pc.earnOff')}</Text>
        <Text variant="label" tone="accent" style={{ marginTop: space.sm }}>{t('pc.gameRewards')}</Text>
        {credits.length ? credits.map(activityRow) : <Text tone="muted">{t('pc.noGameRewards')}</Text>}
        <Text variant="label" tone="accent" style={{ marginTop: space.sm }}>{t('pc.giftRedemptions')}</Text>
        {debits.length ? debits.map(activityRow) : <Text tone="muted">{t('pc.noRedemptions')}</Text>}
      </View>
      {s.live ? (
        <View>
          <SectionHeader title={t('pc.history')} />
          <Transactions first={s.transactions} />
        </View>
      ) : null}
      <Button variant="danger" size="sm" label={t('pc.disconnect')} loading={disconnecting} onPress={disconnect} style={{ alignSelf: 'center' }} />
    </View>
  );
}
