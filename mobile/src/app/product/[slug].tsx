// Product — gallery, price, variants, personalisation, quantity, add to cart, wishlist, story, reviews, related.
import { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { api } from '@/api';
import { useCartMutation } from '@/api/queries';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { mediaUrl } from '@/lib/config';
import { money } from '@/lib/format';
import { colors, radius, space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, Row, SectionHeader, Badge, Divider } from '@/components/ui/Surface';
import { Chip, Field } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { ErrorState, LoadingState, EmptyState, FormError } from '@/components/ui/States';
import { StarMark } from '@/components/ui/Icon';
import { toast } from '@/components/ui/Toast';
import { ProductVisual } from '@/components/Art';
import { Price, ProductRail, WishButton } from '@/components/Product';
import { burst } from '@/components/Celebration';

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return <Row gap={2}>{[1, 2, 3, 4, 5].map((i) => <StarMark key={i} size={size} color={i <= n ? colors.accent : colors.raisedHi} />)}</Row>;
}

function ReviewSheet({ slug, visible, onClose }: { slug: string; visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const m = useMutation({
    mutationFn: () => api.catalog.review(slug, rating, body.trim()),
    onSuccess: (r) => { toast(r.message || t('m.reviewSent'), { tone: 'success', icon: 'pen' }); setBody(''); onClose(); },
  });
  return (
    <Sheet visible={visible} onClose={onClose} title={t('product.sign')} locked={m.isPending}>
      <FormError error={m.error} />
      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">{t('product.rating')}</Text>
        <Row gap={space.sm}>{[1, 2, 3, 4, 5].map((i) => <Chip key={i} label={String(i)} selected={rating === i} onPress={() => setRating(i)} />)}</Row>
      </View>
      <Field label={t('m.writeReview')} placeholder={t('product.reviewPh')} value={body} onChangeText={setBody} multiline maxLength={1500} hint={t('m.minChars', { n: 10 })} />
      <Button label={t('product.sign')} loading={m.isPending} disabled={body.trim().length < 10} onPress={() => m.mutate()} />
    </Sheet>
  );
}

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, lang, dateShort } = useI18n();
  const { width } = useWindowDimensions();
  const qc = useQueryClient();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const q = useQuery({ queryKey: ['product', lang, slug], queryFn: ({ signal }) => api.catalog.product(slug, { signal }) });
  const p = q.data?.product;
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [personal, setPersonal] = useState('');
  const [reviewing, setReviewing] = useState(false);
  // The chosen option, or the first one in stock.
  const selectedId = variantId ?? p?.variants.find((v) => v.stock > 0)?.id ?? p?.variants[0]?.id ?? null;
  const add = useCartMutation(() => api.cart.add(selectedId!, qty, p?.isPersonalizable ? personal.trim() : undefined));

  if (q.isLoading) return <Screen back><LoadingState label={t('product.unwrapping')} /></Screen>;
  if (q.isError || !p) {
    return (
      <Screen back>
        {q.error && (q.error as { status?: number }).status === 404
          ? <EmptyState title={t('product.wandered')} art={{ type: 'giftbox', c1: '#3a4566', c2: '#6b7896' }} action={t('common.backToMarket')} onAction={() => router.replace('/shop')} />
          : <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      </Screen>
    );
  }
  const variant = p.variants.find((v) => v.id === selectedId);
  const unit = (p.salePrice ?? p.price) + (variant?.priceDelta ?? 0);
  const stock = variant?.stock ?? 0;
  const gallery = p.images.length ? p.images : null;
  const pct = p.salePrice != null ? Math.round((1 - p.salePrice / p.price) * 100) : 0;

  return (
    <Screen
      back
      right={<WishButton productId={p.id} wished={p.wished} size={44} />}
      footer={
        <Row gap={space.sm}>
          <IconButton icon="minus" label={t('sleigh.less')} onPress={() => setQty((x) => Math.max(1, x - 1))} disabled={qty <= 1} size={44} />
          <Text variant="subheading" accessibilityLiveRegion="polite" accessibilityLabel={`${t('m.qty')}: ${qty}`} style={{ minWidth: 24, textAlign: 'center' }}>{qty}</Text>
          <IconButton icon="plus" label={t('sleigh.more')} onPress={() => setQty((x) => Math.min(Math.min(50, stock || 1), x + 1))} disabled={qty >= Math.min(50, stock)} size={44} />
          <Button
            label={stock <= 0 ? t('common.soldOut') : add.isPending ? t('product.packing') : `${t('tag.add')} · ${money(unit * qty)}`}
            variant="ember"
            disabled={!variant || stock <= 0}
            loading={add.isPending}
            onPress={() => add.mutate(undefined, {
              onSuccess: () => {
                burst();
                toast(t('sleigh.added', { name: p.name }), { tone: 'success', icon: 'cart' });
                void qc.invalidateQueries({ queryKey: ['product'] });
              },
              onError: (e) => toast(e.message, { tone: 'error' }),
            })}
            style={{ flex: 1, paddingHorizontal: space.sm }}
          />
        </Row>
      }
    >
      {gallery ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }}>
          {gallery.map((img) => (
            <Image key={img.id} source={{ uri: mediaUrl(img.url)! }} style={{ width, height: width }} contentFit="cover" accessibilityLabel={img.alt ?? p.name} transition={200} />
          ))}
        </ScrollView>
      ) : <ProductVisual product={p} style={{ borderRadius: radius.xl }} />}

      <View style={{ gap: space.sm }}>
        <Row gap={space.sm} wrap>
          {p.category ? <Badge label={p.category.name} tone="muted" /> : null}
          {p.isLimited ? <Badge label={t('product.limited')} tone="ember" /> : null}
          {p.isMagic ? <Badge label={t('product.magical')} /> : null}
          {pct > 0 ? <Badge label={t('product.save', { n: pct })} tone="green" /> : null}
        </Row>
        <Text variant="title">{p.name}</Text>
        {p.subtitle ? <Text tone="muted">{p.subtitle}</Text> : null}
        <Price price={p.price + (variant?.priceDelta ?? 0)} sale={p.salePrice != null ? p.salePrice + (variant?.priceDelta ?? 0) : null} size="lg" />
        {p.rating ? <Row gap={space.sm}><Stars n={Math.round(Number(p.rating))} /><Text variant="caption" tone="muted">{p.rating}</Text></Row> : null}
      </View>

      {p.variants.length > 1 ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="muted">{t('product.choose')}</Text>
          <Row wrap gap={space.sm}>
            {p.variants.map((v) => (
              <Chip key={v.id} label={`${v.name}${v.priceDelta ? ` +${money(v.priceDelta)}` : ''}`} selected={v.id === selectedId} disabled={v.stock <= 0} onPress={() => { setVariantId(v.id); setQty(1); }} />
            ))}
          </Row>
        </View>
      ) : null}

      <Text variant="label" tone={stock <= 0 ? 'danger' : stock <= 5 ? 'accent' : 'success'}>
        {stock <= 0 ? t('product.soldOut') : stock <= 5 ? t('product.low', { n: stock }) : t('product.inStock')}
      </Text>

      {p.isPersonalizable ? (
        <Field label={t('product.personal')} placeholder={t('product.personalPh')} hint={t('product.personalHint')} value={personal} onChangeText={setPersonal} maxLength={60} />
      ) : null}

      {p.description ? <Text>{p.description}</Text> : null}
      <Card tone="surface" style={{ gap: space.sm }}>
        {[t('product.promise1'), t('product.promise2'), t('product.promise3')].map((s) => <Text key={s} variant="caption" tone="muted">{s}</Text>)}
      </Card>
      {p.story ? (
        <Card tone="paper" style={{ gap: space.sm }}>
          <Text variant="eyebrow" tone="paperMuted">{t('product.story')}</Text>
          <Text tone="paper" style={{ fontStyle: 'italic' }}>{p.story}</Text>
        </Card>
      ) : null}

      <View style={{ gap: space.md }}>
        <SectionHeader title={t('product.guestbook')} action={signedIn ? t('m.writeReview') : t('m.signInCta')} onAction={() => (signedIn ? setReviewing(true) : router.push('/login'))} />
        {p.reviews.length === 0 ? <Text tone="muted">{t('product.noReviews')}</Text> : p.reviews.map((r, i) => (
          <View key={i} style={{ gap: 4 }}>
            <Row justify="space-between"><Stars n={r.rating} /><Text variant="caption" tone="faint">{dateShort(r.createdAt)}</Text></Row>
            <Text>{r.body}</Text>
            <Text variant="caption" tone="muted">— {r.author}{r.city ? `, ${r.city}` : ''}</Text>
            {i < p.reviews.length - 1 ? <Divider style={{ marginTop: space.sm }} /> : null}
          </View>
        ))}
      </View>

      {q.data?.related.length ? (
        <View>
          <SectionHeader title={t('product.alsoWish')} />
          <ProductRail products={q.data.related} />
        </View>
      ) : null}
      <ReviewSheet slug={p.slug} visible={reviewing} onClose={() => setReviewing(false)} />
    </Screen>
  );
}
