// Cinematic opening: Scene 1 winter night → Scene 2 Santa's sleigh crosses the sky → Scene 3 snow burst
// and golden reveal of the site. Original SVG artwork, animated with one rAF timeline.
// Variants: 'full' (first visit, ~8s) and 'short' (returning visitors, ~4s). Skippable at any moment.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { audio } from './audio.js';
import { Mountains, Village } from '../art/Scenes.jsx';

// Real, human-recorded Santa laugh (CC0, BigSoundBank #2075 by Joseph Sardin) — see public/audio/CREDITS.md
const SANTA_LAUGH = '/audio/santa-ho-ho-ho.wav';

const DUR = { full: { night: 1.6, fly: 4.8, reveal: 1.5 }, short: { night: 0.5, fly: 2.8, reveal: 1.0 } };

function Reindeer({ x, y = 0, back = false, lead = false, phase = 0 }) {
  const coat = back ? '#6e4a33' : '#8a5a3c';
  const belly = back ? '#9c7556' : '#c49a74';
  return (
    <g transform={`translate(${x} ${y})`} className="rd" style={{ '--ph': `${phase}s` }}>
      <g className="rd-body">
        {/* back legs */}
        <g className="leg leg-b1" style={{ transformOrigin: '18px 34px' }}><path d="M16 32 l-6 22 l-6 10" stroke={coat} strokeWidth="5" fill="none" strokeLinecap="round" /><path d="M4 64 h5" stroke="#2b1810" strokeWidth="4" strokeLinecap="round" /></g>
        <g className="leg leg-b2" style={{ transformOrigin: '22px 34px' }}><path d="M22 32 l-2 24 l-8 8" stroke={coat} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.8" /></g>
        {/* front legs */}
        <g className="leg leg-f1" style={{ transformOrigin: '56px 34px' }}><path d="M56 32 l8 18 l10 6" stroke={coat} strokeWidth="5" fill="none" strokeLinecap="round" /><path d="M72 56 h5" stroke="#2b1810" strokeWidth="4" strokeLinecap="round" /></g>
        <g className="leg leg-f2" style={{ transformOrigin: '52px 34px' }}><path d="M52 32 l4 20 l10 8" stroke={coat} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.8" /></g>
        {/* torso, neck, head */}
        <ellipse cx="36" cy="28" rx="28" ry="13" fill={coat} />
        <ellipse cx="38" cy="33" rx="20" ry="6" fill={belly} opacity="0.7" />
        <path d="M10 22 q-8 -4 -10 4 q6 0 10 -1z" fill={belly} />
        <path d="M56 22 q8 -14 14 -22 l8 4 q-6 10 -12 22z" fill={coat} />
        <ellipse cx="78" cy="-2" rx="11" ry="7" fill={coat} transform="rotate(18 78 -2)" />
        <circle cx="88" cy="2" r="3" fill={lead ? '#f2c46d' : '#2b1810'} />
        {lead && <circle cx="88" cy="2" r="9" fill="#f2c46d" opacity="0.35" className="rd-glow" />}
        <circle cx="78" cy="-5" r="1.6" fill="#120a06" />
        <path d="M70 -8 l-4 -6 l6 2z" fill={belly} />
        {/* antlers */}
        <g stroke="#d8c3a0" strokeWidth="2.4" fill="none" strokeLinecap="round">
          <path d="M74 -10 q-4 -14 -14 -18 M68 -21 l-6 -2 M70 -15 l-8 0" />
          <path d="M80 -10 q2 -14 12 -20 M88 -24 l6 -2 M84 -18 l8 -2" />
        </g>
        {/* harness with bells */}
        <path d="M24 18 q12 12 30 2" stroke="#c8102e" strokeWidth="4" fill="none" />
        {[30, 40, 50].map((bx) => <circle key={bx} cx={bx} cy={22 + (bx === 40 ? 3 : 1)} r="2.4" fill="#f2c46d" />)}
      </g>
    </g>
  );
}

