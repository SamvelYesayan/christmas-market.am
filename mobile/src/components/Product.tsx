// Product presentation: price, wishlist heart, grid tile and horizontal rail.
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, radius, space } from '@/theme/tokens';
import { useI18n } from '@/i18n';
import { money } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { api } from '@/api';
import { useCartMutation } from '@/api/queries';
import { useSession } from '@/state/session';
import type { Achievement, ProductCard as P } from '@/api/types';
import { ProductVisual } from './Art';
import { Text } from './ui/Text';
import { Icon } from './ui/Icon';
import { Badge } from './ui/Surface';
import { toast } from './ui/Toast';
import { Button } from './ui/Button';
import { burst, celebrate } from './Celebration';

export function Price({ price, sale, size = 'md' }: { price: number; sale?: number | null; size?: 'sm' | 'md' | 'lg' }) {
  const v = size === 'lg' ? 'heading' : size === 'sm' ? 'label' : 'bodyStrong';
  if (sale != null && sale < price) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        <Text variant={v} tone="accent">{money(sale)}</Text>
        <Text variant="caption" tone="faint" style={{ textDecorationLine: 'line-through' }}>{money(price)}</Text>
      </View>
    );
  }
  return <Text variant={v}>{money(price)}</Text>;
}

/** Heart toggle. The server stores the wishlist; guests are asked to sign in. */
export function WishButton({ productId, wished, size = 36 }: { productId: string; wished: boolean; size?: number }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const m = useMutation({
    mutationFn: async (next: boolean) => (next ? api.wishlist.add(productId) : api.wishlist.remove(productId)),
    onSuccess: (r, next) => {
      toast(next ? t('m.wishlistAdded') : t('m.wishlistRemoved'), { tone: 'success', icon: next ? 'heartFill' : 'heart' });
      const achievement = r && 'achievement' in r ? (r as { achievement: Achievement | null }).achievement : null;
      if (achievement) celebrate(null, achievement);
      void qc.invalidateQueries({ queryKey: ['product'] });
      void qc.invalidateQueries({ queryKey: ['wishlist'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: Error) => toast(e.message, { tone: 'error' }),
  });
  const on = m.isPending ? m.variables : wished;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!on, busy: m.isPending }}
      accessibilityLabel={on ? t('tag.removeWish') : t('tag.addWish')}
      hitSlop={8}
      disabled={m.isPending}
      onPress={() => {
        haptic.tap();
        if (!signedIn) {
          toast(t('tag.signInWish'), { icon: 'heart' });
          router.push('/login');
          return;
        }
        m.mutate(!wished);
      }}
      style={[styles.heart, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Icon name={on ? 'heartFill' : 'heart'} size={size * 0.55} color={on ? colors.primaryHi : colors.text} />
    </Pressable>
  );
}

/** One tap when there is nothing to choose; otherwise the product screen, where the options are. Same rule as the website. */
function QuickAdd({ product, disabled }: { product: P; disabled: boolean }) {
  const { t } = useI18n();
  const add = useCartMutation((variantId: string) => api.cart.add(variantId, 1));
  const [checking, setChecking] = useState(false);
  const fail = (e: Error) => toast(e.message, { tone: 'error' });
  const press = async () => {
    setChecking(true);
    try {
      const { product: full } = await api.catalog.product(product.slug);
      const available = full.variants.filter((v) => v.stock > 0);
      if (available.length === 1 && !full.isPersonalizable) {
        add.mutate(available[0].id, { onSuccess: () => { burst(); toast(t('sleigh.added', { name: product.name }), { tone: 'success', icon: 'cart' }); }, onError: fail });
      } else router.push({ pathname: '/product/[slug]', params: { slug: product.slug } });
    } catch (e) {
      fail(e as Error);
    } finally {
      setChecking(false);
    }
  };
  return <Button size="sm" label={t('tag.add')} block disabled={disabled} loading={checking || add.isPending} onPress={() => void press()} style={{ minHeight: 44, paddingHorizontal: space.sm }} />;
}

export function ProductTile({ product, width, wished = false }: { product: P; width?: number; wished?: boolean }) {
  const { t } = useI18n();
  const soldOut = product.stock <= 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${money(product.salePrice ?? product.price)}${soldOut ? `, ${t('common.soldOut')}` : ''}`}
      onPress={() => { haptic.tap(); router.push({ pathname: '/product/[slug]', params: { slug: product.slug } }); }}
      style={({ pressed }) => [styles.tile, width ? { width } : { flex: 1 }, pressed && { opacity: 0.85 }]}
    >
      <View>
        <ProductVisual product={product} />
        <View style={styles.badges}>
          {product.isLimited ? <Badge label={t('common.limited')} tone="ember" /> : null}
          {product.isMagic ? <Badge label={t('common.magic')} tone="gold" /> : null}
        </View>
        <View style={styles.heartPos}><WishButton productId={product.id} wished={wished} size={34} /></View>
      </View>
      <View style={{ gap: 2, paddingHorizontal: 2 }}>
        {product.category ? <Text variant="eyebrow" tone="faint" numberOfLines={1}>{product.category.name}</Text> : null}
        <Text variant="label" font="bodyBold" numberOfLines={2}>{product.name}</Text>
        <Price price={product.price} sale={product.salePrice} size="sm" />
        {product.match != null ? <Text variant="caption" tone="accent">{t('common.match', { n: product.match })}</Text> : null}
        <Text variant="caption" tone={soldOut ? 'muted' : product.stock < 6 ? 'accent' : 'success'} numberOfLines={1}>{soldOut ? t('common.soldOut') : product.stock < 6 ? t('tag.low', { n: product.stock }) : t('product.inStock')}</Text>
      </View>
      <QuickAdd product={product} disabled={soldOut} />
    </Pressable>
  );
}

export function ProductRail({ products, tileWidth = 156 }: { products: P[]; tileWidth?: number }) {
  return (
    <FlatList
      horizontal
      data={products}
      keyExtractor={(p) => p.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.md, paddingRight: space.lg }}
      style={{ marginRight: -space.lg }}
      renderItem={({ item }) => <ProductTile product={item} width={tileWidth} />}
    />
  );
}

/** Two-column grid without nesting a FlatList inside a ScrollView. */
export function ProductGrid({ products }: { products: P[] }) {
  const rows: P[][] = [];
  for (let i = 0; i < products.length; i += 2) rows.push(products.slice(i, i + 2));
  return (
    <View style={{ gap: space.lg }}>
      {rows.map((r) => (
        <View key={r[0].id} style={{ flexDirection: 'row', gap: space.md }}>
          <ProductTile product={r[0]} />
          {r[1] ? <ProductTile product={r[1]} /> : <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { gap: space.sm, justifyContent: 'space-between' },
  badges: { position: 'absolute', top: space.sm, left: space.sm, gap: 4 },
  heartPos: { position: 'absolute', top: space.sm, right: space.sm },
  heart: { backgroundColor: 'rgba(11,20,48,0.72)', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.pill },
});
