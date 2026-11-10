// Cart totals and discount code box — shared by the cart and checkout.
import { useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api';
import { useCartMutation } from '@/api/queries';
import { useI18n } from '@/i18n';
import { money } from '@/lib/format';
import { space } from '@/theme/tokens';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Divider, Row } from '@/components/ui/Surface';
import { Field } from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';
import type { Cart } from '@/api/types';

export function Totals({ cart, showShipping }: { cart: Cart; showShipping?: boolean }) {
  const { t } = useI18n();
  const line = (label: string, value: string, tone?: 'accent') => (
    <Row justify="space-between"><Text tone={tone === 'accent' ? 'accent' : 'muted'}>{label}</Text><Text tone={tone === 'accent' ? 'accent' : 'default'}>{value}</Text></Row>
  );
  return (
    <View style={{ gap: space.sm }}>
      {line(t('cart.gifts'), money(cart.subtotal))}
      {cart.discount > 0 ? line(t('cart.code', { code: cart.coupon?.code ?? '' }), `−${money(cart.discount)}`, 'accent') : null}
      {cart.pioneerDiscount > 0 ? line(t('cart.pioneerPct', { p: cart.pioneerPercent ?? '' }), `−${money(cart.pioneerDiscount)}`, 'accent') : null}
      {showShipping ? line(t('cart.delivery'), cart.shipping ? money(cart.shipping) : t('common.free')) : null}
      <Divider />
      <Row justify="space-between"><Text variant="subheading">{t('common.total')}</Text><Text variant="heading">{money(cart.total)}</Text></Row>
    </View>
  );
}

export function CouponBox({ cart }: { cart: Cart }) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const apply = useCartMutation((c: string) => api.cart.applyCoupon(c));
  const remove = useCartMutation(() => api.cart.removeCoupon());
  if (cart.coupon) {
    return (
      <Row justify="space-between">
        <Text tone="accent">{t('cart.applied')} · {cart.coupon.code}</Text>
        <Button variant="ghost" size="sm" label={t('m.remove')} loading={remove.isPending} onPress={() => remove.mutate(undefined)} />
      </Row>
    );
  }
  return (
    <View style={{ gap: space.sm }}>
      {cart.couponError ? <Text variant="caption" tone="danger">{cart.couponError}</Text> : null}
      <Row gap={space.sm} align="flex-end">
        <View style={{ flex: 1 }}>
          <Field label={t('cart.codeAria')} placeholder={t('cart.codePh')} value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={40} />
        </View>
        <Button
          variant="secondary"
          label={t('common.apply')}
          disabled={code.trim().length < 3}
          loading={apply.isPending}
          onPress={() => apply.mutate(code.trim(), { onSuccess: () => { setCode(''); toast(t('cart.applied'), { tone: 'success', icon: 'ticket' }); }, onError: (e) => toast(e.message, { tone: 'error' }) })}
          style={{ marginBottom: 1 }}
        />
      </Row>
    </View>
  );
}
