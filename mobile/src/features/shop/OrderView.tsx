// Order confirmation / tracking view (shared by /order/[number] and /track).
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/api';
import { useI18n } from '@/i18n';
import { money } from '@/lib/format';
import { colors, space } from '@/theme/tokens';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Badge, Card, Divider, Row } from '@/components/ui/Surface';
import { Icon } from '@/components/ui/Icon';
import { toast } from '@/components/ui/Toast';
import { ProductVisual } from '@/components/Art';
import { orderKey, startPayment } from './payment';
import type { Order } from '@/api/types';

export const TRACK = ['pending_payment', 'confirmed', 'processing', 'shipped', 'delivered'];

export function OrderView({ order, fresh, onChanged }: { order: Order; fresh?: boolean; onChanged: () => void }) {
  const { t, date } = useI18n();
  const [paying, setPaying] = useState(false);
  const cancelled = ['cancelled', 'refunded'].includes(order.status);
  const idx = TRACK.indexOf(order.status);
  const steps = TRACK.filter((s) => s !== 'pending_payment' || order.status === 'pending_payment');
  const retry = async () => {
    setPaying(true);
    try {
      const key = await orderKey(order.number);
      const { payment } = await api.orders.pay(order.number, { key, email: order.customer.email });
      const outcome = await startPayment(payment, order, key);
      if (outcome !== 'test') onChanged();
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally {
      setPaying(false);
    }
  };
  return (
    <View style={{ gap: space.xl }}>
      {order.isTest ? <Card tone="surface" style={{ borderColor: '#FFB347', borderWidth: 1 }}><Text variant="label" color="#FFB347">{t('order.testBanner')}</Text></Card> : null}
      <View style={{ gap: space.xs }}>
        <Text variant="eyebrow" tone="accent">{t('order.label', { n: order.number })}</Text>
        <Text variant="title">{fresh && order.status !== 'pending_payment' ? `${t('order.onWayA')} ${t('order.onWayB')}` : t(`order.st_${order.status}`)}</Text>
        <Text tone="muted">{fresh ? t('order.thanks', { name: order.customer.name.split(' ')[0], email: order.customer.email, phone: order.customer.phone }) : t('order.placed', { date: date(order.createdAt) })}</Text>
      </View>

      {cancelled ? <Text tone="danger">{t('order.wasStatus', { status: t(`order.st_${order.status}`).toLowerCase() })}</Text> : (
        <Card tone="surface" style={{ gap: 0 }}>
          {steps.map((s, i) => {
            const k = TRACK.indexOf(s);
            const done = k < idx;
            const now = k === idx;
            return (
              <Row key={s} gap={space.md} style={{ minHeight: 40 }}>
                <View style={{ alignItems: 'center', width: 22 }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: done || now ? colors.accent : colors.borderStrong, backgroundColor: done ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {done ? <Icon name="check" size={12} color={colors.onAccent} strokeWidth={3} /> : null}
                  </View>
                  {i < steps.length - 1 ? <View style={{ width: 2, height: 18, backgroundColor: done ? colors.accent : colors.border }} /> : null}
                </View>
                <Text variant={now ? 'bodyStrong' : 'body'} tone={now ? 'accent' : done ? 'default' : 'faint'}>{t(`order.st_${s}`)}</Text>
              </Row>
            );
          })}
        </Card>
      )}

      {order.status === 'pending_payment' && order.paymentStatus !== 'paid' ? (
        <Card style={{ gap: space.md }}>
          <Text><Text variant="bodyStrong">{t(`order.pay_${order.paymentStatus}`)}.</Text> {t('order.reserved')}</Text>
          <Button label={paying ? t('order.opening') : t('order.complete')} loading={paying} onPress={retry} />
        </Card>
      ) : null}

      <Card style={{ gap: space.md }}>
        {order.items.map((it, i) => (
          <Row key={i} gap={space.md} align="flex-start">
            <View style={{ width: 56 }}><ProductVisual product={{ art: it.art, image: it.image, name: it.name }} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong" onPress={it.slug ? () => router.push({ pathname: '/product/[slug]', params: { slug: it.slug! } }) : undefined}>{it.name}</Text>
              <Text variant="caption" tone="muted">{it.variantName} · {it.quantity} × {money(it.unitPrice)}{it.personalization ? ` · “${it.personalization}”` : ''}</Text>
            </View>
            <Text variant="label">{money(it.total)}</Text>
          </Row>
        ))}
        <Divider />
        <Row justify="space-between"><Text tone="muted">{t('cart.gifts')}</Text><Text>{money(order.subtotal)}</Text></Row>
        {order.discount > 0 ? <Row justify="space-between"><Text tone="accent">{t('cart.code', { code: order.couponCode ?? '' })}</Text><Text tone="accent">−{money(order.discount)}</Text></Row> : null}
        {order.pioneerDiscount > 0 ? <Row justify="space-between"><Text tone="accent">{t('sleigh.pioneer')}</Text><Text tone="accent">−{money(order.pioneerDiscount)}</Text></Row> : null}
        <Row justify="space-between"><Text tone="muted">{t('cart.delivery')}</Text><Text>{order.shipping ? money(order.shipping) : t('common.free')}</Text></Row>
        <Row justify="space-between"><Text variant="subheading">{t('common.total')}</Text><Text variant="heading">{money(order.total)}</Text></Row>
        <Row gap={space.sm} wrap><Badge label={t(`order.pay_${order.paymentStatus}`)} tone={order.paymentStatus === 'paid' ? 'green' : 'muted'} /></Row>
        <Text variant="caption" tone="muted">{order.delivery.zoneName}{order.delivery.address ? ` — ${order.delivery.city}, ${order.delivery.address}` : ''}{order.delivery.date ? ` · ${order.delivery.date}` : ''}</Text>
        {order.trackingCode ? <Text variant="caption">{t('order.tracking')} <Text variant="caption" font="bodyBold" selectable>{order.trackingCode}</Text></Text> : null}
        {order.giftMessage ? <Text variant="caption" tone="muted" style={{ fontStyle: 'italic' }}>“{order.giftMessage}”</Text> : null}
      </Card>
      <Button variant="secondary" label={t('order.continue')} onPress={() => router.replace('/shop')} />
    </View>
  );
}
