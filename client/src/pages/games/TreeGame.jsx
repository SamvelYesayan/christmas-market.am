// Decorate your own tree: tap an ornament in the tray, then tap the tree to hang it (works with touch and mouse).
import { useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { useApp } from '../../state/AppState.jsx';
import { celebrate } from '../../effects/celebrate.js';
import { GameFrame, SignInGate } from '../Games.jsx';
import { useI18n } from '../../i18n/index.jsx';

const TRAY = [
  { type: 'red', label: 'red', fill: '#c8102e' },
  { type: 'gold', label: 'gold', fill: '#f2c46d' },
  { type: 'blue', label: 'blue', fill: '#a9c7ff' },
  { type: 'green', label: 'green', fill: '#1f9a72' },
  { type: 'star', label: 'starItem', fill: '#fff1c9' },
  { type: 'candy', label: 'candy', fill: '#ffffff' },
];

function inTree(x, y) {
  // Triangle-ish tree area in a 100×100 viewBox
  if (y < 14 || y > 86) return false;
  const half = ((y - 10) / 76) * 40;
  return Math.abs(x - 50) < half;
}

export default function TreeGame() {
  const { rewardCelebration, toast } = useApp();
  const { t } = useI18n();
  const [session, setSession] = useState(null);
  const [selected, setSelected] = useState(TRAY[0]);
  const [ornaments, setOrnaments] = useState([]);
  const [lights, setLights] = useState(false);
  const [star, setStar] = useState(false);
  const [done, setDone] = useState(null);
  const svg = useRef(null);

  const start = async () => {
    try {
      const s = await api.post('/games/tree/start');
      setSession(s.sessionId);
      setOrnaments([]);
      setDone(null);
      setLights(false);
      setStar(false);
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };
  const place = (e) => {
    if (!session || done) return;
    const r = svg.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    if (!inTree(x, y)) return;
    if (ornaments.length >= 40) return toast(t('games.tree.full'), { icon: '🎄' });
    setOrnaments((o) => [...o, { type: selected.type, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }]);
  };
  const finish = async () => {
    try {
      const r = await api.post('/games/tree/finish', { sessionId: session, score: ornaments.length, state: { ornaments } });
      setDone(r);
      celebrate({ intensity: 1 });
      if (r.reward) rewardCelebration(r.reward);
      else if (r.message) toast(r.message, { icon: '🎄' });
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };

  return (
    <GameFrame title={t('games.tree.title')}>
      <SignInGate>
        <div className="tree-game">
          <div className="tree-tray panel pad">
            <p className="label">{t('games.tree.step1')}</p>
            <div className="tray-items">
              {TRAY.map((it) => (
                <button key={it.type} className={`tray-item ${selected.type === it.type ? 'on' : ''}`} onClick={() => setSelected(it)} aria-pressed={selected.type === it.type} aria-label={t(`games.tree.${it.label}`)}>
                  <svg viewBox="0 0 20 20">{it.type === 'star' ? <polygon points="10,1 12.5,7 19,7.4 14,11.6 15.6,18 10,14.4 4.4,18 6,11.6 1,7.4 7.5,7" fill={it.fill} /> : it.type === 'candy' ? <path d="M8 18 V7 a3 3 0 0 1 6 0" stroke="#c8102e" strokeWidth="3" fill="none" strokeDasharray="2 2" /> : <circle cx="10" cy="11" r="7" fill={it.fill} />}</svg>
                </button>
              ))}
            </div>
            <p className="label">{t('games.tree.step2')}</p>
            <p className="label">{t('games.tree.step3')}</p>
            <div className="row">
              <button className={`chip ${lights ? 'on' : ''}`} onClick={() => setLights(!lights)} disabled={!session}>{t('games.tree.lights')}</button>
              <button className={`chip ${star ? 'on' : ''}`} onClick={() => setStar(!star)} disabled={!session}>{t('games.tree.star')}</button>
              <button className="chip" onClick={() => setOrnaments((o) => o.slice(0, -1))} disabled={!ornaments.length}>{t('games.tree.undo')}</button>
            </div>
            <p className="muted">{t('games.tree.hung', { n: ornaments.length })}{ornaments.length < 5 && session ? t('games.tree.minHint') : ''}</p>
            {!session ? <button className="btn btn-block" onClick={start}>{t('games.tree.begin')}</button>
              : done ? <button className="btn btn-block" onClick={start}>{t('games.tree.another')}</button>
                : <button className="btn btn-green btn-block" onClick={finish} disabled={ornaments.length < 1}>{t('games.tree.ready')}</button>}
          </div>
          <div className="tree-canvas">
            <svg ref={svg} viewBox="0 0 100 100" onClick={place} role="img" aria-label={t('games.tree.aria', { n: ornaments.length })} className={session && !done ? 'placing' : ''}>
              <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1f9a72" /><stop offset="1" stopColor="#064030" /></linearGradient></defs>
              <path d="M50 10 L70 34 L63 34 L80 58 L71 58 L90 86 L10 86 L29 58 L20 58 L37 34 L30 34z" fill="url(#tg)" />
              <rect x="45" y="86" width="10" height="9" fill="#5a3524" />
              {lights && Array.from({ length: 22 }, (_, k) => {
                const y = 22 + (k / 22) * 62;
                const half = ((y - 10) / 76) * 38;
                const x = 50 + Math.sin(k * 1.7) * half * 0.9;
                return <circle key={k} cx={x} cy={y} r="1.1" fill={['#ff6b6b', '#f2c46d', '#a9c7ff', '#7fe0c4'][k % 4]} className="art-bulb" style={{ animationDelay: `${(k % 5) * 0.3}s` }} />;
              })}
              {ornaments.map((o, k) => {
                const tr = TRAY.find((x) => x.type === o.type);
                return o.type === 'star' ? <polygon key={k} points={`${o.x},${o.y - 2.4} ${o.x + 0.8},${o.y - 0.7} ${o.x + 2.4},${o.y - 0.6} ${o.x + 1.2},${o.y + 0.5} ${o.x + 1.6},${o.y + 2.2} ${o.x},${o.y + 1.2} ${o.x - 1.6},${o.y + 2.2} ${o.x - 1.2},${o.y + 0.5} ${o.x - 2.4},${o.y - 0.6} ${o.x - 0.8},${o.y - 0.7}`} fill={tr.fill} className="placed" />
                  : o.type === 'candy' ? <path key={k} d={`M${o.x - 0.6} ${o.y + 2.5} V${o.y - 0.5} a1.3 1.3 0 0 1 2.6 0`} stroke="#c8102e" strokeWidth="0.9" fill="none" className="placed" />
                    : <g key={k} className="placed"><circle cx={o.x} cy={o.y} r="2" fill={tr.fill} /><circle cx={o.x - 0.6} cy={o.y - 0.6} r="0.6" fill="#fff" opacity="0.7" /></g>;
              })}
              {star && <polygon points="50,2 52.4,7.4 58,7.8 53.6,11.4 55,17 50,14 45,17 46.4,11.4 42,7.8 47.6,7.4" fill="#f2c46d" className="art-twinkle" />}
            </svg>
          </div>
        </div>
      </SignInGate>
    </GameFrame>
  );
}
