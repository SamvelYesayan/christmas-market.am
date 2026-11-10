import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import { useI18n } from '@/i18n';
import { Screen } from '@/components/ui/Screen';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { burst } from '@/components/Celebration';
import { OrderView } from '@/features/shop/OrderView';
import { orderKey } from '@/features/shop/payment';

export default function OrderScreen() {
  const { number, fresh, key: keyParam } = useLocalSearchParams<{ number: string; fresh?: string; key?: string }>();
  const { t, lang } = useI18n();
  const q = useQuery({
    queryKey: ['order', lang, number],
    queryFn: async ({ signal }) => (await api.orders.get(number, { key: keyParam ?? (await orderKey(number)) }, { signal })).order,
  });
  // Coming back from a provider page: re-read the order — the server has verified the payment by then.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void q.refetch(); });
    return () => sub.remove();
  }, [q]);
  const celebrated = useRef(false);
  useEffect(() => {
    if (fresh && q.data && q.data.paymentStatus !== 'failed' && !celebrated.current) { celebrated.current = true; burst(); }
  }, [fresh, q.data]);
  return (
    <Screen back refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {q.isLoading ? <LoadingState label={t('order.finding')} /> : q.isError || !q.data ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <OrderView order={q.data} fresh={!!fresh} onChanged={() => q.refetch()} />
      )}
    </Screen>
  );
}
