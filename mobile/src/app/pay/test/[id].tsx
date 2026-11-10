// TEST payment provider (development only — the server refuses it in production). Clearly marked; no money moves.
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import { useI18n } from '@/i18n';
import { money } from '@/lib/format';
import { space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card, Row } from '@/components/ui/Surface';
import { ErrorState, FormError, LoadingState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';

export default function TestPayment() {
  const { id, number } = useLocalSearchParams<{ id: string; number?: string }>();
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['testPayment', id], queryFn: ({ signal }) => api.orders.testPayment(id, { signal }) });
  const decide = useMutation({
    mutationFn: (d: 'approve' | 'decline') => api.orders.decideTestPayment(id, d),
    onSuccess: (r, d) => {
      toast(d === 'approve' ? t('m.testPayApproved') : t('m.testPayDeclined'), { tone: d === 'approve' ? 'success' : 'info' });
      router.replace({ pathname: '/order/[number]', params: { number: r.orderNumber, fresh: '1' } });
    },
  });
  return (
    <Screen back title={t('testpay.title')}>
      <Card tone="surface" style={{ borderColor: '#FFB347', borderWidth: 1 }}><Text variant="label" color="#FFB347">{t('testpay.banner')}</Text></Card>
      {q.isLoading ? <LoadingState /> : q.isError || !q.data ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <Card style={{ gap: space.lg }}>
          <Text variant="subheading">{t('testpay.line', { n: q.data.order.number ?? number ?? '', amount: money(q.data.payment.amount) })}</Text>
          <Text tone="muted">{t('testpay.body')}</Text>
          <FormError error={decide.error} />
          {q.data.payment.status === 'succeeded' ? <Text tone="success">{t('testpay.already')}</Text> : (
            <Row gap={space.md}>
              <Button label={t('testpay.approve')} style={{ flex: 1 }} loading={decide.isPending && decide.variables === 'approve'} disabled={decide.isPending} onPress={() => decide.mutate('approve')} />
              <Button label={t('testpay.decline')} variant="danger" disabled={decide.isPending} onPress={() => decide.mutate('decline')} />
            </Row>
          )}
        </Card>
      )}
    </Screen>
  );
}
