// Cart tab — cart lines, quantity, remove, discount code, Pioneer discount, totals, checkout.
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/api';
import { useCart, useCartMutation } from '@/api/queries';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { money } from '@/lib/format';
import { colors, space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, Row } from '@/components/ui/Surface';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { ProductVisual } from '@/components/Art';
import { CouponBox, Totals } from '@/features/shop/CartParts';
import type { Cart } from '@/api/types';

function Line({ item }: { item: Cart['items'][number] }) {
  const { t } = useI18n();
  const setQty = useCartMutation((q: number) => api.cart.setQuantity(item.id, q));
  const remove = useCartMutation(() => api.cart.remove(item.id));
  const busy = setQty.isPending || remove.isPending;
  const onErr = (e: Error) => toast(e.message, { tone: 'error' });
  return (
    <Card style={{ flexDirection: 'row', gap: space.md, opacity: busy ? 0.7 : 1 }}>
      <Pressable onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: item.slug } })} style={{ width: 84 }} accessibilityRole="link" accessibilityLabel={item.name}>
        <ProductVisual product={item} />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="bodyStrong" numberOfLines={2}>{item.name}</Text>
        <Text variant="caption" tone="muted">{item.variantName} · {t('cart.each', { amount: money(item.unitPrice) })}</Text>
        {item.personalization ? <Text variant="caption" tone="accent">{t('cart.personalised', { text: item.personalization })}</Text> : null}
        {item.stock != null && item.quantity > item.stock ? <Text variant="caption" tone="danger">{t('cart.onlyLeft', { n: item.stock })}</Text> : null}
        <Row justify="space-between" style={{ marginTop: space.xs }}>
          <Row gap={space.sm}>
            <IconButton icon={item.quantity <= 1 ? 'trash' : 'minus'} label={item.quantity <= 1 ? t('common.remove') : t('sleigh.less')} size={34} disabled={busy}
              onPress={() => (item.quantity <= 1 ? remove.mutate(undefined, { onError: onErr }) : setQty.mutate(item.quantity - 1, { onError: onErr }))} />
            <Text variant="bodyStrong" style={{ minWidth: 22, textAlign: 'center' }}>{item.quantity}</Text>
            <IconButton icon="plus" label={t('sleigh.more')} size={34} disabled={busy || item.quantity >= 50} onPress={() => setQty.mutate(item.quantity + 1, { onError: onErr })} />
          </Row>
          <Text variant="bodyStrong">{money(item.total)}</Text>
        </Row>
      </View>
    </Card>
  );
}

export default function CartScreen() {
  const { t } = useI18n();
  const cart = useCart();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const c = cart.data;
  if (cart.isError) return <Screen tabBar title={t('cart.title')}><ErrorState error={cart.error} onRetry={() => cart.refetch()} /></Screen>;
  if (!c || (cart.isPlaceholderData && cart.isFetching)) return <Screen tabBar title={t('cart.title')}><LoadingState /></Screen>;
  if (!c.items.length) {
    return (
      <Screen tabBar title={t('cart.title')}>
        <EmptyState title={t('cart.empty')} body={t('cart.emptyBody')} art={{ type: 'sleigh', c1: '#c8102e' }} action={t('m.cartEmptyCta')} onAction={() => router.replace('/shop')} />
      </Screen>
    );
  }
  return (
    <Screen
      tabBar
      title={t('cart.title')}
      refreshing={cart.isRefetching}
      onRefresh={() => cart.refetch()}
      footer={<Button label={`${t('cart.checkout')} · ${money(c.total)}`} variant="ember" icon="gift" onPress={() => router.push('/checkout')} />}
    >
      <Text variant="label" tone="muted">{c.count === 1 ? t('sleigh.aboardOne') : t('sleigh.aboard', { n: c.count })}</Text>
      <View style={{ gap: space.md }}>{c.items.map((it) => <Line key={it.id} item={it} />)}</View>
      <Card tone="surface" style={{ gap: space.lg }}>
        <CouponBox cart={c} />
        <Totals cart={c} />
        <Text variant="caption" tone="faint">{t('cart.shippingNote')}</Text>
      </Card>
      {!c.hasPioneer ? (
        <Pressable onPress={() => router.push(signedIn ? '/account/pioneer' : '/pioneer')} accessibilityRole="link">
          <Row gap={space.sm}><Text variant="caption" tone="muted">{t('cart.pioneerHint', { p: 5 })}</Text><Text variant="caption" tone="accent">{t('cart.linkCard')}</Text></Row>
        </Pressable>
      ) : null}
      {!signedIn ? (
        <Row gap={space.xs} wrap>
          <Pressable onPress={() => router.push({ pathname: '/login', params: { next: '/cart' } })}><Text variant="caption" tone="accent">{t('common.signIn')}</Text></Pressable>
          <Text variant="caption" tone="faint">{t('cart.guestNote')}</Text>
        </Row>
      ) : null}
      <View style={{ height: 1, backgroundColor: colors.bg }} />
    </Screen>
  );
}