function Sleigh() {
  return (
    <g className="sleigh-body">
      {/* reins from Santa to the reindeer */}
      <path d="M128 52 Q200 40 262 60 T420 52" stroke="#f2c46d" strokeWidth="1.6" fill="none" opacity="0.9" />
      <path d="M128 56 Q210 62 270 70 T430 64" stroke="#f2c46d" strokeWidth="1.2" fill="none" opacity="0.6" />
      {/* gift sack */}
      <path d="M18 34 q-6 -30 22 -34 q26 2 22 34z" fill="#3b6b4b" />
      <path d="M30 4 q10 -6 18 0" stroke="#f2c46d" strokeWidth="3" fill="none" />
      <rect x="22" y="12" width="14" height="12" rx="2" fill="#c8102e" /><rect x="27" y="12" width="4" height="12" fill="#f2c46d" />
      <rect x="40" y="8" width="12" height="10" rx="2" fill="#2a4fa8" /><rect x="44" y="8" width="3" height="10" fill="#f6f8ff" />
      {/* Santa */}
      <g className="santa">
        <path d="M66 30 q4 -26 26 -24 q20 4 18 30z" fill="#c8102e" />
        <rect x="68" y="26" width="40" height="6" fill="#2b1810" /><rect x="84" y="25" width="8" height="8" rx="1" fill="#f2c46d" />
        <circle cx="90" cy="-6" r="12" fill="#f3c9a8" />
        <path d="M78 -2 q12 26 26 0 q-4 16 -13 16 q-10 0 -13 -16z" fill="#f6f8ff" />
        <path d="M82 -4 q8 4 16 0" stroke="#f6f8ff" strokeWidth="4" strokeLinecap="round" />
        <circle cx="86" cy="-9" r="1.3" fill="#2b1810" /><circle cx="95" cy="-9" r="1.3" fill="#2b1810" />
        <circle cx="91" cy="-5" r="2.2" fill="#e88f7a" />
        <path d="M78 -12 q10 -26 30 -14 q6 4 10 14 q-20 -10 -40 0z" fill="#c8102e" />
        <rect x="76" y="-15" width="32" height="6" rx="3" fill="#f6f8ff" />
        <circle cx="120" cy="0" r="4.5" fill="#f6f8ff" />
        {/* waving arm */}
        <g className="santa-arm" style={{ transformOrigin: '104px 8px' }}>
          <path d="M104 8 q12 -10 18 -24" stroke="#c8102e" strokeWidth="8" strokeLinecap="round" fill="none" />
          <circle cx="123" cy="-18" r="5" fill="#f6f8ff" />
        </g>
      </g>
      {/* sleigh body */}
      <path d="M8 34 h120 q14 0 18 -16 q2 22 -10 34 q-10 10 -30 10 h-82 q-18 0 -20 -14z" fill="#a50d26" />
      <path d="M8 34 h120 q14 0 18 -16" stroke="#f2c46d" strokeWidth="3" fill="none" />
      <path d="M20 46 q30 8 60 0 q30 -8 50 2" stroke="#f2c46d" strokeWidth="1.6" fill="none" opacity="0.8" />
      <path d="M2 74 h132 q20 0 22 -18" stroke="#f2c46d" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M30 62 v12 M110 62 v12" stroke="#f2c46d" strokeWidth="3" />
    </g>
  );
}

