// Track an order with its number + the email used at checkout (works for guests).
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/api';
import { useI18n } from '@/i18n';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Input';
import { FormError } from '@/components/ui/States';
import { OrderView } from '@/features/shop/OrderView';
import type { Order } from '@/api/types';

export default function Track() {
  const { t } = useI18n();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<unknown>(null);
  const schema = z.object({ number: z.string().trim().min(4, t('m.required')).max(20), email: z.string().trim().email(t('m.invalidEmail')) });
  const { control, handleSubmit, formState, getValues } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { number: '', email: '' } });
  const find = handleSubmit(async (v) => {
    setError(null);
    try {
      setOrder((await api.orders.get(v.number.toUpperCase(), { email: v.email.toLowerCase() })).order);
    } catch (e) {
      setError(e);
    }
  });
  const reload = async () => {
    const v = getValues();
    try { setOrder((await api.orders.get(v.number.toUpperCase(), { email: v.email.toLowerCase() })).order); } catch { /* keep the last view */ }
  };
  return (
    <Screen back keyboard eyebrow={t('order.where')} title={`${t('order.trackA')} ${t('order.trackB')}`}>
      {order ? <OrderView order={order} onChanged={reload} /> : (
        <>
          <FormError error={error} />
          <Controller control={control} name="number" render={({ field }) => <Field label={t('order.number')} placeholder="XM-2600001" value={field.value} onChangeText={field.onChange} autoCapitalize="characters" error={formState.errors.number?.message} />} />
          <Controller control={control} name="email" render={({ field }) => <Field label={t('order.email')} value={field.value} onChangeText={field.onChange} keyboardType="email-address" autoCapitalize="none" error={formState.errors.email?.message} />} />
          <Button label={t('order.find')} loading={formState.isSubmitting} onPress={() => find()} />
        </>
      )}
    </Screen>
  );
}
