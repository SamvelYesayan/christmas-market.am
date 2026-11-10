import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { ProductGrid } from '@/components/Product';
import { SignInGate } from '@/components/Common';
import { router } from 'expo-router';

export default function Wishlist() {
  const { t, lang } = useI18n();
  const user = useSession((s) => s.user);
  const q = useQuery({ queryKey: ['wishlist', lang, user?.id], queryFn: ({ signal }) => api.wishlist.list({ signal }), enabled: !!user });
  if (!user) return <Screen back title={t('account.wishlist')}><SignInGate body={t('product.signInWish')} next="/account/wishlist" /></Screen>;
  return (
    <Screen back title={t('account.wishlist')} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.products.length ? (
        <EmptyState title={t('account.noWishes')} body={t('account.noWishesBody')} art={{ type: 'heart', c1: '#c8102e' }} action={t('common.visitMarket')} onAction={() => router.replace('/shop')} />
      ) : <ProductGrid products={q.data.products} />}
    </Screen>
  );
}
