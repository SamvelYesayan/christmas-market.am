// Checkout as a sleigh journey: Who → Where → How → Review. Prices, stock, coupons and the Pioneer discount are
// all recalculated by the server (quote + order); the phone only collects the details.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/api';
import { useCart } from '@/api/queries';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { KEYS, getJson, setJson } from '@/lib/secureStorage';
import { money } from '@/lib/format';
import { colors, radius, space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Badge, Card, Row } from '@/components/ui/Surface';
import { Check, Field } from '@/components/ui/Input';
import { EmptyState, ErrorState, FormError, LoadingState } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { toast } from '@/components/ui/Toast';
import { celebrate } from '@/components/Celebration';
import { CouponBox, Totals } from '@/features/shop/CartParts';
import { rememberOrderKey, startPayment } from '@/features/shop/payment';

const PHONE = /^\+?[0-9 ()-]{6,20}$/;

function makeSchema(t: (k: string, v?: Record<string, string | number>) => string) {
  return z.object({
    name: z.string().trim().min(2, t('m.minChars', { n: 2 })).max(100),
    email: z.string().trim().email(t('m.invalidEmail')).max(200),
    phone: z.string().trim().regex(PHONE, t('m.required')),
    zone: z.string().min(1),
    city: z.string().trim().max(80),
    address: z.string().trim().max(300),
    date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'YYYY-MM-DD'),
    notes: z.string().trim().max(500),
    paymentMethod: z.string().min(1),
    giftMessage: z.string().trim().max(300),
    acceptTerms: z.boolean(),
    remember: z.boolean(),
  });
}
type Form = z.infer<ReturnType<typeof makeSchema>>;

const STEP_FIELDS: (keyof Form)[][] = [['name', 'email', 'phone'], ['zone', 'city', 'address', 'date', 'notes', 'giftMessage'], ['paymentMethod'], ['acceptTerms']];

