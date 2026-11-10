// Magical Pioneer Card — what membership gives, how to connect, and member offers (gifts redeemable with points).
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import { refreshUserData, usePioneerStatus } from '@/api/queries';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { points } from '@/lib/format';
import { space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Badge, Card, Row, SectionHeader } from '@/components/ui/Surface';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { ProductVisual } from '@/components/Art';
import { Price } from '@/components/Product';
import { HiddenWonder } from '@/components/Common';
import { CardVisual } from '@/features/pioneer/CardVisual';
import { RedeemSheet } from '@/features/pioneer/RedeemSheet';
import type { PioneerOffer } from '@/api/types';

export default function PioneerLanding() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const user = useSession((s) => s.user);
  const status = usePioneerStatus();
  const offers = useQuery({ queryKey: ['pioneerOffers', lang], queryFn: ({ signal }) => api.pioneer.offers({ signal }) });
  const [redeeming, setRedeeming] = useState<PioneerOffer | null>(null);
  const p = status.data?.discountPercent ?? 5;
  const linked = !!user?.pioneer;
  const canRedeem = !!status.data?.pointsRedeemable;
  const goCard = () => router.push(user ? '/account/pioneer' : { pathname: '/login', params: { next: '/account/pioneer' } });
  return (
    <Screen tabBar eyebrow={t('pc.pageEyebrow')} title={t('pc.pageTitle')} refreshing={offers.isRefetching} onRefresh={() => offers.refetch()}>
      <HiddenWonder id="compass-star" style={{ right: 12, top: 8 }} />
      <CardVisual masked={linked ? user!.pioneer!.cardMasked : null} holder={linked ? user!.pioneer!.holderName : null} empty={!linked} />
      <Text tone="muted">{t('pc.pageIntro', { p })}</Text>
      <Card tone="surface" style={{ gap: space.sm }}>
        {[t('pc.benefit1', { p }), t('pc.benefit2'), t('pc.benefit3')].map((b) => <Text key={b} variant="label">· {b}</Text>)}
      </Card>
      <Button label={linked ? t('pc.goToCard') : t('pc.connect')} icon="card" onPress={goCard} />
      {!linked ? (
        <View style={{ gap: space.sm }}>
          <SectionHeader title={t('pc.howTitle')} />
          {[t('pc.how1'), t('pc.how2'), t('pc.how3')].map((s, i) => <Row key={s} gap={space.md} align="flex-start"><Text variant="bodyStrong" tone="accent">{i + 1}</Text><Text style={{ flex: 1 }}>{s}</Text></Row>)}
        </View>
      ) : null}
      <View style={{ gap: space.md }}>
        <SectionHeader title={t('pc.offersTitle')} />
        <Text variant="caption" tone="muted">{t('pc.offersBody')}</Text>
        {offers.isLoading ? <LoadingState /> : offers.isError ? <ErrorState error={offers.error} onRetry={() => offers.refetch()} compact /> : (offers.data?.offers ?? []).map((o) => (
          <Card key={o.id} style={{ gap: space.md }}>
            <Row gap={space.md} align="flex-start">
              {o.product ? <View style={{ width: 72 }}><ProductVisual product={o.product} /></View> : null}
              <View style={{ flex: 1, gap: 4 }}>
                <Badge label={o.kind === 'discount' ? t('pioneer.kindDiscount') : o.kind === 'redeem_gift' ? t('pioneer.kindGift') : t('pioneer.kindExclusive')} tone="muted" />
                <Text variant="bodyStrong">{o.title}</Text>
                {o.description ? <Text variant="caption" tone="muted">{o.description}</Text> : null}
                {o.redeemable ? <Text variant="label" tone="accent">{t('pc.costPoints', { n: points(o.pointsCost ?? 0) })}</Text> : o.product ? <Price price={o.product.price} sale={o.product.salePrice} size="sm" /> : null}
              </View>
            </Row>
            <Row gap={space.sm} wrap>
              {o.redeemable ? (!canRedeem ? <Text variant="caption" tone="muted">{t('pc.redeemOff')}</Text>
                : linked ? <Button testID={`redeem-${o.id}`} size="sm" label={o.stock === 0 ? t('pc.soldOut') : t('pc.redeemFor', { n: points(o.pointsCost ?? 0) })} disabled={o.stock === 0} onPress={() => setRedeeming(o)} />
                  : <Button size="sm" variant="secondary" label={t('pc.connectToRedeem')} onPress={goCard} />) : null}
              {o.product ? <Button size="sm" variant="ghost" label={t('pioneer.seeFirst')} onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: o.product!.slug } })} /> : !o.redeemable ? <Text variant="caption" tone="muted">{t('pioneer.membersOnly')}</Text> : null}
            </Row>
          </Card>
        ))}
      </View>
      {redeeming ? (
        <RedeemSheet offer={redeeming} onClose={(r) => {
          setRedeeming(null);
          if (r) { void offers.refetch(); void qc.invalidateQueries({ queryKey: ['pioneerSummary'] }); void refreshUserData(); }
        }} />
      ) : null}
    </Screen>
  );
}
