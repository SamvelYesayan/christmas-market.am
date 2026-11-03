// Catch the Falling Gifts — canvas arcade game. The server issues the seed and validates the score.
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { useApp } from '../../state/AppState.jsx';
import { GameFrame, SignInGate } from '../Games.jsx';
import { useI18n } from '../../i18n/index.jsx';

const DURATION = 45;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export default function CatchGame() {
  const { rewardCelebration, toast } = useApp();
  const { t } = useI18n();
  const canvas = useRef(null);
  const [phase, setPhase] = useState('ready'); // ready | playing | done
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(DURATION);
  const [result, setResult] = useState(null);
  const game = useRef(null);

  const start = async () => {
    try {
      const s = await api.post('/games/catch/start');
      game.current = { session: s.sessionId, rand: rng(s.seed), score: 0, catches: 0 };
      setScore(0);
      setTime(DURATION);
      setResult(null);
      setPhase('playing');
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };

  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const c = canvas.current;
    const ctx = c.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth;
    const H = c.clientHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = game.current;
    const sleigh = { x: W / 2, w: Math.max(70, W * 0.12), y: H - 46 };
    const items = [];
    const keys = {};
    let spawn = 0;
    let last = performance.now();
    const t0 = last;
    let raf = 0;
    let ended = false;
    const pops = [];

    const onMove = (e) => {
      const r = c.getBoundingClientRect();
      sleigh.x = Math.max(sleigh.w / 2, Math.min(W - sleigh.w / 2, (e.touches?.[0]?.clientX ?? e.clientX) - r.left));
    };
    const onKey = (e) => { keys[e.key] = e.type === 'keydown'; };
    c.addEventListener('pointermove', onMove);
    c.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    const drawGift = (it) => {
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rot);
      if (it.kind === 'coal') {
        ctx.fillStyle = '#2a2a2e';
        ctx.beginPath();
        ctx.arc(0, 0, it.s / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#55555c';
        ctx.fillRect(-4, -6, 5, 4);
      } else {
        ctx.fillStyle = it.kind === 'gold' ? '#f2c46d' : it.color;
        ctx.fillRect(-it.s / 2, -it.s / 2, it.s, it.s);
        ctx.fillStyle = it.kind === 'gold' ? '#fff6dc' : '#f2c46d';
        ctx.fillRect(-3, -it.s / 2, 6, it.s);
        ctx.fillRect(-it.s / 2, -3, it.s, 6);
        if (it.kind === 'gold') { ctx.shadowColor = '#f2c46d'; ctx.shadowBlur = 20; ctx.strokeStyle = '#fff'; ctx.strokeRect(-it.s / 2, -it.s / 2, it.s, it.s); }
      }
      ctx.restore();
    };

    const finish = async () => {
      ended = true;
      setPhase('done');
      try {
        const r = await api.post('/games/catch/finish', { sessionId: g.session, score: g.score, state: { catches: g.catches } });
        setResult(r);
        if (r.reward || r.achievement) rewardCelebration(r.reward, r.achievement);
      } catch (e) {
        toast(e.message, { tone: 'error' });
      }
    };

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const elapsed = (now - t0) / 1000;
      const remaining = Math.max(0, DURATION - elapsed);
      setTime(Math.ceil(remaining));
      if (keys.ArrowLeft) sleigh.x = Math.max(sleigh.w / 2, sleigh.x - 520 * dt);
      if (keys.ArrowRight) sleigh.x = Math.min(W - sleigh.w / 2, sleigh.x + 520 * dt);
      const difficulty = 1 + elapsed / 30;
      spawn -= dt;
      if (spawn <= 0) {
        const r = g.rand();
        items.push({ x: 20 + g.rand() * (W - 40), y: -20, vy: (110 + g.rand() * 90) * difficulty, rot: 0, vr: (g.rand() - 0.5) * 3, s: 22 + g.rand() * 10,
          kind: r < 0.08 ? 'gold' : r < 0.25 ? 'coal' : 'gift', color: ['#c8102e', '#0f6b4f', '#2a4fa8', '#7a2a1e'][Math.floor(g.rand() * 4)] });
        spawn = 0.55 / difficulty;
      }
      ctx.clearRect(0, 0, W, H);
      // ground
      ctx.fillStyle = 'rgba(246,248,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(0, H - 14);
      ctx.quadraticCurveTo(W / 2, H - 26, W, H - 14);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.fill();
      for (let k = items.length - 1; k >= 0; k--) {
        const it = items[k];
        it.y += it.vy * dt;
        it.rot += it.vr * dt;
        const hit = it.y > sleigh.y - 20 && it.y < sleigh.y + 10 && Math.abs(it.x - sleigh.x) < sleigh.w / 2 + it.s / 3;
        if (hit) {
          const pts = it.kind === 'gold' ? 30 : it.kind === 'coal' ? -20 : 10;
          g.score = Math.max(0, g.score + pts);
          if (pts > 0) g.catches += 1;
          setScore(g.score);
          pops.push({ x: it.x, y: it.y, t: 1, text: pts > 0 ? `+${pts}` : `${pts}`, color: pts > 0 ? '#f2c46d' : '#ff6b6b' });
          items.splice(k, 1);
          continue;
        }
        if (it.y > H + 30) { items.splice(k, 1); continue; }
        drawGift(it);
      }
      // sleigh
      ctx.save();
      ctx.translate(sleigh.x, sleigh.y);
      ctx.fillStyle = '#c8102e';
      ctx.beginPath();
      ctx.moveTo(-sleigh.w / 2, -18);
      ctx.lineTo(sleigh.w / 2 - 10, -18);
      ctx.quadraticCurveTo(sleigh.w / 2 + 6, -18, sleigh.w / 2, 6);
      ctx.lineTo(-sleigh.w / 2 + 6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#f2c46d';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-sleigh.w / 2 - 6, 16);
      ctx.lineTo(sleigh.w / 2, 16);
      ctx.quadraticCurveTo(sleigh.w / 2 + 14, 16, sleigh.w / 2 + 10, 4);
      ctx.stroke();
      ctx.restore();
      for (let k = pops.length - 1; k >= 0; k--) {
        const p = pops[k];
        p.t -= dt * 1.5;
        p.y -= 40 * dt;
        ctx.globalAlpha = Math.max(0, p.t);
        ctx.fillStyle = p.color;
        ctx.font = '700 18px Instrument Sans';
        ctx.fillText(p.text, p.x - 12, p.y);
        ctx.globalAlpha = 1;
        if (p.t <= 0) pops.splice(k, 1);
      }
      if (remaining <= 0 && !ended) return finish();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      c.removeEventListener('pointermove', onMove);
      c.removeEventListener('touchmove', onMove);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, [phase, rewardCelebration, toast]);

  return (
    <GameFrame title={t('games.catch.title')}>
      <SignInGate>
        <div className="arcade">
          <div className="arcade-hud"><span>{t('games.catch.score')} <b>{score}</b></span><span>{t('games.catch.time')} <b>{time}</b></span></div>
          <canvas ref={canvas} className="arcade-canvas" aria-label={t('games.catch.aria')} />
          {phase !== 'playing' && (
            <div className="arcade-overlay">
              {phase === 'ready' ? (
                <>
                  <p>{t('games.catch.howto')}<br />{t('games.catch.legend')}</p>
                  <button className="btn" onClick={start}>{t('games.catch.start', { n: DURATION })}</button>
                </>
              ) : (
                <>
                  <h2>{t('games.catch.points', { n: score })}</h2>
                  {result?.flagged && <p className="form-error">{result.message}</p>}
                  {result?.reward && <p className="stardust">+{result.reward.points} {t('common.stardust')} ✨</p>}
                  {result && !result.reward && !result.flagged && <p className="muted">{result.message}</p>}
                  <button className="btn" onClick={start}>{t('games.catch.again')}</button>
                </>
              )}
            </div>
          )}
        </div>
      </SignInGate>
    </GameFrame>
  );
}
