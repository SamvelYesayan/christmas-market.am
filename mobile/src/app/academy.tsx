// Frostspire Academy — sorting ceremony (server decides the house), magical identity, acceptance letter,
// signature spell, the four houses and the Academy shop.
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInRight, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Polygon, Text as SvgText } from 'react-native-svg';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import { refreshUserData } from '@/api/queries';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { usePrefs, useCalm } from '@/state/prefs';
import { KEYS, getJson, setJson } from '@/lib/secureStorage';
import { haptic } from '@/lib/haptics';
import { colors, radius, space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card, Row, SectionHeader } from '@/components/ui/Surface';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { Crest, HiddenWonder } from '@/components/Common';
import { ProductRail } from '@/components/Product';
import { burst, celebrate } from '@/components/Celebration';
import type { House, Identity, SortResult } from '@/api/types';

const RUNES = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ'];

function Ceremony({ onSorted }: { onSorted: (r: SortResult) => void }) {
  const { t, lang } = useI18n();
  const user = useSession((s) => s.user);
  const persona = usePrefs((s) => s.persona);
  const qs = useQuery({ queryKey: ['sorting', lang], queryFn: ({ signal }) => api.academy.sorting({ signal }) });
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [thinking, setThinking] = useState(false);
  const questions = qs.data?.questions ?? [];
  const pick = async (k: number) => {
    haptic.tap();
    const next = [...answers, k];
    setAnswers(next);
    if (next.length < questions.length) { setI(i + 1); return; }
    setThinking(true);
    try {
      const [r] = await Promise.all([
        api.academy.sort(next, persona?.name && persona.name !== 'Traveller' ? persona.name : undefined),
        new Promise((res) => setTimeout(res, 2200)),
      ]);
      if (!user) await setJson(KEYS.guestHouse, r);
      else await refreshUserData();
      onSorted(r);
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
      setThinking(false);
      setAnswers([]);
      setI(0);
    }
  };
  if (qs.isLoading) return <LoadingState label={t('academy.waking')} />;
  if (qs.isError) return <ErrorState error={qs.error} onRetry={() => qs.refetch()} />;
  if (thinking) {
    return (
      <Animated.View entering={FadeIn} style={{ alignItems: 'center', gap: space.lg, paddingVertical: space.xxxl }}>
        <Svg width={140} height={140} viewBox="0 0 140 140"><Circle cx={70} cy={70} r={60} fill="#1b2a5c" stroke={colors.frost} strokeOpacity={0.5} /><Circle cx={70} cy={70} r={30} fill={colors.frost} opacity={0.25} /></Svg>
        <Text variant="subheading" font="displayItalic" align="center">{t('academy.thinking')}</Text>
      </Animated.View>
    );
  }
  const q = questions[i];
  return (
    <Animated.View key={i} entering={FadeInRight.duration(260)} style={{ gap: space.lg }}>
      <Text variant="eyebrow" tone="accent">{t('academy.asks', { i: i + 1, n: questions.length })}</Text>
      <Text variant="heading">{q?.question}</Text>
      {q?.answers.map((a, k) => (
        <Pressable key={k} accessibilityRole="button" onPress={() => pick(k)} style={({ pressed }) => ({ flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.lg, borderRadius: radius.lg, backgroundColor: pressed ? colors.raisedHi : colors.surface, borderWidth: 1, borderColor: colors.border })}>
          <Text variant="heading" tone="accent" style={{ width: 24 }}>{RUNES[k]}</Text>
          <Text style={{ flex: 1 }}>{a}</Text>
        </Pressable>
      ))}
    </Animated.View>
  );
}

