// The welcome ritual (the website's Lantern Gate): name, three questions, atmosphere. Saved on this phone; for a
// signed-in customer who consented to personalisation it is also saved to the account (PUT /me/profile).
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { api } from '@/api';
import { useI18n } from '@/i18n';
import { usePrefs } from '@/state/prefs';
import { useSession } from '@/state/session';
import { colors, radius, space } from '@/theme/tokens';
import { Screen, goBack } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Input';
import { Art } from '@/components/Art';
import { burst } from '@/components/Celebration';
import type { Atmosphere, Art as ArtSpec } from '@/api/types';

const QUESTIONS = [
  { key: 'favorite', q: 'q1', options: [['lights', 'q1a'], ['baking', 'q1b'], ['stories', 'q1c'], ['snow', 'q1d'], ['magic', 'q1e']] },
  { key: 'tradition', q: 'q2', options: [['tree', 'q2a'], ['wrapping', 'q2b'], ['table', 'q2c'], ['walks', 'q2d']] },
  { key: 'giftStyle', q: 'q3', options: [['handmade', 'q3a'], ['surprise', 'q3b'], ['useful', 'q3c'], ['magical', 'q3d']] },
] as const;
const ATMO_ART: Record<Atmosphere, ArtSpec> = { cozy: { type: 'candle', c1: '#a0522d', c2: '#ffb347' }, grand: { type: 'ornament', c1: '#8e0a20', c2: '#f2c46d' }, enchanted: { type: 'lantern', c1: '#1b2a5c', c2: '#a9c7ff' }, nordic: { type: 'tree', c1: '#1d6b6b', c2: '#7fe0c4', frosted: true } };
const INTEREST: Record<string, string> = { lights: 'decor', baking: 'cooking', stories: 'reading', snow: 'outdoors', magic: 'magic', handmade: 'crafts', magical: 'magic', useful: 'cozy', surprise: 'games' };

export default function Welcome() {
  const { t } = useI18n();
  const setPersona = usePrefs((s) => s.setPersona);
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const [step, setStep] = useState(0); // 0 name, 1..3 questions, 4 atmosphere, 5 done
  const [name, setName] = useState(user?.profile.displayName?.split(' ')[0] ?? '');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const display = name.trim() || t('greet.traveller');

  const finish = async (atmosphere: Atmosphere) => {
    setBusy(true);
    const interests = [...new Set([answers.favorite, answers.giftStyle].map((v) => INTEREST[v]).filter(Boolean))];
    const persona = { name: name.trim() || 'Traveller', atmosphere, preferences: { ...answers, interests } };
    setPersona(persona);
    if (user?.consents.personalization) {
      try { setUser((await api.me.updateProfile({ displayName: persona.name, atmosphere, preferences: persona.preferences })).user); } catch { /* kept on the phone */ }
    }
    setBusy(false);
    burst();
    setStep(5);
  };

  const q = step >= 1 && step <= 3 ? QUESTIONS[step - 1] : null;
  return (
    <Screen back eyebrow={t('gate.found')} title={step === 5 ? t('gate.welcome', { name: display }) : t('gate.title2')} keyboard>
      <Animated.View key={step} entering={FadeInRight.duration(260)} exiting={FadeOutLeft.duration(160)} style={{ gap: space.lg }}>
        {step === 0 ? (
          <>
            <Text tone="muted">{t('gate.dear')} {t('gate.askName')}</Text>
            <Field label={t('gate.namePlaceholder')} value={name} onChangeText={setName} maxLength={40} autoComplete="given-name" />
            <Button label={t('gate.light')} onPress={() => setStep(1)} />
            <Button variant="ghost" label={t('gate.skip')} onPress={goBack} />
          </>
        ) : null}
        {q ? (
          <>
            <Text variant="eyebrow" tone="accent">{t('gate.question', { name: '', i: step, n: 3 })}</Text>
            <Text variant="heading">{t(`gate.${q.q}`)}</Text>
            {q.options.map(([v, label]) => (
              <Pressable key={v} accessibilityRole="button" onPress={() => { setAnswers((a) => ({ ...a, [q.key]: v })); setStep(step + 1); }}
                style={({ pressed }) => ({ borderWidth: 1, borderColor: answers[q.key] === v ? colors.accent : colors.border, borderRadius: radius.lg, padding: space.lg, backgroundColor: pressed ? colors.raisedHi : colors.surface })}>
                <Text variant="bodyStrong">{t(`gate.${label}`)}</Text>
              </Pressable>
            ))}
          </>
        ) : null}
        {step === 4 ? (
          <>
            <Text variant="heading">{t('gate.atmoQ')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
              {(Object.keys(ATMO_ART) as Atmosphere[]).map((a) => (
                <Pressable key={a} accessibilityRole="button" disabled={busy} onPress={() => finish(a)} style={({ pressed }) => ({ width: '47.5%', borderRadius: radius.lg, padding: space.md, gap: 4, backgroundColor: pressed ? colors.raisedHi : colors.raised, borderWidth: 1, borderColor: colors.border })}>
                  <View style={{ height: 90 }}><Art art={ATMO_ART[a]} /></View>
                  <Text variant="bodyStrong">{t(`atmo.${a}`)}</Text>
                  <Text variant="caption" tone="muted">{t(`atmo.${a}Blurb`)}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        {step === 5 ? (
          <>
            <Text tone="muted">{t('gate.waiting')}</Text>
            <Button label={t('gate.step')} onPress={() => router.replace('/')} />
          </>
        ) : null}
      </Animated.View>
    </Screen>
  );
}
