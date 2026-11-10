// Sign in / create account. Passwords go to the server once; only the returned session token is stored (SecureStore).
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useI18n } from '@/i18n';
import { register, signIn } from '@/state/auth';
import { space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Check, Field } from '@/components/ui/Input';
import { FormError } from '@/components/ui/States';
import { OrnamentRule } from '@/components/ui/Surface';
import { toast } from '@/components/ui/Toast';
import { burst } from '@/components/Celebration';

export function loginSchema(t: (k: string, v?: Record<string, number>) => string) {
  return z.object({
    email: z.string().trim().min(1, t('m.required')).email(t('m.invalidEmail')),
    password: z.string().min(1, t('m.required')),
  });
}

export function registerSchema(t: (k: string, v?: Record<string, number>) => string) {
  return z.object({
    name: z.string().trim().min(1, t('m.required')).max(80),
    email: z.string().trim().min(1, t('m.required')).email(t('m.invalidEmail')).max(200),
    password: z.string().min(10, t('m.minChars', { n: 10 })).max(200),
    personalizationConsent: z.boolean(),
    marketingConsent: z.boolean(),
  });
}

function done(next?: string) {
  if (router.canGoBack()) router.back();
  if (next) router.push(next as never);
}

export function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const [error, setError] = useState<unknown>(null);
  const { control, handleSubmit, formState } = useForm<z.infer<ReturnType<typeof loginSchema>>>({ resolver: zodResolver(loginSchema(t)), defaultValues: { email: '', password: '' } });
  const submit = handleSubmit(async (v) => {
    setError(null);
    try {
      await signIn(v.email.trim().toLowerCase(), v.password);
      done(next);
    } catch (e) {
      setError(e);
    }
  });
  return (
    <Screen back keyboard eyebrow={t('auth.door')} title={`${t('auth.welcomeA')} ${t('auth.welcomeB')}`}>
      <Text tone="muted">{t('auth.keeps')}</Text>
      <FormError error={error} />
      <Controller control={control} name="email" render={({ field }) => (
        <Field label={t('auth.email')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="username" error={formState.errors.email?.message} testID="login-email" />
      )} />
      <Controller control={control} name="password" render={({ field }) => (
        <Field label={t('auth.password')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} secureTextEntry autoComplete="current-password" textContentType="password" error={formState.errors.password?.message} onSubmitEditing={() => submit()} testID="login-password" />
      )} />
      <Button label={formState.isSubmitting ? t('auth.opening') : t('auth.signInTitle')} loading={formState.isSubmitting} onPress={() => submit()} testID="login-submit" />
      <OrnamentRule />
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Text tone="muted">{t('auth.newHere')}</Text>
        <Pressable accessibilityRole="link" onPress={() => router.replace({ pathname: '/register', params: next ? { next } : {} })}><Text tone="accent" variant="bodyStrong">{t('auth.createLink')}</Text></Pressable>
      </View>
    </Screen>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const [error, setError] = useState<unknown>(null);
  const { control, handleSubmit, formState } = useForm<z.infer<ReturnType<typeof registerSchema>>>({
    resolver: zodResolver(registerSchema(t)),
    defaultValues: { name: '', email: '', password: '', personalizationConsent: false, marketingConsent: false },
  });
  const submit = handleSubmit(async (v) => {
    setError(null);
    try {
      await register({ ...v, email: v.email.trim().toLowerCase(), name: v.name.trim() });
      burst();
      toast(t('reward.welcomeAboard'), { tone: 'reward', icon: 'sparkle' });
      done(next);
    } catch (e) {
      setError(e);
    }
  });
  return (
    <Screen back keyboard eyebrow={t('auth.newCottage')} title={`${t('auth.lightA')} ${t('auth.lightB')}`}>
      <Text tone="muted">{t('auth.keeps')}</Text>
      <FormError error={error} />
      <Controller control={control} name="name" render={({ field }) => <Field label={t('auth.name')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} autoComplete="name" error={formState.errors.name?.message} />} />
      <Controller control={control} name="email" render={({ field }) => <Field label={t('auth.email')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={formState.errors.email?.message} />} />
      <Controller control={control} name="password" render={({ field }) => <Field label={t('auth.password')} hint={t('auth.pwHint')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} secureTextEntry autoComplete="new-password" textContentType="newPassword" error={formState.errors.password?.message} />} />
      <Controller control={control} name="personalizationConsent" render={({ field }) => <Check label={t('auth.personalise')} value={field.value} onChange={field.onChange} />} />
      <Controller control={control} name="marketingConsent" render={({ field }) => <Check label={t('auth.letters')} value={field.value} onChange={field.onChange} />} />
      <Button label={formState.isSubmitting ? t('auth.opening') : t('auth.create')} loading={formState.isSubmitting} onPress={() => submit()} />
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Text tone="muted">{t('auth.have')}</Text>
        <Pressable accessibilityRole="link" onPress={() => router.replace({ pathname: '/login', params: next ? { next } : {} })}><Text tone="accent" variant="bodyStrong">{t('common.signIn')}</Text></Pressable>
      </View>
    </Screen>
  );
}