function SpellCircle({ house }: { house: House }) {
  const { t } = useI18n();
  const calm = useCalm();
  const [casts, setCasts] = useState(0);
  const spin = useSharedValue(0);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const cast = () => {
    haptic.thud();
    burst(house.slug === 'starloom' || house.slug === 'pinehollow' ? 'frost' : 'gold');
    if (!calm) spin.set(withSequence(withTiming(spin.get() + 120, { duration: 600 })));
    setCasts((c) => c + 1);
  };
  const runes = ['ᚠ', 'ᚱ', 'ᛟ', 'ᛉ', 'ᚹ', 'ᛞ'];
  return (
    <View style={{ alignItems: 'center', gap: space.sm }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('academy.castAria')} onPress={cast}>
        <Animated.View style={a}>
          <Svg width={180} height={180} viewBox="0 0 200 200">
            <Circle cx={100} cy={100} r={90} fill="none" stroke={house.accent} strokeDasharray="4 8" />
            <Circle cx={100} cy={100} r={70} fill="none" stroke={house.accent} strokeOpacity={0.5} />
            <Polygon points="100,22 168,140 32,140" fill="none" stroke={house.accent} strokeOpacity={0.7} />
            <Polygon points="100,178 32,60 168,60" fill="none" stroke={house.accent} strokeOpacity={0.7} />
            {runes.map((r, k) => <SvgText key={k} x={100 + Math.cos((k / 6) * Math.PI * 2) * 80} y={104 + Math.sin((k / 6) * Math.PI * 2) * 80} fill={house.accent} textAnchor="middle" fontSize={14}>{r}</SvgText>)}
            <Circle cx={100} cy={100} r={16} fill={house.color} stroke={house.accent} strokeWidth={2} />
          </Svg>
        </Animated.View>
      </Pressable>
      <Text variant="caption" tone="muted">{t('academy.cast')}{casts ? t('academy.casts', { n: casts }) : ''}</Text>
    </View>
  );
}

function Profile({ result, onAgain }: { result: { house: House; identity: Identity; saved?: boolean; alreadySorted?: boolean }; onAgain?: () => void }) {
  const { t } = useI18n();
  const user = useSession((s) => s.user);
  const { house, identity } = result;
  const name = user?.name?.split(' ')[0] ?? t('greet.traveller');
  return (
    <View style={{ gap: space.xl }}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Crest color={house.color} accent={house.accent} size={120} />
        <Text variant="eyebrow" tone="accent">{result.alreadySorted === false || result.saved === false ? t('academy.spoken') : t('academy.welcomeBack')}</Text>
        <Text variant="hero" align="center">{house.name}</Text>
        <Text font="displayItalic" align="center" tone="muted">“{house.motto}”</Text>
        {house.description ? <Text align="center" tone="muted">{house.description}</Text> : null}
        {!user ? (
          <Text variant="label" align="center" tone="success">{t('academy.guest')} <Text variant="label" tone="accent" onPress={() => router.push('/register')}>{t('academy.guestLink')}</Text>{t('academy.guestTail')}</Text>
        ) : null}
      </View>
      <Card style={{ gap: space.md, borderColor: house.color, borderWidth: 1 }}>
        <Text variant="eyebrow" tone="faint">{t('academy.identity')}</Text>
        <Text variant="title" font="displayItalic">{identity.magicalName}</Text>
        {[
          [t('academy.house'), `${house.name} · ${house.animal}`],
          [t('academy.wand'), `${identity.wand.wood}, ${identity.wand.core}, ${identity.wand.length}`],
          [t('academy.familiar'), identity.familiar],
          [t('academy.constellation'), identity.constellation],
          [t('academy.spell'), identity.signatureSpell],
          [t('academy.sigil'), t('academy.sigilNo', { n: String(identity.sigil).padStart(3, '0') })],
        ].map(([k, v]) => <Row key={k} justify="space-between" align="flex-start" gap={space.md}><Text variant="caption" tone="muted">{k}</Text><Text variant="label" align="right" style={{ flex: 1 }}>{v}</Text></Row>)}
        <SpellCircle house={house} />
      </Card>
      <Card tone="paper" style={{ gap: space.md }}>
        <Text variant="eyebrow" tone="paperMuted" align="center">{t('academy.letterHead')}</Text>
        <Text variant="subheading" tone="paper" font="displayItalic">{t('academy.dear', { name: identity.magicalName ?? name })}</Text>
        <Text tone="paper">{t('academy.l1a')} {t('academy.title')} {t('academy.l1b')} {house.name}{t('academy.l1c', { element: (house.element ?? '').toLowerCase(), animal: house.animal.toLowerCase() })}</Text>
        <Text tone="paper">{t('academy.l2')}</Text>
        {[t('academy.l3', { wood: identity.wand.wood, core: identity.wand.core, length: identity.wand.length }), t('academy.l4'), t('academy.l5', { familiar: identity.familiar }), t('academy.l6')].map((l) => <Text key={l} tone="paper">· {l}</Text>)}
        <Text tone="paper">{t('academy.l7')} {identity.constellation}.</Text>
        <Text tone="paperMuted" font="displayItalic" align="right">{t('academy.signature')}</Text>
      </Card>
      {onAgain ? <Button variant="ghost" label={t('academy.again')} onPress={onAgain} /> : null}
    </View>
  );
}

