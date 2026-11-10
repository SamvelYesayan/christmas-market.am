// Settings: language, calm mode, haptics, analytics consent, calendar reminders, profile & consents, password,
// sign out, and "forget me on this device".
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/api';
import { useI18n, type Lang } from '@/i18n';
import { usePrefs } from '@/state/prefs';
import { useSession } from '@/state/session';
import { changePassword, signOut } from '@/state/auth';
import { config } from '@/lib/config';
import { setCalendarReminders } from '@/lib/notifications';
import { space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card, Divider, Row } from '@/components/ui/Surface';
import { Check, Chip, Field, Segmented, Toggle } from '@/components/ui/Input';
import { FormError } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import type { Atmosphere } from '@/api/types';

const ATMOS: Atmosphere[] = ['cozy', 'grand', 'enchanted', 'nordic'];

function Profile() {
  const { t } = useI18n();
  const user = useSession((s) => s.user)!;
  const setUser = useSession((s) => s.setUser);
  const [error, setError] = useState<unknown>(null);
  const schema = z.object({
    name: z.string().trim().min(1, t('m.required')).max(80),
    phone: z.string().trim().max(30),
    displayName: z.string().trim().max(60),
    atmosphere: z.enum(ATMOS as [Atmosphere, ...Atmosphere[]]),
    personalizationConsent: z.boolean(),
    marketingConsent: z.boolean(),
  });
  type F = z.infer<typeof schema>;
  const { control, handleSubmit, formState } = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: { name: user.name, phone: user.phone ?? '', displayName: user.profile.displayName ?? '', atmosphere: user.profile.atmosphere ?? 'enchanted', personalizationConsent: user.consents.personalization, marketingConsent: user.consents.marketing },
  });
  const personal = useWatch({ control, name: 'personalizationConsent' });
  const save = handleSubmit(async (v) => {
    setError(null);
    try {
      const body: Record<string, unknown> = { name: v.name, phone: v.phone || undefined, marketingConsent: v.marketingConsent, personalizationConsent: v.personalizationConsent };
      if (v.personalizationConsent) Object.assign(body, { displayName: v.displayName || v.name, atmosphere: v.atmosphere });
      const r = await api.me.updateProfile(body);
      setUser(r.user);
      toast(t('account.tidied'), { tone: 'success', icon: 'home' });
    } catch (e) {
      setError(e);
    }
  });
  return (
    <Card style={{ gap: space.lg }}>
      <Text variant="subheading">{t('account.profile')}</Text>
      <FormError error={error} />
      <Controller control={control} name="name" render={({ field }) => <Field label={t('account.fullName')} value={field.value} onChangeText={field.onChange} error={formState.errors.name?.message} />} />
      <Controller control={control} name="phone" render={({ field }) => <Field label={t('account.phone')} value={field.value} onChangeText={field.onChange} keyboardType="phone-pad" />} />
      <Controller control={control} name="personalizationConsent" render={({ field }) => <Check label={t('account.personalise')} value={field.value} onChange={field.onChange} />} />
      {personal ? (
        <>
          <Controller control={control} name="displayName" render={({ field }) => <Field label={t('account.callMe')} value={field.value} onChangeText={field.onChange} />} />
          <Controller control={control} name="atmosphere" render={({ field }) => (
            <View style={{ gap: space.sm }}>
              <Text variant="label" tone="muted">{t('account.atmosphere')}</Text>
              <Row wrap gap={space.sm}>{ATMOS.map((a) => <Chip key={a} label={t(`atmo.${a}`)} selected={field.value === a} onPress={() => field.onChange(a)} />)}</Row>
            </View>
          )} />
        </>
      ) : null}
      <Controller control={control} name="marketingConsent" render={({ field }) => <Check label={t('account.letters')} value={field.value} onChange={field.onChange} />} />
      <Button label={t('common.save')} loading={formState.isSubmitting} onPress={() => save()} />
    </Card>
  );
}