export default function SantaIntro({ variant = 'full', onDone }) {
  const { t } = useI18n();
  const root = useRef(null);
  const canvas = useRef(null);
  const team = useRef(null);
  const [scene, setScene] = useState(1);
  const [sound, setSound] = useState(false);
  const [hoho, setHoho] = useState(false);
  const doneRef = useRef(false);
  const soundRef = useRef(false);
  const sceneRef = useRef(1);
  const laughRef = useRef(null); // decoded recording, loaded only once sound is switched on
  const laughSrc = useRef(null);
  const santaRef = useRef(null); // Santa's <g> inside the flying team, used to time the laugh to his position
  const laughDue = useRef(false); // the sleigh has reached the laugh moment
  const laughPlayed = useRef(false);

  // Plays the recording once — at the laugh moment, or immediately if sound was switched on a bit late
  // while Santa is still crossing (skipped once he is leaving the screen).
  const tryLaugh = () => {
    if (laughPlayed.current || doneRef.current || !soundRef.current || !laughRef.current || !laughDue.current) return;
    const box = santaRef.current?.getBoundingClientRect();
    if (!box || box.left + box.width / 2 > window.innerWidth * 0.55) return; // too late: he is already leaving
    laughPlayed.current = true;
    laughSrc.current = audio.playSample(laughRef.current, { gain: 0.95 });
  };

  const stopLaugh = () => {
    try { laughSrc.current?.stop(); } catch { /* already finished */ }
    laughSrc.current = null;
  };

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    stopLaugh();
    root.current?.classList.add('leaving');
    setTimeout(onDone, 650);
  }, [onDone]);

  const enableSound = async () => {
    soundRef.current = true;
    setSound(true);
    audio.loadSample(SANTA_LAUGH).then((b) => { laughRef.current = b; tryLaugh(); });
    await audio.sleighBells(3.5);
  };

  useEffect(() => {
    const d = DUR[variant] ?? DUR.full;
    const total = d.night + d.fly + d.reveal;
    const cv = canvas.current;
    const ctx = cv.getContext('2d');
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    let W = 0;
    let H = 0;
    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const small = W < 700;
    const flakes = Array.from({ length: small ? 70 : 140 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2.2 + 0.6, v: Math.random() * 0.8 + 0.4, s: Math.random() * 6 }));
    const sparks = [];
    let raf = 0;
    const t0 = performance.now();
    let said = false;
    // bezier path across the sky (normalised)
    const P = [[-0.35, 0.78], [0.25, 0.32], [0.7, 0.62], [1.35, 0.12]];
    const bez = (u, i) => (1 - u) ** 3 * P[0][i] + 3 * (1 - u) ** 2 * u * P[1][i] + 3 * (1 - u) * u ** 2 * P[2][i] + u ** 3 * P[3][i];
    const ease = (u) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2) * 0.35 + u * 0.65; // gentle accelerate/decelerate

    const frame = (now) => {
      const el = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      const burst = el > d.night + d.fly ? Math.min(1, (el - d.night - d.fly) / 0.6) : 0;
      // snow (intensifies in scene 3)
      for (const f of flakes) {
        f.y += f.v * (1 + burst * 2.5);
        f.s += 0.02;
        f.x += Math.sin(f.s) * 0.4;
        if (f.y > H + 4) { f.y = -4; f.x = Math.random() * W; }
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (1 + burst * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
      // sleigh position
      const flyU = (el - d.night) / d.fly;
      if (flyU >= 0 && flyU <= 1 && team.current) {
        if (sceneRef.current !== 2) { sceneRef.current = 2; setScene(2); }
        const u = ease(flyU);
        const x = bez(u, 0) * W;
        const y = bez(u, 1) * H;
        const dx = bez(Math.min(1, u + 0.01), 0) * W - x;
        const dy = bez(Math.min(1, u + 0.01), 1) * H - y;
        const ang = Math.atan2(dy, dx) * (180 / Math.PI) * 0.55;
        const scale = Math.max(0.55, Math.min(1.45, W / 900));
        team.current.setAttribute('transform', `translate(${x} ${y}) rotate(${ang}) scale(${scale}) translate(-240 -40)`);
        // glowing trail from the runners
        const rx = x - 220 * scale * Math.cos((ang * Math.PI) / 180);
        const ry = y + 20 * scale;
        for (let k = 0; k < (small ? 2 : 4); k++) {
          sparks.push({ x: rx + (Math.random() - 0.5) * 20, y: ry + (Math.random() - 0.5) * 12, vx: -1 - Math.random() * 2, vy: Math.random() * 0.8 - 0.2, life: 1, r: 1 + Math.random() * 2.5, c: Math.random() < 0.6 ? '#f2c46d' : '#fff6dc' });
        }
        // The laugh starts the moment Santa himself enters the screen. The path scales with the viewport,
        // so this is measured from his on-screen position, not a fixed point in the flight; flyU 0.5 is a fallback.
        if (!said) {
          santaRef.current ??= team.current.querySelector('.santa');
          const box = santaRef.current?.getBoundingClientRect();
          if (box ? box.left + box.width / 2 >= 0 : false) said = 'now';
          else if (flyU > 0.5) said = 'now';
        }
        if (said === 'now') {
          said = true;
          setHoho(true);
          setTimeout(() => setHoho(false), 2600);
          laughDue.current = true;
          tryLaugh();
        }
      }
      for (let k = sparks.length - 1; k >= 0; k--) {
        const s = sparks[k];
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.012;
        if (s.life <= 0) { sparks.splice(k, 1); continue; }
        ctx.globalAlpha = s.life;
        ctx.fillStyle = s.c;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * s.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (el > d.night + d.fly && sceneRef.current !== 3) { sceneRef.current = 3; setScene(3); }
      if (el >= total) return finish();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onKey = (e) => e.key === 'Escape' && finish();
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      stopLaugh();
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, finish]);

  return (
    <div ref={root} className={`santa-intro scene-${scene}`} role="dialog" aria-label={t('intro.aria')}>
      <div className="si-sky" />
      <div className="si-aurora" aria-hidden="true" />
      <div className="si-moon" aria-hidden="true" />
      <div className="si-land" aria-hidden="true"><Mountains /><Village /></div>
      <canvas ref={canvas} className="si-canvas" aria-hidden="true" />
      <svg className="si-team" aria-hidden="true">
        <g ref={team} transform="translate(-2000 -2000)">
          <Sleigh />
          <Reindeer x={170} y={18} back phase={0.1} />
          <Reindeer x={190} y={30} phase={0} />
          <Reindeer x={290} y={10} back phase={0.25} />
          <Reindeer x={310} y={22} lead phase={0.15} />
        </g>
      </svg>
      <div className={`si-hoho ${hoho ? 'on' : ''}`} aria-live="polite">{hoho ? t('intro.hoho') : ''}</div>
      <div className="si-title">
        <span className="eyebrow">{t('intro.welcome')}</span>
        <p>{t('intro.tagline')}</p>
      </div>
      <div className="si-glow" aria-hidden="true" />
      <div className="si-controls">
        {!sound && <button className="chip" onClick={enableSound}>🔔 {t('intro.sound')}</button>}
        {sound && <span className="chip on">🔔 {t('intro.soundOn')}</span>}
        <button className="btn btn-sm btn-ghost" onClick={finish} autoFocus>{t('intro.skip')} ›</button>
      </div>
    </div>
  );
}