export default function Academy() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const user = useSession((s) => s.user);
  const me = useQuery({ queryKey: ['academyMe', user?.id], queryFn: ({ signal }) => api.academy.me({ signal }) });
  const houses = useQuery({ queryKey: ['houses', lang], queryFn: ({ signal }) => api.academy.houses({ signal }) });
  const shop = useQuery({ queryKey: ['academyShop', lang], queryFn: ({ signal }) => api.academy.shop({ signal }) });
  const [ceremony, setCeremony] = useState(false);
  const [result, setResult] = useState<SortResult | null>(null);
  useEffect(() => {
    if (!user) void getJson<SortResult | null>(KEYS.guestHouse, null).then((r) => r && setResult(r));
  }, [user]);
  const sorted = me.data?.sorted && me.data.house && me.data.identity ? { house: me.data.house, identity: me.data.identity, saved: true, alreadySorted: true } : null;
  const shown = result ?? sorted;
  const onSorted = (r: SortResult) => {
    setResult(r);
    setCeremony(false);
    celebrate(r.reward, r.achievement);
    burst();
    void qc.invalidateQueries({ queryKey: ['academyMe'] });
    void qc.invalidateQueries({ queryKey: ['houses'] });
  };
  return (
    <Screen back eyebrow={t('academy.eyebrow')} title={t('academy.title')}>
      <HiddenWonder id="moon-feather" style={{ right: 10, top: 6 }} />
      {me.isLoading ? <LoadingState label={t('academy.waking')} /> : ceremony ? <Ceremony onSorted={onSorted} /> : shown ? (
        <Profile result={shown} onAgain={!user ? () => { void setJson(KEYS.guestHouse, null); setResult(null); setCeremony(true); } : undefined} />
      ) : (
        <View style={{ gap: space.lg }}>
          <Text tone="muted">{t('academy.intro')}</Text>
          <Button label={t('academy.begin')} icon="wand" onPress={() => { haptic.press(); setCeremony(true); }} />
        </View>
      )}
      {houses.data?.houses.length ? (
        <View style={{ gap: space.md }}>
          <SectionHeader eyebrow={t('academy.housesEyebrow')} title={t('academy.housesTitle')} />
          {houses.data.houses.map((h) => (
            <Card key={h.slug} tone="surface" style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
              <Crest color={h.color} accent={h.accent} size={48} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="subheading">{h.name}</Text>
                <Text variant="caption" tone="muted" font="displayItalic">“{h.motto}”</Text>
                <Text variant="caption" tone="faint">{h.animal}{h.element ? ` · ${h.element}` : ''}{h.members != null ? ` · ${t('academy.students', { n: h.members })}` : ''}</Text>
              </View>
            </Card>
          ))}
        </View>
      ) : null}
      <View style={{ gap: space.md }}>
        <Row gap={space.md}>
          <Card style={{ flex: 1, gap: 2 }} onPress={() => router.push('/games/mystery')}><Text variant="eyebrow" tone="accent">{t('academy.tile1e')}</Text><Text variant="label">{t('academy.tile1')}</Text></Card>
          <Card style={{ flex: 1, gap: 2 }} onPress={() => router.push('/games/quiz')}><Text variant="eyebrow" tone="accent">{t('academy.tile2e')}</Text><Text variant="label">{t('academy.tile2')}</Text></Card>
        </Row>
        <Card style={{ gap: 2 }} onPress={() => router.push('/games/hidden')}><Text variant="eyebrow" tone="accent">{t('academy.tile3e')}</Text><Text variant="label">{t('academy.tile3')}</Text></Card>
      </View>
      {shop.data?.products.length ? (
        <View>
          <SectionHeader eyebrow={t('academy.shopEyebrow')} title={t('academy.shopTitle')} />
          <Text variant="caption" tone="muted" style={{ marginBottom: space.md }}>{t('academy.shopBody')}</Text>
          <ProductRail products={shop.data.products} />
        </View>
      ) : null}
    </Screen>
  );
}