function Password() {
  const { t } = useI18n();
  const [error, setError] = useState<unknown>(null);
  const schema = z.object({ currentPassword: z.string().min(1, t('m.required')), newPassword: z.string().min(10, t('m.minChars', { n: 10 })).max(200) });
  const { control, handleSubmit, formState, reset } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { currentPassword: '', newPassword: '' } });
  const submit = handleSubmit(async (v) => {
    setError(null);
    try {
      await changePassword(v.currentPassword, v.newPassword);
      reset();
      toast(t('account.pwChanged'), { tone: 'success', icon: 'lock' });
    } catch (e) {
      setError(e);
    }
  });
  return (
    <Card style={{ gap: space.lg }}>
      <Text variant="subheading">{t('account.password')}</Text>
      <FormError error={error} />
      <Controller control={control} name="currentPassword" render={({ field }) => <Field label={t('account.current')} value={field.value} onChangeText={field.onChange} secureTextEntry autoComplete="current-password" error={formState.errors.currentPassword?.message} />} />
      <Controller control={control} name="newPassword" render={({ field }) => <Field label={t('account.newPw')} value={field.value} onChangeText={field.onChange} secureTextEntry autoComplete="new-password" error={formState.errors.newPassword?.message} />} />
      <Button variant="secondary" label={t('account.changePw')} loading={formState.isSubmitting} onPress={() => submit()} />
    </Card>
  );
}

export default function Settings() {
  const { t, lang } = useI18n();
  const prefs = usePrefs();
  const user = useSession((s) => s.user);
  const [remBusy, setRemBusy] = useState(false);
  const toggleReminders = async (on: boolean) => {
    setRemBusy(true);
    try {
      const ok = await setCalendarReminders(on);
      if (!ok) { toast(t('m.remindersDenied'), { tone: 'error' }); prefs.update({ reminders: false }); return; }
      prefs.update({ reminders: on });
      if (on) toast(t('m.remindersOn'), { tone: 'success', icon: 'bell' });
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally {
      setRemBusy(false);
    }
  };
  return (
    <Screen back keyboard title={t('m.settings')}>
      <Card style={{ gap: space.md }}>
        <Text variant="subheading">{t('m.language')}</Text>
        <Segmented<Lang> value={lang} onChange={(l) => prefs.update({ lang: l })} options={[{ value: 'hy', label: t('lang.hyFull') }, { value: 'en', label: t('lang.enFull') }]} />
        <Divider />
        <Toggle label={t('m.calm')} body={prefs.systemReduceMotion ? t('m.reduceMotionOn') : t('m.calmBody')} value={prefs.calm || prefs.systemReduceMotion} disabled={prefs.systemReduceMotion} onChange={(v) => prefs.update({ calm: v })} />
        <Toggle label={t('m.haptics')} value={prefs.haptics} onChange={(v) => prefs.update({ haptics: v })} />
        <Toggle label={t('m.analytics')} body={t('m.analyticsBody')} value={prefs.analytics} onChange={(v) => prefs.update({ analytics: v })} />
        <Toggle label={t('m.reminders')} body={t('m.remindersBody')} value={prefs.reminders} disabled={remBusy} onChange={toggleReminders} />
        <Text variant="caption" tone="faint">{t('m.pushNote')}</Text>
      </Card>
      {user ? <Profile /> : null}
      {user ? <Password /> : null}
      <Card style={{ gap: space.md }}>
        <Text variant="subheading">{t('account.leave')}</Text>
        {user ? (
          <Button variant="secondary" icon="logout" label={t('common.signOut')} onPress={() => Alert.alert(t('common.signOut'), t('m.signOutConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.signOut'), style: 'destructive', onPress: async () => { await signOut(); router.replace('/'); } },
          ])} />
        ) : null}
        <Button variant="ghost" label={t('account.forget')} onPress={() => { prefs.setPersona(null); toast(t('account.forgotten')); }} />
      </Card>
      <View style={{ gap: 2 }}>
        <Text variant="caption" tone="faint">{t('m.apiServer')}: {config.apiOrigin}</Text>
        <Text variant="caption" tone="faint">{t('m.version')}: {Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </View>
    </Screen>
  );
}
