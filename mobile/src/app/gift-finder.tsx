// The Compass of Wishes — guided gift discovery. The server ranks products (POST /gift-finder).
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInRight, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';
import { api } from '@/api';
import { useI18n } from '@/i18n';
import { usePrefs } from '@/state/prefs';
import { haptic } from '@/lib/haptics';
import { colors, radius, space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Row } from '@/components/ui/Surface';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { ProductGrid } from '@/components/Product';
import { HiddenWonder } from '@/components/Common';
import type { ProductCard } from '@/api/types';

const STEPS = [
  { key: 'recipient', q: 's1', options: [['child', 'r_child'], ['teen', 'r_teen'], ['partner', 'r_partner'], ['parent', 'r_parent'], ['grandparent', 'r_grandparent'], ['friend', 'r_friend'], ['colleague', 'r_colleague'], ['self', 'r_self']] },
  { key: 'age', q: 's2', options: [['kids', 'a_kids'], ['teens', 'a_teens'], ['adults', 'a_adults'], ['seniors', 'a_seniors']] },
  { key: 'interests', multi: true, q: 's3', hint: 's3hint', options: [['decor', 'i_decor'], ['cozy', 'i_cozy'], ['magic', 'i_magic'], ['cooking', 'i_cooking'], ['reading', 'i_reading'], ['fashion', 'i_fashion'], ['games', 'i_games'], ['music', 'i_music'], ['outdoors', 'i_outdoors'], ['crafts', 'i_crafts']] },
  { key: 'budget', q: 's4', options: [['0-8000', 'b1'], ['8000-20000', 'b2'], ['20000-40000', 'b3'], ['40000-200000', 'b4']] },
  { key: 'personality', q: 's5', options: [['dreamer', 'p_dreamer'], ['classic', 'p_classic'], ['playful', 'p_playful'], ['elegant', 'p_elegant'], ['adventurous', 'p_adventurous'], ['cozy', 'p_cozy']] },
  { key: 'occasion', q: 's6', options: [['christmas', 'o_christmas'], ['new_year', 'o_new_year'], ['secret_santa', 'o_secret_santa'], ['thank_you', 'o_thank_you'], ['family', 'o_family']] },
] as const;

type Answers = { interests: string[]; [k: string]: string | string[] | undefined };

