// Catch the Falling Gifts — native arcade round. The server issues the seed (start) and judges the score (finish).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { G, Path, Rect, Circle, Text as SvgText } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { haptic } from '@/lib/haptics';
import { colors, radius, space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card, Row } from '@/components/ui/Surface';
import { toast } from '@/components/ui/Toast';
import { SignInGate } from '@/components/Common';
import { celebrate } from '@/components/Celebration';
import { DURATION, moveSleigh, newRound, snapshot, step, type Round, type Snapshot } from '@/features/games/catchEngine';
import type { FinishResult } from '@/api/types';

type Phase = 'ready' | 'starting' | 'playing' | 'sending' | 'done';

export default function CatchGame() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const [phase, setPhase] = useState<Phase>('ready');
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [result, setResult] = useState<FinishResult | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const round = useRef<Round | null>(null);
  const session = useRef<string | null>(null);
  const raf = useRef<number | null>(null);
  const lastScore = useRef(0);

  const finish = useCallback(async () => {
    const g = round.current;
    if (!g || !session.current) return;
    setPhase('sending');
    try {
      const r = await api.games.finish('catch', { sessionId: session.current, score: g.score, state: { catches: g.catches } });
      setResult(r);
      if (r.reward || r.achievement) celebrate(r.reward, r.achievement);
      void qc.invalidateQueries({ queryKey: ['games'] });
      void qc.invalidateQueries({ queryKey: ['challenges'] });
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally {
      setPhase('done');
    }
  }, [qc]);

  useEffect(() => {
    if (phase !== 'playing') return;
    let last = Date.now();
    const loop = () => {
      const now = Date.now();
      const g = round.current!;
      const running = step(g, (now - last) / 1000);
      last = now;
      if (g.score !== lastScore.current) {
        if (g.score > lastScore.current) haptic.tap(); else haptic.warning();
        lastScore.current = g.score;
      }
      setSnap(snapshot(g));
      if (!running) { void finish(); return; }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [phase, finish]);

  const start = async () => {
    if (!size.w) return;
    setPhase('starting');
    try {
      const s = await api.games.start('catch');
      session.current = s.sessionId;
      round.current = newRound(s.seed, size.w, size.h);
      setSnap(snapshot(round.current));
      lastScore.current = 0;
      setResult(null);
      setPhase('playing');
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
      setPhase('ready');
    }
  };

  // Built once; the callbacks run on touch (never during render) and steer the live round.
  const pan = useMemo(() => {
    const move = (x: number) => { if (round.current) moveSleigh(round.current, x); };
    // Gesture callbacks run on touch events, not during render (React Compiler cannot see that through the builder).
    // eslint-disable-next-line react-hooks/refs
    return Gesture.Pan().runOnJS(true).minDistance(0).onBegin((e) => move(e.x)).onUpdate((e) => move(e.x));
  }, []);
  const g = snap;
  const remaining = g ? g.remaining : DURATION;
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  if (!signedIn) return <Screen back title={t('games.catch.title')}><SignInGate body={t('games.signInBody')} next="/games/catch" /></Screen>;
  return (
    <Screen back title={t('games.catch.title')} scroll={false}>
      <Row justify="space-between" style={{ marginBottom: space.md }}>
        <Text variant="bodyStrong">{t('games.catch.score')} <Text variant="bodyStrong" tone="accent">{g?.score ?? 0}</Text></Text>
        <Text variant="bodyStrong" accessibilityLiveRegion="polite">{t('games.catch.time')} <Text variant="bodyStrong" tone="accent">{remaining}</Text></Text>
      </Row>
      <GestureDetector gesture={pan}>
        <View style={styles.arena} onLayout={onLayout} accessibilityLabel={t('games.catch.aria')}>
          {size.w > 0 ? (
            <Svg width={size.w} height={size.h}>
              <Path d={`M0 ${size.h - 14} Q${size.w / 2} ${size.h - 26} ${size.w} ${size.h - 14} L${size.w} ${size.h} L0 ${size.h} Z`} fill="rgba(246,248,255,0.9)" />
              {g?.items.map((it) => (
                <G key={it.id} transform={`translate(${it.x} ${it.y}) rotate(${(it.rot * 180) / Math.PI})`}>
                  {it.kind === 'coal' ? <Circle r={it.s / 2} fill="#2a2a2e" /> : (
                    <>
                      <Rect x={-it.s / 2} y={-it.s / 2} width={it.s} height={it.s} rx={3} fill={it.kind === 'gold' ? colors.accent : it.color} stroke={it.kind === 'gold' ? '#fff' : 'none'} />
                      <Rect x={-3} y={-it.s / 2} width={6} height={it.s} fill={it.kind === 'gold' ? '#fff6dc' : colors.accent} />
                      <Rect x={-it.s / 2} y={-3} width={it.s} height={6} fill={it.kind === 'gold' ? '#fff6dc' : colors.accent} />
                    </>
                  )}
                </G>
              ))}
              {g ? (
                <G transform={`translate(${g.sleighX} ${g.sleighY})`}>
                  <Path d={`M${-g.sleighW / 2} -18 L${g.sleighW / 2 - 10} -18 Q${g.sleighW / 2 + 6} -18 ${g.sleighW / 2} 6 L${-g.sleighW / 2 + 6} 6 Z`} fill={colors.primary} />
                  <Path d={`M${-g.sleighW / 2 - 6} 16 L${g.sleighW / 2} 16 Q${g.sleighW / 2 + 14} 16 ${g.sleighW / 2 + 10} 4`} stroke={colors.accent} strokeWidth={4} fill="none" />
                </G>
              ) : null}
              {g?.pops.map((p) => <SvgText key={p.id} x={p.x - 12} y={p.y} fill={p.good ? colors.accent : '#ff6b6b'} opacity={Math.max(0, p.t)} fontSize={18} fontWeight="700">{p.text}</SvgText>)}
            </Svg>
          ) : null}
          {phase !== 'playing' ? (
            <View style={styles.overlay}>
              <Card style={{ gap: space.md, alignItems: 'center', maxWidth: 320 }}>
                {phase === 'done' || phase === 'sending' ? (
                  <>
                    <Text variant="title" align="center">{t('games.catch.points', { n: g?.score ?? 0 })}</Text>
                    {phase === 'sending' ? <Text tone="muted">{t('m.roundSent')}</Text> : null}
                    {result?.flagged ? <Text tone="danger" align="center">{result.message}</Text> : null}
                    {result?.reward ? <Text tone="accent" variant="bodyStrong">+{result.reward.points} {t('common.stardust')}</Text> : null}
                    {result && !result.reward && !result.flagged && result.message ? <Text tone="muted" align="center">{result.message}</Text> : null}
                    <Button label={t('games.catch.again')} onPress={start} disabled={phase === 'sending'} />
                  </>
                ) : (
                  <>
                    <Text tone="muted" align="center">{t('m.dragToMove')}</Text>
                    <Text variant="caption" tone="faint" align="center">{t('games.catch.legend')}</Text>
                    <Button label={t('games.catch.start', { n: DURATION })} loading={phase === 'starting'} onPress={start} />
                  </>
                )}
              </Card>
            </View>
          ) : null}
        </View>
      </GestureDetector>
      <View style={{ height: space.xxl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  arena: { flex: 1, borderRadius: radius.xl, backgroundColor: colors.bgDeep, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,11,29,0.55)', padding: space.lg },
});
