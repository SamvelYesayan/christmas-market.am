import { View } from 'react-native';
import { router } from 'expo-router';
import { useDashboard } from '@/api/queries';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { money } from '@/lib/format';
import { space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Badge, Card, Row } from '@/components/ui/Surface';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { SignInGate } from '@/components/Common';

export default function Orders() {
  const { t, dateShort } = useI18n();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const dash = useDashboard();
  if (!signedIn) return <Screen back title={t('m.orders')}><SignInGate next="/account/orders" /></Screen>;
  return (
    <Screen back title={t('m.orders')} refreshing={dash.isRefetching} onRefresh={() => dash.refetch()}>
      {dash.isLoading ? <LoadingState /> : dash.isError ? <ErrorState error={dash.error} onRetry={() => dash.refetch()} /> : !dash.data?.orders.length ? (
        <EmptyState title={t('account.noOrders')} body={t('m.noOrdersBody')} art={{ type: 'sleigh', c1: '#c8102e' }} action={t('common.visitMarket')} onAction={() => router.replace('/shop')} />
      ) : (
        <View style={{ gap: space.md }}>
          {dash.data.orders.map((o) => (
            <Card key={o.number} onPress={() => router.push({ pathname: '/order/[number]', params: { number: o.number } })} accessibilityLabel={`${o.number}, ${t(`order.st_${o.status}`)}, ${money(o.total)}`} style={{ gap: space.sm }}>
              <Row justify="space-between"><Text variant="bodyStrong">{o.number}</Text><Text variant="bodyStrong">{money(o.total)}</Text></Row>
              <Row justify="space-between">
                <Text variant="caption" tone="muted">{dateShort(o.createdAt)} · {t('account.giftsN', { n: o.itemCount })}</Text>
                <Row gap={space.xs}>{o.isTest ? <Badge label={t('common.test')} tone="test" /> : null}<Badge label={t(`order.st_${o.status}`)} tone={o.status === 'delivered' ? 'green' : o.status === 'cancelled' ? 'muted' : 'gold'} /></Row>
              </Row>
              <Text variant="caption" tone="faint">{t(`order.pay_${o.paymentStatus}`)}</Text>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
