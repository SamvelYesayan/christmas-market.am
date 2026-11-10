// Home — same order as the website: categories, popular gifts, offers, Pioneer Card, how shopping works; then the
// calendar, the extras, wishes, events, reviews and newsletter. All content from /content/home.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '@/api';
import { usePioneerStatus } from '@/api/queries';
import { useI18n } from '@/i18n';
import { usePrefs } from '@/state/prefs';
import { useSession } from '@/state/session';
import { colors, radius, space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, OrnamentRule, Row, SectionHeader, Badge } from '@/components/ui/Surface';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { Field, Check } from '@/components/ui/Input';
import { Icon, type IconName } from '@/components/ui/Icon';
import { toast } from '@/components/ui/Toast';
import { Art } from '@/components/Art';
import { ProductRail } from '@/components/Product';
import { CouponTicket, HiddenWonder, Snowfall } from '@/components/Common';
import { CardVisual } from '@/features/pioneer/CardVisual';
import { useCalendar } from '@/features/calendar/useCalendar';
import { WishesPreview } from '@/features/wishes/WishesPreview';
import type { Art as ArtSpec } from '@/api/types';

function greetingKey(h = new Date().getHours()) {
  return h < 5 ? 'greet.night' : h < 12 ? 'greet.morning' : h < 18 ? 'greet.afternoon' : 'greet.evening';
}