function Compass({ progress, done }: { progress: number; done: boolean }) {
  const deg = useSharedValue(-60);
  useEffect(() => { deg.set(withSpring(done ? 765 : progress * 300 - 60, { damping: 9, stiffness: 40 })); }, [done, progress, deg]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${deg.value}deg` }] }));
  return (
    <View style={{ width: 120, height: 120, alignSelf: 'center' }}>
      <Svg width={120} height={120} viewBox="0 0 200 200" style={{ position: 'absolute' }}>
        <Circle cx={100} cy={100} r={92} fill="rgba(14,24,56,0.7)" stroke={colors.accent} strokeOpacity={0.6} />
        {Array.from({ length: 36 }, (_, k) => <Line key={k} x1={100} y1={12} x2={100} y2={k % 9 === 0 ? 26 : 18} stroke={colors.accent} strokeOpacity={0.5} transform={`rotate(${k * 10} 100 100)`} />)}
      </Svg>
      <Animated.View style={[{ width: 120, height: 120 }, a]}>
        <Svg width={120} height={120} viewBox="0 0 200 200">
          <Polygon points="100,26 109,100 100,174 91,100" fill={colors.primary} />
          <Polygon points="100,100 109,100 100,174 91,100" fill={colors.onPrimary} />
          <Circle cx={100} cy={100} r={7} fill={colors.accent} />
        </Svg>
      </Animated.View>
    </View>
  );
}

export default function GiftFinder() {
  const { t } = useI18n();
  const persona = usePrefs((s) => s.persona);
  const { for: preset } = useLocalSearchParams<{ for?: string }>();
  const [answers, setAnswers] = useState<Answers>(preset ? { recipient: preset, interests: [] } : { interests: [] });
  const [i, setI] = useState(preset ? 1 : 0);
  const [results, setResults] = useState<ProductCard[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const step = STEPS[i];

  const find = async (a: Answers) => {
    setI(STEPS.length);
    setError(null);
    setLoading(true);
    const [min, max] = String(a.budget ?? '0-200000').split('-').map(Number);
    try {
      const r = await api.catalog.giftFinder({ recipient: a.recipient, age: a.age, interests: a.interests, budget: { min, max }, personality: a.personality, occasion: a.occasion });
      setResults(r.products);
    } catch (e) {
      setError(e);
    } finally { setLoading(false); }
  };
  const next = (a = answers) => (i < STEPS.length - 1 ? setI(i + 1) : find(a));
  const pick = (v: string) => {
    haptic.tap();
    if (step && 'multi' in step && step.multi) {
      const cur = answers.interests;
      setAnswers({ ...answers, interests: cur.includes(v) ? cur.filter((x) => x !== v) : cur.length < 3 ? [...cur, v] : cur });
      return;
    }
    const a = { ...answers, [step.key]: v };
    setAnswers(a);
    setTimeout(() => next(a), 200);
  };
  const restart = () => { setAnswers({ interests: [] }); setResults(null); setI(0); };

  return (
    <Screen back eyebrow={t('finder.eyebrow')} title={results ? `${t('finder.h1Result')} ${t('finder.here')}` : `${t('finder.h1a')} ${t('finder.h1b')} ${t('finder.h1c')}`}>
      <HiddenWonder id="tiny-reindeer" style={{ right: 6, top: 4 }} />
      <Compass progress={i / STEPS.length} done={!!results} />
      {i < STEPS.length && step ? (
        <Animated.View key={i} entering={FadeInRight.duration(240)} style={{ gap: space.lg }}>
          <View style={{ height: 4, backgroundColor: colors.raised, borderRadius: 2 }} accessibilityLabel={t('finder.progress')}>
            <View style={{ height: 4, width: `${(i / STEPS.length) * 100}%`, backgroundColor: colors.accent, borderRadius: 2 }} />
          </View>
          <Text variant="heading">{t(`finder.${step.q}`)}</Text>
          {'hint' in step ? <Text variant="caption" tone="muted">{t(`finder.${step.hint}`)}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {step.options.map(([v, label]) => {
              const on = step.key === 'interests' ? answers.interests.includes(v) : answers[step.key] === v;
              return (
                <Pressable key={v} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => pick(v)}
                  style={{ width: '48%', minHeight: 56, justifyContent: 'center', paddingHorizontal: space.lg, borderRadius: radius.lg, borderWidth: 1.5, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? 'rgba(242,196,109,0.1)' : colors.surface }}>
                  <Text variant="bodyStrong" tone={on ? 'accent' : 'default'}>{t(`finder.${label}`)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Row gap={space.sm}>
            {i > 0 ? <Button variant="secondary" label={t('common.back')} onPress={() => setI(i - 1)} /> : null}
            {step.key === 'interests' ? <Button style={{ flex: 1 }} label={i < STEPS.length - 1 ? t('common.next') : t('finder.show')} onPress={() => next()} /> : (
              <Button variant="ghost" label={t('finder.skipQ')} onPress={() => next()} />
            )}
          </Row>
        </Animated.View>
      ) : loading ? <LoadingState label={t('finder.spinning')} /> : error ? <ErrorState error={error} onRetry={() => find(answers)} /> : results && results.length === 0 ? (
        <EmptyState title={t('finder.undecided')} body={t('finder.undecidedBody')} action={t('finder.again')} onAction={restart} art={{ type: 'star' }} />
      ) : results ? (
        <View style={{ gap: space.lg }}>
          <Text tone="muted">{t('finder.summary', { name: persona?.name ? `${persona.name}, ` : '', n: results.length })}</Text>
          <ProductGrid products={results} />
          <Button variant="secondary" label={t('finder.someoneElse')} onPress={restart} />
          <Button variant="ghost" label={t('finder.browse')} onPress={() => router.push('/shop')} />
        </View>
      ) : null}
    </Screen>
  );
}
