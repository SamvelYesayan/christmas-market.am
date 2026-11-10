// Christmas Wishes — card carousel on Home, full wall screen, and the "write a wish" sheet.
// Only APPROVED wishes come from the server; new wishes are sent for moderation and never shown immediately.
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/api';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { colors, space } from '@/theme/tokens';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card, Row, SectionHeader } from '@/components/ui/Surface';
import { Field, Chip } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { FormError } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { burst } from '@/components/Celebration';
import type { Wish, WishCategory } from '@/api/types';

export const WISH_CATEGORIES: WishCategory[] = ['family', 'friends', 'love', 'health', 'success', 'peace', 'everyone'];

export function WishCard({ wish, width }: { wish: Wish; width?: number }) {
  const { t } = useI18n();
  return (
    <Card tone="paper" style={{ width, gap: space.sm }}>
      {wish.category ? <Text variant="eyebrow" tone="paperMuted">{t(`wishes.cat_${wish.category}`)}</Text> : null}
      {wish.recipient ? <Text variant="label" tone="paperMuted">{t('wishes.to')} {wish.recipient}</Text> : null}
      <Text tone="paper" style={{ fontStyle: 'italic' }}>“{wish.message}”</Text>
      <Text variant="label" tone="paperMuted" align="right">— {wish.author}</Text>
    </Card>
  );
}

export function WishesPreview() {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['wishes', 'preview', lang], queryFn: ({ signal }) => api.wishes.batch([], 8, { signal }) });
  const items = q.data?.items ?? [];
  return (
    <View style={{ gap: space.md }}>
      <SectionHeader eyebrow={t('wishes.eyebrow')} title={t('wishes.title')} action={items.length ? t('m.seeAll') : undefined} onAction={() => router.push('/wishes')} />
      {q.data ? <Text variant="label" tone="muted">{q.data.total} {q.data.total === 1 ? t('wishes.countOne') : t('wishes.count')}</Text> : null}
      {items.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }} style={{ marginRight: -space.lg }}>
          {items.map((w) => <WishCard key={w.id} wish={w} width={270} />)}
        </ScrollView>
      ) : q.isSuccess ? (
        <Card tone="surface"><Text variant="subheading">{t('wishes.emptyTitle')}</Text><Text tone="muted">{t('wishes.emptyBody')}</Text></Card>
      ) : null}
      <Button label={items.length ? t('wishes.write') : t('wishes.writeFirst')} icon="quill" variant="secondary" onPress={() => setOpen(true)} />
      <WishForm visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

export function WishForm({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const user = useSession((s) => s.user);
  // When the form was opened — the server uses the elapsed time as a simple anti-spam signal.
  const [openedAt, setOpenedAt] = useState(() => Date.now());
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const schema = z.object({
    authorName: z.string().trim().min(2, t('wishes.errName')).max(60),
    recipientName: z.string().trim().max(60).optional(),
    message: z.string().trim().min(10, t('wishes.errMessage')).max(400),
    category: z.enum(WISH_CATEGORIES as [WishCategory, ...WishCategory[]]).optional(),
  });
  type F = z.infer<typeof schema>;
  const { control, handleSubmit, formState, reset, setValue } = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: { authorName: user?.name?.split(' ')[0] ?? '', recipientName: '', message: '' },
  });
  const category = useWatch({ control, name: 'category' });
  const submit = () => handleSubmit(async (v) => {
    setError(null);
    try {
      await api.wishes.submit({ authorName: v.authorName, recipientName: v.recipientName || undefined, message: v.message, category: v.category, elapsedMs: Date.now() - openedAt });
      setSent(true);
      burst('frost');
      toast(t('m.wishSentToast'), { tone: 'success', icon: 'quill' });
    } catch (e) {
      setError(e);
    }
  })();
  const close = () => {
    onClose();
    if (sent) { setSent(false); reset(); setOpenedAt(Date.now()); }
  };
  return (
    <Sheet visible={visible} onClose={close} title={sent ? t('wishes.sentTitle') : t('wishes.formTitle')} locked={formState.isSubmitting}>
      {sent ? (
        <View style={{ gap: space.lg }}>
          <Text tone="muted">{t('wishes.sentBody')}</Text>
          <Button label={t('wishes.sentClose')} onPress={close} />
        </View>
      ) : (
        <View style={{ gap: space.lg }}>
          <Text tone="muted">{t('wishes.formIntro')}</Text>
          <FormError error={error} />
          <Controller control={control} name="authorName" render={({ field }) => (
            <Field label={t('wishes.yourName')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={formState.errors.authorName?.message} maxLength={60} autoComplete="given-name" />
          )} />
          <Controller control={control} name="recipientName" render={({ field }) => (
            <Field label={t('wishes.recipient')} optional={t('wishes.optional')} hint={t('wishes.recipientHint')} value={field.value} onChangeText={field.onChange} maxLength={60} />
          )} />
          <Controller control={control} name="message" render={({ field }) => (
            <Field label={t('wishes.message')} placeholder={t('wishes.messageHint')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} multiline maxLength={400} error={formState.errors.message?.message} hint={`${field.value.length}/400`} />
          )} />
          <View style={{ gap: space.sm }}>
            <Text variant="label" tone="muted">{t('wishes.category')} <Text variant="label" tone="faint">{t('wishes.optional')}</Text></Text>
            <Row wrap gap={space.sm}>
              {WISH_CATEGORIES.map((c) => <Chip key={c} label={t(`wishes.cat_${c}`)} selected={category === c} onPress={() => setValue('category', category === c ? undefined : c)} />)}
            </Row>
          </View>
          <Text variant="caption" tone="faint">{t('wishes.moderationNote')}</Text>
          <Button label={formState.isSubmitting ? t('wishes.sending') : t('wishes.submit')} loading={formState.isSubmitting} onPress={() => submit()} />
        </View>
      )}
    </Sheet>
  );
}

export const wishColors = { paper: colors.paper };
