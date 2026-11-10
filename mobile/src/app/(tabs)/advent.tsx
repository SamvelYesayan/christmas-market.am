// Christmas Calendar — 31 Days of Gifts. One window a day, 1–31 December; the 31st holds the Grand Prize.
// Every rule (what "today" is, one claim per day, no catching up, Grand Prize eligibility) is decided by the server.
import { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import { api, isApiError } from '@/api';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { useCalm } from '@/state/prefs';
import { mediaUrl } from '@/lib/config';
import { haptic } from '@/lib/haptics';
import { colors, radius, space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Badge, Card, Row } from '@/components/ui/Surface';
import { ErrorState, FormError, LoadingState } from '@/components/ui/States';
import { Sheet } from '@/components/ui/Sheet';
import { Icon, LockBadge } from '@/components/ui/Icon';
import { toast } from '@/components/ui/Toast';
import { Art } from '@/components/Art';
import { ProductTile } from '@/components/Product';
import { CouponTicket, SignInGate } from '@/components/Common';
import { burst, celebrate } from '@/components/Celebration';
import { useCalendar } from '@/features/calendar/useCalendar';
import type { CalendarDay, CalendarState, ClaimResult, GiftContent } from '@/api/types';

const PAPERS: [string, string][] = [['#c8102e', '#f2c46d'], ['#0f6b4f', '#f6e7c1'], ['#1b2a5c', '#f2c46d'], ['#7a2a1e', '#f6e7c1'], ['#b8860b', '#7a1020'], ['#2a4fa8', '#fff6dc']];
const paper = (day: number) => PAPERS[(day * 7) % PAPERS.length];

function Received({ content }: { content: GiftContent | null | undefined }) {
  const { t } = useI18n();
  if (!content) return null;
  const r = content.reward;
  return (
    <View style={{ gap: space.md }}>
      {content.image ? <Image source={{ uri: mediaUrl(content.image)! }} style={{ width: '100%', aspectRatio: 1.6, borderRadius: radius.md }} contentFit="cover" /> : null}
      <Text variant="subheading" tone="paper">{content.title}</Text>
      {content.description ? <Text tone="paperMuted">{content.description}</Text> : null}
      {content.story ? <Text tone="paper" style={{ fontStyle: 'italic' }}>{content.story}</Text> : null}
      {content.text ? <Text tone="paper">{content.text}</Text> : null}
      {r?.kind === 'coupon' && r.couponCode ? <CouponTicket code={r.couponCode} title={t('advent.yourCode')} note={t('advent.codeNote')} /> : null}
      {r?.kind === 'points' ? <Text variant="bodyStrong" tone="paper">{t('advent.points', { n: r.points ?? 0 })}</Text> : null}
      {content.product ? <View style={{ width: 170 }}><ProductTile product={content.product} width={170} /></View> : null}
      {content.game ? <Button variant="paper" size="sm" label={t('advent.playNow')} onPress={() => router.push(`/games/${content.game}` as never)} style={{ alignSelf: 'flex-start' }} /> : null}
    </View>
  );
}

function DaySheet({ win, data, onClose, onClaimed }: { win: CalendarDay; data: CalendarState; onClose: () => void; onClaimed: (r: ClaimResult | null) => void }) {
  const { t } = useI18n();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const [choice, setChoice] = useState<string | null>(win.options?.length === 1 ? win.options[0].key : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const grand = win.isGrand;
  const g = data.grand;
  const shown = result?.window ?? win;
  const needsChoice = shown.status === 'available' && !!shown.configured && (shown.options?.length ?? 0) > 0;

  const claim = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.calendar.claim(win.day, choice ?? undefined);
      setResult(r);
      onClaimed(r);
      haptic.success();
      const reward = r.window.received?.content?.reward;
      if (reward || r.achievements?.[0]) celebrate(reward, r.achievements?.[0]);
      else burst();
    } catch (e) {
      setError(e);
      if (isApiError(e) && ['already_claimed', 'day_missed', 'day_locked', 'grand_not_eligible'].includes(e.code)) onClaimed(null);
    } finally {
      setBusy(false);
    }
  };

  const grandLost = grand && g?.status === 'lost';
  const ineligible = g ? <Card tone="outline" style={{ gap: 4, borderColor: colors.paperMuted }}><Text variant="bodyStrong" tone="paper">{t('advent.notEligibleTitle')}</Text><Text tone="paperMuted">{t('advent.notEligibleBody', { days: g.missed.join(', ') })}</Text></Card> : null;
  let body: React.ReactNode;
  if (shown.status === 'completed') {
    const outcome = shown.received?.outcome;
    body = (
      <View style={{ gap: space.md }}>
        <Text variant="heading" tone="paper">{grand ? t('advent.grandEntered') : result ? t('advent.claimedTitle') : t('advent.completedTitle', { day: shown.day })}</Text>
        {grand ? <Text tone="paperMuted">{t('advent.grandEnteredBody')}</Text> : outcome === 'check_in' ? <Text tone="paperMuted">{t('advent.checkInBody')}</Text> : outcome === 'sold_out' ? <Text tone="paperMuted">{t('advent.soldOutBody')}</Text> : null}
        <Received content={shown.received?.content} />
        {result && !grand ? <Text variant="label" tone="paperMuted">{shown.day < 30 ? t('advent.comeBack', { day: shown.day + 1 }) : t('advent.comeBackGrand')}</Text> : null}
      </View>
    );
  } else if (shown.status === 'available') {
    body = (
      <View style={{ gap: space.md }}>
        {shown.image ? <Image source={{ uri: mediaUrl(shown.image)! }} style={{ width: '100%', aspectRatio: 1.6, borderRadius: radius.md }} contentFit="cover" /> : null}
        <Text variant="heading" tone="paper">{grand ? shown.title ?? t('advent.grandTitle') : shown.configured ? shown.title : t('advent.wrappingTitle')}</Text>
        {shown.configured ? (shown.description || shown.teaser ? <Text tone="paperMuted">{shown.description ?? shown.teaser}</Text> : null) : !grand ? <Text tone="paperMuted">{t('advent.wrappingBody')}</Text> : null}
        {grand && shown.description == null ? <Text tone="paperMuted">{t('advent.grandLead')}</Text> : null}
        {shown.giftsLeft != null ? <Text variant="label" tone="paper">{t('advent.giftsLeft', { n: shown.giftsLeft })}</Text> : null}
        {grandLost ? ineligible : !signedIn ? <SignInGate body={t('advent.signInBody')} next="/advent" /> : (
          <>
            {needsChoice ? (
              <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
                <Text variant="label" tone="paperMuted">{t('advent.choose')}</Text>
                {shown.options!.map((o) => {
                  const on = choice === o.key;
                  return (
                    <Pressable key={o.key} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => { haptic.tap(); setChoice(o.key); }}
                      style={{ borderWidth: 1.5, borderColor: on ? colors.paperInk : colors.paperEdge, borderRadius: radius.md, padding: space.md, gap: 2, backgroundColor: on ? '#EFE2C4' : 'transparent' }}>
                      <Row justify="space-between"><Text variant="bodyStrong" tone="paper" style={{ flex: 1 }}>{o.title}</Text>{on ? <Icon name="check" color={colors.paperInk} /> : null}</Row>
                      {o.description ? <Text variant="caption" tone="paperMuted">{o.description}</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <FormError error={error} />
            <Button variant="paper" testID="calendar-claim" loading={busy} disabled={busy || (needsChoice && !choice)} label={busy ? t('advent.claiming') : grand ? t('advent.grandEnter') : shown.configured ? t('advent.claim') : t('advent.markDay')} onPress={claim} />
          </>
        )}
      </View>
    );
  } else {
    body = (
      <View style={{ gap: space.md }}>
        <Text variant="heading" tone="paper">{shown.title ?? t('advent.grandTitle')}</Text>
        <Text tone="paperMuted">{shown.description ?? t('advent.grandLead')}</Text>
        {!shown.title ? <Text variant="caption" tone="paperMuted">{t('advent.grandSoon')}</Text> : null}
        {g ? (g.status === 'lost' ? ineligible : <Text variant="label" tone="paper">{t(`advent.st_${g.status}`)} · {t('advent.grandCount', { n: g.completed })}</Text>) : null}
        {!signedIn ? <SignInGate body={t('advent.signInBody')} next="/advent" /> : null}
        <Text variant="caption" tone="paperMuted">{t('advent.grandOpens')}</Text>
      </View>
    );
  }
  return (
    <Sheet visible onClose={onClose} tone="paper" locked={busy} title={grand ? t('advent.grandDayLabel') : t('advent.dayLabel', { day: win.day })}>
      <View style={{ height: 120, alignSelf: 'center', aspectRatio: 1 }}>
        <Art art={{ type: grand ? 'star' : 'giftbox', c1: paper(win.day)[0], c2: paper(win.day)[1] }} />
      </View>
      {body}
    </Sheet>
  );
}

function DayCell({ w, size, onPress }: { w: CalendarDay; size: number; onPress: () => void }) {
  const { t } = useI18n();
  const calm = useCalm();
  const shake = useSharedValue(0);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const [box, ribbon] = paper(w.day);
  const locked = w.status === 'locked';
  const done = w.status === 'completed';
  const missed = w.status === 'missed' || w.status === 'closed';
  return (
    <Animated.View style={a}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('advent.dayAria', { day: w.day, state: t(`advent.s_${w.status}`) })}
        onPress={() => {
          if (locked && !calm) shake.set(withSequence(withTiming(-5, { duration: 60 }), withTiming(5, { duration: 60 }), withTiming(0, { duration: 60 })));
          onPress();
        }}
        style={[styles.cell, { width: size, height: size * 1.12, backgroundColor: done ? colors.paper : missed ? colors.surface : box, borderColor: w.isToday ? colors.accent : 'transparent', opacity: missed ? 0.55 : 1 }]}
      >
        {!done && !missed ? <View style={[styles.ribbonV, { backgroundColor: ribbon }]} /> : null}
        {!done && !missed ? <View style={[styles.ribbonH, { backgroundColor: ribbon }]} /> : null}
        <View style={[styles.num, { backgroundColor: done ? colors.paperInk : 'rgba(11,20,48,0.78)' }]}>
          <Text variant="label" font="bodyBold" color={done ? colors.paper : colors.text}>{w.day}</Text>
        </View>
        <View style={styles.state}>
          {done ? <Icon name="check" size={18} color={colors.paperInk} strokeWidth={2.5} /> : locked ? <LockBadge color="rgba(246,248,255,0.8)" /> : missed ? <Icon name="close" size={14} color={colors.textFaint} /> : <Icon name="sparkle" size={16} color={colors.accentHi} />}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function Calendar() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const cal = useCalendar();
  const [open, setOpen] = useState<number | null>(null);
  const data = cal.data;
  const cols = 5;
  const size = Math.floor((width - space.lg * 2 - space.sm * (cols - 1)) / cols);

  const choose = (w: CalendarDay) => {
    haptic.tap();
    if (w.status === 'locked' && !w.isGrand) return toast(t('advent.lockedToast', { day: w.day }), { icon: 'lock' });
    if (w.status === 'missed') return toast(t('advent.missedToast', { day: w.day }), { icon: 'clock' });
    if (w.status === 'closed') return toast(t('advent.closedToast', { day: w.day }), { icon: 'clock' });
    setOpen(w.day);
  };
  const claimed = (r: ClaimResult | null) => {
    if (!r) { void cal.refetch(); return; }
    // The claim response carries the server's new window, progress and Grand Prize state.
    qc.setQueriesData<CalendarState>({ queryKey: ['calendar'] }, (d) => (d ? { ...d, progress: r.progress, grand: r.grand, days: d.days.map((x) => (x.day === r.day ? r.window : x)) } : d));
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  if (cal.isLoading) return <Screen tabBar title={t('advent.title')}><LoadingState label={t('advent.loading')} /></Screen>;
  if (cal.isError || !data) return <Screen tabBar title={t('advent.title')}><ErrorState error={cal.error} onRetry={() => cal.refetch()} /></Screen>;

  const today = data.todayDay ? data.days[data.todayDay - 1] : null;
  const g = data.grand;
  const grandWin = data.days[30];
  const pct = (data.progress.completed / data.progress.total) * 100;
  return (
    <Screen tabBar eyebrow={t('advent.eyebrow', { year: data.year })} title={t('advent.h1')} refreshing={cal.isRefetching} onRefresh={() => cal.refetch()}>
      <Text tone="muted">{t('advent.sub')}</Text>
      <Card tone="surface" style={{ gap: space.md }}>
        <Text variant="label">{signedIn ? t('advent.progress', { n: data.progress.completed, total: data.progress.total }) : t('advent.progressGuest')}</Text>
        <View style={{ height: 8, backgroundColor: colors.raised, borderRadius: 4, overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: data.progress.total, now: data.progress.completed }}>
          <View style={{ height: 8, width: `${pct}%`, backgroundColor: colors.accent }} />
        </View>
        {g ? <Badge label={t(`advent.st_${g.status}`)} tone={g.status === 'lost' ? 'muted' : 'gold'} /> : null}
        {data.phase === 'before' ? <Text variant="bodyStrong">{data.startsIn === 1 ? t('advent.beforeTomorrow') : t('advent.beforeTitle', { n: data.startsIn ?? 0 })}</Text>
          : data.phase === 'over' ? <Text variant="bodyStrong">{t('advent.overTitle')}</Text>
            : today ? (today.status === 'available'
              ? <Button testID="calendar-open-today" label={today.isGrand ? t('advent.openGrand') : t('advent.openToday', { day: today.day })} icon="gift" onPress={() => choose(today)} />
              : <Text variant="bodyStrong" tone="success">{t('advent.todayDone')}</Text>) : null}
        {!signedIn ? <Button variant="secondary" label={t('advent.signIn')} onPress={() => router.push({ pathname: '/login', params: { next: '/advent' } })} /> : null}
      </Card>
      <Text variant="caption" tone="faint">{t('advent.rules')}</Text>
      <Row wrap gap={space.lg}>
        {(['available', 'completed', 'missed', 'locked'] as const).map((s) => (
          <Row key={s} gap={6}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s === 'available' ? colors.accent : s === 'completed' ? colors.paper : s === 'missed' ? colors.raisedHi : colors.primary }} /><Text variant="caption" tone="muted">{t(`advent.lg_${s}`)}</Text></Row>
        ))}
      </Row>
      <View style={styles.grid}>
        {data.days.slice(0, 30).map((w) => <DayCell key={w.day} w={w} size={size} onPress={() => choose(w)} />)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('advent.grandAria', { state: t(`advent.s_${grandWin.status}`) })} onPress={() => choose(grandWin)}
        style={[styles.grand, { borderColor: grandWin.isToday ? colors.accent : colors.accentLo }]}>
        <View style={{ width: 84, height: 84 }}><Art art={{ type: 'star' }} /></View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="eyebrow" tone="accent">{t('advent.grandDayLabel')}</Text>
          <Text variant="heading">{grandWin.title ?? t('advent.grandTitle')}</Text>
          <Text variant="caption" tone="muted">{t('advent.grandLead')}</Text>
          {g ? <Text variant="caption" tone="accent">{t('advent.grandCount', { n: g.completed })}</Text> : null}
        </View>
      </Pressable>
      {open ? <DaySheet key={open} win={data.days[open - 1]} data={data} onClose={() => setOpen(null)} onClaimed={claimed} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { borderRadius: radius.md, borderWidth: 2, overflow: 'hidden', justifyContent: 'space-between', padding: 6 },
  ribbonV: { position: 'absolute', top: 0, bottom: 0, left: '44%', width: '12%' },
  ribbonH: { position: 'absolute', left: 0, right: 0, top: '40%', height: '11%' },
  num: { alignSelf: 'flex-start', borderRadius: radius.pill, minWidth: 26, height: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  state: { alignSelf: 'flex-end' },
  grand: { flexDirection: 'row', gap: space.lg, alignItems: 'center', backgroundColor: '#14204A', borderRadius: radius.xl, borderWidth: 2, padding: space.lg },
});