function Hero() {
  const { t } = useI18n();
  const user = useSession((s) => s.user);
  const persona = usePrefs((s) => s.persona);
  const name = user?.profile.displayName?.split(' ')[0] ?? persona?.name;
  return (
    <View style={styles.hero}>
      <Snowfall height={250} />
      <Row justify="space-between" align="flex-start">
        <View style={{ flex: 1, gap: space.xs }}>
          <Text variant="eyebrow" tone="accent">{t(greetingKey())}</Text>
          <Text variant="hero">{name ? t('m.greetingName', { name }) : t('m.greetingGuest')}</Text>
          <Text tone="muted">{t('home.heroPurpose')}</Text>
        </View>
        <IconButton icon="menu" label={t('nav.more')} onPress={() => router.push('/more')} />
      </Row>
      <Row gap={space.sm} wrap>
        <Button label={t('home.heroCta')} onPress={() => router.push('/shop')} />
        <Button label={t('home.ctaFinder')} variant="ghost" onPress={() => router.push('/gift-finder')} />
      </Row>
      {!persona && !user ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/account/welcome')} style={styles.persona}>
          <Icon name="sparkle" size={18} color={colors.accent} />
          <Text variant="label" tone="accent" style={{ flex: 1 }}>{t('home.personalise')}</Text>
          <Icon name="chevron" size={18} color={colors.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

function TodayCard() {
  const { t } = useI18n();
  const cal = useCalendar();
  const d = cal.data;
  if (!d) return null;
  const today = d.todayDay ? d.days[d.todayDay - 1] : null;
  const line = d.phase === 'before' ? (d.startsIn === 1 ? t('advent.beforeTomorrow') : t('advent.beforeTitle', { n: d.startsIn ?? 0 }))
    : d.phase === 'over' ? t('advent.overTitle')
      : today?.status === 'available' ? (today.isGrand ? t('advent.openGrand') : t('advent.openToday', { day: today.day })) : t('advent.todayDone');
  return (
    <Card tone="paper" onPress={() => router.push('/advent')} accessibilityLabel={line}>
      <Row gap={space.lg}>
        <View style={{ width: 72, height: 72 }}><Art art={{ type: 'giftbox', c1: '#c8102e', c2: '#f2c46d' }} /></View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="eyebrow" tone="paperMuted">{t('advent.title')}</Text>
          <Text variant="subheading" tone="paper">{line}</Text>
          {d.signedIn ? <Text variant="caption" tone="paperMuted">{t('advent.progress', { n: d.progress.completed, total: d.progress.total })}</Text> : null}
        </View>
        <Icon name="chevron" color={colors.paperInk} />
      </Row>
    </Card>
  );
}

const DOORS: { to: string; icon: IconName; title: string; body: string; art: ArtSpec }[] = [
  { to: '/gift-finder', icon: 'compass', title: 'nav.finder', body: 'home.moreFinder', art: { type: 'giftbox', c1: '#f2c46d', c2: '#c8102e' } },
  { to: '/games', icon: 'star', title: 'home.moreFunTitle', body: 'home.moreFun', art: { type: 'star', c1: '#2a4fa8', c2: '#f2c46d' } },
  { to: '/academy', icon: 'wand', title: 'nav.academy', body: 'home.moreAcademy', art: { type: 'wand', c1: '#e8dcc4', c2: '#a9c7ff' } },
  { to: '/wishes', icon: 'quill', title: 'm.wishes', body: 'wishes.lede', art: { type: 'scroll', c1: '#f5ecd7', c2: '#c8102e' } },
];

/** What the Pioneer Card gives, and the one step to get it. */
function PioneerBand() {
  const { t } = useI18n();
  const user = useSession((s) => s.user);
  const ps = usePioneerStatus();
  const p = ps.data?.discountPercent ?? 5;
  const linked = !!user?.pioneer;
  return (
    <Card style={{ gap: space.md }}>
      <CardVisual masked={linked ? user!.pioneer!.cardMasked : null} holder={linked ? user!.pioneer!.holderName : null} empty={!linked} />
      <Text variant="heading">{t('home.pioneerTitle')}</Text>
      <Text variant="label" tone="muted">{t('pc.benefit1', { p })}</Text>
      <Button label={linked ? t('pc.goToCard') : t('pc.connect')} onPress={() => router.push(linked ? '/account/pioneer' : '/pioneer')} />
    </Card>
  );
}

function HowItWorks() {
  const { t } = useI18n();
  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title={t('home.howTitle')} />
      {[1, 2, 3].map((n) => (
        <Row key={n} gap={space.md} align="flex-start">
          <View style={styles.howNum}><Text variant="label" font="bodyBold" color={colors.onAccent}>{n}</Text></View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{t(`home.how${n}t`)}</Text>
            <Text variant="caption" tone="muted">{t(`home.how${n}b`)}</Text>
          </View>
        </Row>
      ))}
    </View>
  );
}

function Doors() {
  const { t } = useI18n();
  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title={t('home.moreTitle')} />
      <View style={styles.doorGrid}>
        {DOORS.map((d) => (
          <Card key={d.to} style={styles.door} onPress={() => router.push(d.to as never)} accessibilityLabel={t(d.title)}>
            <View style={{ width: 56, height: 56 }}><Art art={d.art} /></View>
            <Text variant="subheading" numberOfLines={2}>{t(d.title)}</Text>
            <Text variant="caption" tone="muted" numberOfLines={3}>{t(d.body)}</Text>
          </Card>
        ))}
      </View>
    </View>
  );
}

function Newsletter() {
  const { t } = useI18n();
  const user = useSession((s) => s.user);
  const [email, setEmail] = useState(user?.email ?? '');
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);
  const valid = z.string().email().safeParse(email.trim()).success;
  const m = useMutation({
    mutationFn: () => api.content.newsletter(email.trim().toLowerCase(), user?.name),
    onSuccess: () => { setDone(true); toast(t('home.letterSent'), { tone: 'success', icon: 'check' }); },
    onError: (e: Error) => toast(e.message, { tone: 'error' }),
  });
  return (
    <Card tone="surface" style={{ gap: space.md }}>
      <Row gap={space.md}><Icon name="scroll" color={colors.accent} /><Text variant="subheading">{t('m.newsletter')}</Text></Row>
      {done ? <Text tone="success">{t('m.subscribed')}</Text> : (
        <>
          <Text variant="label" tone="muted">{t('m.newsletterBody')}</Text>
          <Field label={t('home.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="your@email.am" />
          <Check label={t('home.consentLetters')} value={consent} onChange={setConsent} />
          <Button label={t('home.sendLetters')} variant="ember" disabled={!valid || !consent} loading={m.isPending} onPress={() => m.mutate()} />
        </>
      )}
    </Card>
  );
}

export default function Home() {
  const { t, date, lang } = useI18n();
  const content = useQuery({ queryKey: ['home', lang], queryFn: ({ signal }) => api.content.home({ signal }) });
  const cats = useQuery({ queryKey: ['categories', lang], queryFn: ({ signal }) => api.catalog.categories({ signal }) });
  const reviews = useQuery({ queryKey: ['reviews', lang], queryFn: ({ signal }) => api.catalog.reviewHighlights({ signal }) });
  const c = content.data;
  const refresh = () => { void content.refetch(); void cats.refetch(); void reviews.refetch(); };
  return (
    <Screen tabBar refreshing={content.isRefetching} onRefresh={refresh}>
      <HiddenWonder id="golden-acorn" style={{ right: 8, top: 210 }} />
      <Hero />
      {c?.banners?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }} style={{ marginRight: -space.lg }}>
          {c.banners.map((b) => (
            <Card key={b.id} style={{ width: 280, gap: space.xs }} tone="surface" onPress={b.ctaLink ? () => router.push(b.ctaLink as never) : undefined}>
              <Text variant="subheading">{b.title}</Text>
              {b.subtitle ? <Text variant="caption" tone="muted">{b.subtitle}</Text> : null}
              {b.ctaLabel ? <Text variant="label" tone="accent">{b.ctaLabel}</Text> : null}
            </Card>
          ))}
        </ScrollView>
      ) : null}
      {content.isError ? <ErrorState error={content.error} onRetry={() => content.refetch()} compact /> : null}
      {cats.data?.categories.length ? (
        <View style={{ gap: space.md }}>
          <SectionHeader title={t('home.stallsTitle')} action={t('home.allCats')} onAction={() => router.push('/shop')} />
          <View style={styles.catGrid}>
            {cats.data.categories.slice(0, 8).map((cat) => (
              <Pressable key={cat.slug} accessibilityRole="button" accessibilityLabel={cat.name} onPress={() => router.push({ pathname: '/shop', params: { category: cat.slug } })} style={styles.cat}>
                <View style={{ width: 44, height: 44 }}><Art art={cat.art} /></View>
                <View style={{ flex: 1 }}>
                  <Text variant="label" font="bodyBold" numberOfLines={2}>{cat.name}</Text>
                  <Text variant="caption" tone="faint">{t('home.giftsCount', { n: cat.productCount })}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      <View>
        <SectionHeader title={t('home.wishedTitle')} action={t('m.seeAll')} onAction={() => router.push('/shop')} />
        {c ? <ProductRail products={c.featured.length ? c.featured : c.bestsellers} /> : <Row gap={space.md}><Skeleton height={260} width={156} /><Skeleton height={260} width={156} /></Row>}
      </View>
      {c?.limited.length ? (
        <View>
          <SectionHeader title={t('m.limited')} action={t('m.seeAll')} onAction={() => router.push({ pathname: '/shop', params: { limited: 'true' } })} />
          <ProductRail products={c.limited} />
        </View>
      ) : null}
      {c?.campaigns.length || c?.onSale.length ? (
        <View style={{ gap: space.md }}>
          <SectionHeader title={t('home.sealedTitle')} action={t('m.seeAll')} onAction={() => router.push({ pathname: '/shop', params: { onSale: 'true' } })} />
          {c.campaigns.map((cp) => (
            <Card key={cp.id} style={{ gap: space.sm }}>
              {cp.pioneerOnly ? <Row gap={space.sm}><Badge label={t('home.pioneerOnly')} /></Row> : null}
              <Text variant="subheading">{cp.headline}</Text>
              {cp.body ? <Text tone="muted">{cp.body}</Text> : null}
              {cp.couponCode ? <CouponTicket code={cp.couponCode} title={t('m.discountCode')} /> : null}
            </Card>
          ))}
          {c.onSale.length ? <ProductRail products={c.onSale} /> : null}
        </View>
      ) : null}
      <PioneerBand />
      <HowItWorks />
      <TodayCard />
      <Doors />
      <OrnamentRule />
      <WishesPreview />
      {c?.events.length ? (
        <View style={{ gap: space.md }}>
          <SectionHeader eyebrow={t('home.eventsEyebrow')} title={t('home.eventsTitle')} />
          {c.events.map((e) => (
            <Card key={e.id} tone="surface" style={{ flexDirection: 'row', gap: space.lg }}>
              <View style={styles.dateBox}>
                <Text variant="heading" tone="accent">{new Date(e.startsAt).getDate()}</Text>
                <Text variant="eyebrow" tone="muted">{date(e.startsAt).replace(/^\d+\s*/, '').split(' ')[0]}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{e.title}</Text>
                {e.description ? <Text variant="caption" tone="muted">{e.description}</Text> : null}
                {e.location ? <Row gap={4}><Icon name="map" size={14} color={colors.textFaint} /><Text variant="caption" tone="faint">{e.location}</Text></Row> : null}
              </View>
            </Card>
          ))}
        </View>
      ) : null}
      {reviews.data?.reviews.length ? (
        <View>
          <SectionHeader title={t('home.postcards')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }} style={{ marginRight: -space.lg }}>
            {reviews.data.reviews.map((r, i) => (
              <Card key={i} tone="paper" style={{ width: 260, gap: space.sm }}>
                <Text variant="caption" tone="paperMuted">{t('home.ofFive', { n: r.rating })}</Text>
                <Text tone="paper" numberOfLines={5} style={{ fontStyle: 'italic' }}>“{r.body}”</Text>
                <Text variant="label" tone="paperMuted">— {r.author}{r.city ? `, ${r.city}` : ''}</Text>
              </Card>
            ))}
          </ScrollView>
        </View>
      ) : null}
      <Newsletter />
      <Row justify="center" gap={space.lg} wrap>
        <Button variant="ghost" size="sm" label={t('nav.track')} icon="truck" onPress={() => router.push('/track')} />
        <Button variant="ghost" size="sm" label={t('m.help')} icon="info" onPress={() => router.push('/info/delivery')} />
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.lg, paddingTop: space.md, minHeight: 210 },
  persona: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderColor: colors.accentLo, borderRadius: radius.pill, paddingHorizontal: space.lg, minHeight: 44, borderStyle: 'dashed' },
  doorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  door: { width: '47.5%', gap: space.xs, minHeight: 170 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cat: { width: '48.8%', minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  howNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  dateBox: { width: 56, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border, paddingRight: space.md },
});