export default function Checkout() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const user = useSession((s) => s.user);
  const cart = useCart();
  const [step, setStep] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const options = useQuery({ queryKey: ['checkoutOptions', lang], queryFn: ({ signal }) => api.checkout.options({ signal }) });
  const schema = useMemo(() => makeSchema(t), [t]);
  const { control, setValue, trigger, getValues, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '', zone: '', city: lang === 'hy' ? 'Երևան' : 'Yerevan', address: '', date: '', notes: '', paymentMethod: '', giftMessage: '', acceptTerms: false, remember: false },
    mode: 'onTouched',
  });
  // Remembered details live only in this phone's secure storage, and only if the shopper asked.
  useEffect(() => {
    void getJson<Partial<Form> | null>(KEYS.checkout, null).then((saved) => {
      if (!saved) return;
      (['name', 'email', 'phone', 'city', 'address'] as const).forEach((k) => { if (saved[k] && !getValues(k)) setValue(k, saved[k] as string); });
      setValue('remember', true);
    });
  }, [getValues, setValue]);
  useEffect(() => {
    if (!options.data) return;
    if (!getValues('zone')) setValue('zone', options.data.zones[0]?.code ?? '');
    if (!getValues('paymentMethod')) setValue('paymentMethod', options.data.paymentMethods[0]?.code ?? '');
  }, [options.data, getValues, setValue]);

  const [zoneCode, paymentMethod, acceptTerms] = useWatch({ control, name: ['zone', 'paymentMethod', 'acceptTerms'] });
  const quote = useQuery({ queryKey: ['quote', lang, zoneCode, cart.data?.total], queryFn: ({ signal }) => api.checkout.quote(zoneCode, { signal }), enabled: !!zoneCode });
  const zone = options.data?.zones.find((z) => z.code === zoneCode);
  const method = options.data?.paymentMethods.find((m) => m.code === paymentMethod);

  const next = async () => {
    const ok = await trigger(STEP_FIELDS[step]);
    if (!ok) return;
    if (step === 1 && zone?.requiresAddress) {
      const v = getValues();
      if (!v.city.trim() || v.address.trim().length < 5) { toast(t('checkout.address'), { tone: 'error' }); return; }
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const place = async () => {
    if (placing) return; // one order per tap, even on a fast double tap
    const v = getValues();
    if (!v.acceptTerms) { setError(t('checkout.accept1') + ' ' + t('checkout.terms')); return; }
    setPlacing(true);
    setError(null);
    await setJson(KEYS.checkout, v.remember ? { name: v.name, email: v.email, phone: v.phone, city: v.city, address: v.address } : null);
    try {
      const r = await api.checkout.placeOrder({
        customer: { name: v.name.trim(), email: v.email.trim(), phone: v.phone.trim() },
        delivery: {
          zone: v.zone,
          city: zone?.requiresAddress ? v.city.trim() : undefined,
          address: zone?.requiresAddress ? v.address.trim() : undefined,
          date: v.date || undefined,
          notes: v.notes.trim() || undefined,
        },
        paymentMethod: v.paymentMethod,
        giftMessage: v.giftMessage.trim() || undefined,
        acceptTerms: true,
      });
      await rememberOrderKey(r.order.number, r.accessKey);
      void qc.invalidateQueries({ queryKey: ['cart'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      if (r.achievement) celebrate(null, r.achievement);
      if (r.paymentError) toast(r.paymentError, { tone: 'error' });
      const outcome = r.paymentError ? 'offline' : await startPayment(r.payment, r.order, r.accessKey);
      if (outcome !== 'test') router.replace({ pathname: '/order/[number]', params: { number: r.order.number, fresh: '1' } });
    } catch (e) {
      setError(e);
      const code = (e as { code?: string }).code;
      if (code === 'insufficient_stock' || code === 'unavailable_item' || code === 'empty_cart') void cart.refetch();
    } finally {
      setPlacing(false);
    }
  };

  if (cart.data && !cart.isPlaceholderData && !cart.data.items.length && !placing) {
    return <Screen back title={t('checkout.title')}><EmptyState title={t('checkout.nothing')} art={{ type: 'sleigh', c1: '#c8102e' }} action={t('common.visitMarket')} onAction={() => router.replace('/shop')} /></Screen>;
  }
  if (options.isError) return <Screen back title={t('checkout.title')}><ErrorState error={options.error} onRetry={() => options.refetch()} /></Screen>;
  if (!options.data) return <Screen back title={t('checkout.title')}><LoadingState /></Screen>;

  const total = quote.data?.total ?? cart.data?.total ?? 0;
  const steps = ['checkout.s1', 'checkout.s2', 'checkout.s3', 'checkout.s4'];
  const v = getValues();
  return (
    <Screen
      back
      keyboard
      eyebrow={t('m.stepOf', { i: step + 1, n: 4 })}
      title={t(['checkout.whoTitle', 'checkout.whereTitle', 'checkout.howTitle', 'checkout.reviewTitle'][step])}
      footer={
        <Row gap={space.md}>
          {step > 0 ? <Button variant="secondary" label={t('common.back')} onPress={() => setStep(step - 1)} disabled={placing} /> : null}
          {step < 3 ? <Button label={t('common.continue')} onPress={next} style={{ flex: 1 }} />
            : <Button variant="ember" style={{ flex: 1 }} loading={placing} disabled={!acceptTerms}
              label={placing ? t('checkout.sending') : method?.kind === 'offline' ? t('checkout.place', { amount: money(total) }) : t('checkout.pay', { amount: money(total) })} onPress={place} />}
        </Row>
      }
    >
      <Row gap={space.xs}>
        {steps.map((s, i) => (
          <Pressable key={s} onPress={() => i < step && setStep(i)} disabled={i >= step} style={{ flex: 1, gap: 6 }} accessibilityLabel={t(s)}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= step ? colors.accent : colors.raised }} />
            <Text variant="caption" tone={i === step ? 'accent' : 'faint'}>{t(s)}</Text>
          </Pressable>
        ))}
      </Row>
      <FormError error={error} />

      {step === 0 ? (
        <View style={{ gap: space.lg }}>
          {!user ? (
            <Pressable onPress={() => router.push({ pathname: '/login', params: { next: '/checkout' } })}>
              <Text variant="label" tone="muted"><Text variant="label" tone="accent">{t('common.signIn')}</Text> {t('checkout.signInNote')}</Text>
            </Pressable>
          ) : null}
          <Controller control={control} name="name" render={({ field }) => <Field label={t('checkout.fullName')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} autoComplete="name" error={errors.name?.message} />} />
          <Controller control={control} name="email" render={({ field }) => <Field label={t('checkout.email')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.email?.message} />} />
          <Controller control={control} name="phone" render={({ field }) => <Field label={t('checkout.phone')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} keyboardType="phone-pad" autoComplete="tel" placeholder="+374 __ ______" error={errors.phone?.message} />} />
          <Controller control={control} name="remember" render={({ field }) => <Check label={t('checkout.remember')} value={field.value} onChange={field.onChange} />} />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: space.lg }}>
          {options.data.zones.map((z) => {
            const on = z.code === zoneCode;
            return (
              <Pressable key={z.code} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setValue('zone', z.code)}
                style={{ borderWidth: 1, borderColor: on ? colors.accent : colors.border, borderRadius: radius.lg, padding: space.lg, backgroundColor: on ? 'rgba(242,196,109,0.08)' : colors.surface, gap: 4 }}>
                <Row justify="space-between"><Text variant="bodyStrong">{z.name}</Text>{on ? <Icon name="check" color={colors.accent} /> : null}</Row>
                {z.description ? <Text variant="caption" tone="muted">{z.description}</Text> : null}
                <Text variant="caption" tone="accent">{z.price === 0 ? t('common.free') : money(z.price)}{z.eta ? ` · ${z.eta}` : ''}{z.freeOver ? ` · ${t('checkout.freeOver', { amount: money(z.freeOver) })}` : ''}</Text>
              </Pressable>
            );
          })}
          {zone?.requiresAddress ? (
            <>
              <Controller control={control} name="city" render={({ field }) => <Field label={t('checkout.city')} value={field.value} onChangeText={field.onChange} autoComplete="postal-address-locality" />} />
              <Controller control={control} name="address" render={({ field }) => <Field label={t('checkout.address')} value={field.value} onChangeText={field.onChange} autoComplete="street-address" />} />
            </>
          ) : null}
          <Controller control={control} name="date" render={({ field }) => <Field label={t('checkout.date')} hint={t('checkout.dateHint')} placeholder="2026-12-24" value={field.value} onChangeText={field.onChange} keyboardType="numbers-and-punctuation" maxLength={10} error={errors.date?.message} />} />
          <Controller control={control} name="notes" render={({ field }) => <Field label={t('checkout.notes')} placeholder={t('checkout.notesPh')} value={field.value} onChangeText={field.onChange} />} />
          <Controller control={control} name="giftMessage" render={({ field }) => <Field label={t('checkout.card')} placeholder={t('checkout.cardPh')} value={field.value} onChangeText={field.onChange} multiline maxLength={300} />} />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: space.md }}>
          {options.data.paymentMethods.map((m) => {
            const on = m.code === paymentMethod;
            return (
              <Pressable key={m.code} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setValue('paymentMethod', m.code)}
                style={{ borderWidth: 1, borderColor: on ? colors.accent : colors.border, borderRadius: radius.lg, padding: space.lg, backgroundColor: on ? 'rgba(242,196,109,0.08)' : colors.surface, gap: 4 }}>
                <Row justify="space-between"><Row gap={space.sm}><Text variant="bodyStrong">{m.label}</Text>{m.isTest ? <Badge label={t('common.test')} tone="test" /> : null}</Row>{on ? <Icon name="check" color={colors.accent} /> : null}</Row>
                <Text variant="caption" tone="muted">{m.description}</Text>
              </Pressable>
            );
          })}
          {options.data.upcomingPaymentMethods.length ? <Text variant="caption" tone="faint">{t('checkout.soon', { list: options.data.upcomingPaymentMethods.join(', ') })}</Text> : null}
          <Text variant="caption" tone="faint">{t('checkout.secure')}</Text>
          {method && method.kind !== 'offline' ? <Text variant="caption" tone="muted">{t('m.paymentBrowserNote')}</Text> : null}
        </View>
      ) : null}

      {step === 3 ? (
        <View style={{ gap: space.lg }}>
          {method?.isTest ? <Card tone="surface" style={{ borderColor: '#FFB347', borderWidth: 1 }}><Text variant="label" color="#FFB347">{t('checkout.testBanner')}</Text></Card> : null}
          <Card tone="surface" style={{ gap: space.sm }}>
            <Text variant="caption" tone="muted">{t('checkout.from')}</Text><Text>{v.name} · {v.email} · {v.phone}</Text>
            <Text variant="caption" tone="muted">{t('checkout.delivery')}</Text><Text>{zone?.name}{zone?.requiresAddress ? ` — ${v.city}, ${v.address}` : ''}{v.date ? ` · ${v.date}` : ''}</Text>
            <Text variant="caption" tone="muted">{t('checkout.payment')}</Text><Text>{method?.label}</Text>
            {v.giftMessage ? <><Text variant="caption" tone="muted">{t('checkout.cardLabel')}</Text><Text style={{ fontStyle: 'italic' }}>“{v.giftMessage}”</Text></> : null}
          </Card>
          <Card tone="surface" style={{ gap: space.md }}>
            <Text variant="subheading">{t('checkout.inSleigh')}</Text>
            {cart.data?.items.map((it) => <Row key={it.id} justify="space-between"><Text variant="label" style={{ flex: 1 }} numberOfLines={1}>{it.quantity}× {it.name}</Text><Text variant="label">{money(it.total)}</Text></Row>)}
            {cart.data ? <CouponBox cart={cart.data} /> : null}
            {quote.data ? <Totals cart={quote.data} showShipping /> : null}
          </Card>
          <Controller control={control} name="acceptTerms" render={({ field }) => (
            <Check value={field.value} onChange={field.onChange} label={
              <Text tone="muted">{t('checkout.accept1')} <Text tone="accent" onPress={() => router.push('/info/terms')}>{t('checkout.terms')}</Text> {t('checkout.accept2')} <Text tone="accent" onPress={() => router.push('/info/privacy')}>{t('checkout.privacy')}</Text>.</Text>
            } />
          )} />
        </View>
      ) : null}
    </Screen>
  );
}
