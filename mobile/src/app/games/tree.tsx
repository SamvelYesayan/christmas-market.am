// Decorate Your Tree — tap to hang ornaments. The server checks timing and count and grants the daily reward.
import { useState } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { haptic } from '@/lib/haptics';
import { colors, radius, space } from '@/theme/tokens';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Row } from '@/components/ui/Surface';
import { Chip } from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';
import { SignInGate } from '@/components/Common';
import { burst, celebrate } from '@/components/Celebration';
import { starPoints } from '@/components/ui/Icon';
import { inTree } from '@/features/games/geometry';
import type { FinishResult } from '@/api/types';

const TRAY = [
  { type: 'red', label: 'red', fill: '#c8102e' },
  { type: 'gold', label: 'gold', fill: '#f2c46d' },
  { type: 'blue', label: 'blue', fill: '#a9c7ff' },
  { type: 'green', label: 'green', fill: '#1f9a72' },
  { type: 'star', label: 'starItem', fill: '#fff1c9' },
  { type: 'candy', label: 'candy', fill: '#ffffff' },
] as const;
type Orn = { type: (typeof TRAY)[number]['type']; x: number; y: number };

export default function TreeGame() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const [session, setSession] = useState<string | null>(null);
  const [selected, setSelected] = useState<(typeof TRAY)[number]>(TRAY[0]);
  const [ornaments, setOrnaments] = useState<Orn[]>([]);
  const [lights, setLights] = useState(false);
  const [star, setStar] = useState(false);
  const [done, setDone] = useState<FinishResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [box, setBox] = useState(1);

  const start = async () => {
    setBusy(true);
    try {
      const s = await api.games.start('tree');
      setSession(s.sessionId);
      setOrnaments([]); setDone(null); setLights(false); setStar(false);
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally { setBusy(false); }
  };
  const place = (e: GestureResponderEvent) => {
    if (!session || done) return;
    const x = (e.nativeEvent.locationX / box) * 100;
    const y = (e.nativeEvent.locationY / box) * 100;
    if (!inTree(x, y)) return;
    if (ornaments.length >= 40) { toast(t('games.tree.full')); return; }
    haptic.tap();
    setOrnaments((o) => [...o, { type: selected.type, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }]);
  };
  const finish = async () => {
    setBusy(true);
    try {
      const r = await api.games.finish('tree', { sessionId: session!, score: ornaments.length, state: { ornaments } });
      setDone(r);
      burst();
      if (r.reward) celebrate(r.reward); else if (r.message) toast(r.message);
      void qc.invalidateQueries({ queryKey: ['games'] });
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally { setBusy(false); }
  };

  if (!signedIn) return <Screen back title={t('games.tree.title')}><SignInGate body={t('games.signInBody')} next="/games/tree" /></Screen>;
  return (
    <Screen back title={t('games.tree.title')}>
      <View onLayout={(e) => setBox(e.nativeEvent.layout.width)} style={{ aspectRatio: 1, borderRadius: radius.xl, backgroundColor: colors.bgDeep, overflow: 'hidden' }}>
        <Pressable onPress={place} style={{ flex: 1 }} accessibilityLabel={t('games.tree.aria', { n: ornaments.length })} accessibilityHint={t('games.tree.step2')}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100" pointerEvents="none">
            <Defs><LinearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#1f9a72" /><Stop offset="1" stopColor="#064030" /></LinearGradient></Defs>
            <Path d="M50 10 L70 34 L63 34 L80 58 L71 58 L90 86 L10 86 L29 58 L20 58 L37 34 L30 34z" fill="url(#tg)" />
            <Rect x={45} y={86} width={10} height={9} fill="#5a3524" />
            {lights ? Array.from({ length: 22 }, (_, k) => {
              const y = 22 + (k / 22) * 62;
              const half = ((y - 10) / 76) * 38;
              const x = 50 + Math.sin(k * 1.7) * half * 0.9;
              return <Circle key={k} cx={x} cy={y} r={1.1} fill={['#ff6b6b', '#f2c46d', '#a9c7ff', '#7fe0c4'][k % 4]} />;
            }) : null}
            {ornaments.map((o, k) => {
              const fill = TRAY.find((x) => x.type === o.type)!.fill;
              if (o.type === 'star') return <Polygon key={k} points={starPoints(o.x, o.y, 2.4)} fill={fill} />;
              if (o.type === 'candy') return <Path key={k} d={`M${o.x - 0.6} ${o.y + 2.5} V${o.y - 0.5} a1.3 1.3 0 0 1 2.6 0`} stroke="#c8102e" strokeWidth={0.9} fill="none" />;
              return <G key={k}><Circle cx={o.x} cy={o.y} r={2} fill={fill} /><Circle cx={o.x - 0.6} cy={o.y - 0.6} r={0.6} fill="#fff" opacity={0.7} /></G>;
            })}
            {star ? <Polygon points={starPoints(50, 9.5, 7.5)} fill="#f2c46d" /> : null}
          </Svg>
        </Pressable>
      </View>
      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">{t('games.tree.step1')}</Text>
        <Row wrap gap={space.sm}>
          {TRAY.map((it) => (
            <Pressable key={it.type} accessibilityRole="button" accessibilityState={{ selected: selected.type === it.type }} accessibilityLabel={t(`games.tree.${it.label}`)} onPress={() => { haptic.tap(); setSelected(it); }}
              style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: selected.type === it.type ? colors.accent : colors.border, backgroundColor: colors.surface }}>
              <Svg width={26} height={26} viewBox="0 0 20 20">
                {it.type === 'star' ? <Polygon points={starPoints(10, 10.5, 9)} fill={it.fill} /> : it.type === 'candy' ? <Path d="M8 18 V7 a3 3 0 0 1 6 0" stroke="#c8102e" strokeWidth={3} fill="none" strokeDasharray="2 2" /> : <Circle cx={10} cy={11} r={7} fill={it.fill} />}
              </Svg>
            </Pressable>
          ))}
        </Row>
        <Text variant="label" tone="muted">{t('games.tree.step2')}</Text>
        <Text variant="label" tone="muted">{t('games.tree.step3')}</Text>
        <Row wrap gap={space.sm}>
          <Chip label={t('games.tree.lights')} selected={lights} disabled={!session} onPress={() => setLights(!lights)} />
          <Chip label={t('games.tree.star')} selected={star} disabled={!session} onPress={() => setStar(!star)} />
          <Chip label={t('games.tree.undo')} disabled={!ornaments.length || !!done} onPress={() => setOrnaments((o) => o.slice(0, -1))} />
        </Row>
        <Text tone="muted">{t('games.tree.hung', { n: ornaments.length })}{ornaments.length < 5 && session ? t('games.tree.minHint') : ''}</Text>
      </View>
      {!session ? <Button label={t('games.tree.begin')} loading={busy} onPress={start} />
        : done ? <Button label={t('games.tree.another')} loading={busy} onPress={start} />
          : <Button label={t('games.tree.ready')} variant="ember" loading={busy} disabled={ornaments.length < 1} onPress={finish} />}
    </Screen>
  );
}
