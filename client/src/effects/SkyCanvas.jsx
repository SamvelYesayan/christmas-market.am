// The shared sky: three depth layers of snow, twinkling stars and drifting embers on ONE canvas and
// ONE animation loop. Budget scales with screen area and device quality; pauses when hidden;
// calm mode renders a single still frame. The pointer creates a gentle wind; scrolling adds drift.
import { useEffect, useRef } from 'react';
import { useApp } from '../state/AppState.jsx';
import { ATMOSPHERES, deviceQuality } from '../lib.js';

export default function SkyCanvas() {
  const ref = useRef(null);
  const { calm, persona } = useApp();
  const atmosphere = ATMOSPHERES[persona?.atmosphere] ?? ATMOSPHERES.enchanted;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    let flakes = [];
    let stars = [];
    let embers = [];
    let raf = 0;
    let running = true;
    const wind = { x: 0, target: 0 };
    const pointer = { x: -9999, y: -9999 };
    let lastScroll = window.scrollY;

    const seed = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const q = deviceQuality();
      const area = (w * h) / (1440 * 900);
      const nFlakes = Math.round(Math.min(260, 170 * area * q + 40));
      flakes = Array.from({ length: nFlakes }, () => {
        const layer = Math.random() < 0.55 ? 0 : Math.random() < 0.7 ? 1 : 2; // far, mid, near
        return {
          x: Math.random() * w, y: Math.random() * h, layer,
          r: [0.8, 1.6, 2.8][layer] + Math.random() * [0.6, 1, 1.8][layer],
          vy: [0.25, 0.55, 1.1][layer] + Math.random() * 0.4,
          sway: Math.random() * Math.PI * 2, swaySpeed: 0.004 + Math.random() * 0.01,
          a: [0.45, 0.7, 0.9][layer],
        };
      });
      stars = Array.from({ length: Math.round(90 * area * q + 20) }, () => ({
        x: Math.random() * w, y: Math.random() * h * 0.55, r: Math.random() * 1.3 + 0.2,
        t: Math.random() * Math.PI * 2, s: 0.005 + Math.random() * 0.02,
      }));
      embers = Array.from({ length: Math.round(14 * q) }, () => ({
        x: Math.random() * w, y: h + Math.random() * h, r: 1 + Math.random() * 1.8,
        vy: 0.2 + Math.random() * 0.35, t: Math.random() * 6,
      }));
    };

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      wind.x += (wind.target - wind.x) * 0.02;
      wind.target *= 0.96;
      // stars
      for (const s of stars) {
        s.t += s.s;
        ctx.globalAlpha = 0.25 + Math.abs(Math.sin(s.t)) * 0.75;
        ctx.fillStyle = '#fff8e6';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.r > 1.25) {
          ctx.globalAlpha *= 0.4;
          ctx.fillRect(s.x - s.r * 3, s.y - 0.3, s.r * 6, 0.6);
          ctx.fillRect(s.x - 0.3, s.y - s.r * 3, 0.6, s.r * 6);
        }
      }
      // embers / magical particles
      ctx.fillStyle = atmosphere.particles;
      for (const e of embers) {
        e.y -= e.vy;
        e.t += 0.02;
        e.x += Math.sin(e.t) * 0.3;
        if (e.y < -10) { e.y = h + 10; e.x = Math.random() * w; }
        ctx.globalAlpha = 0.35 + Math.sin(e.t * 2) * 0.25;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // snow
      ctx.fillStyle = '#ffffff';
      for (const f of flakes) {
        f.sway += f.swaySpeed;
        const dx = f.x - pointer.x;
        const dy = f.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (f.layer > 0 && d2 < 9000) {
          const push = (1 - d2 / 9000) * 1.6;
          f.x += (dx / Math.sqrt(d2 + 1)) * push;
          f.y += (dy / Math.sqrt(d2 + 1)) * push * 0.5;
        }
        f.y += f.vy;
        f.x += Math.sin(f.sway) * 0.35 * (f.layer + 1) + wind.x * (f.layer + 1) * 0.6;
        if (f.y > h + 5) { f.y = -5; f.x = Math.random() * w; }
        if (f.x > w + 5) f.x = -5;
        if (f.x < -5) f.x = w + 5;
        ctx.globalAlpha = f.a;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      if (!running) return;
      frame();
      raf = requestAnimationFrame(loop);
    };

    const onResize = () => { seed(); if (calm) frame(); };
    const onMove = (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    const onLeave = () => { pointer.x = -9999; };
    const onScroll = () => {
      const dy = window.scrollY - lastScroll;
      lastScroll = window.scrollY;
      wind.target = Math.max(-2, Math.min(2, wind.target + dy * 0.01));
    };
    const onVis = () => {
      running = !document.hidden && !calm;
      cancelAnimationFrame(raf);
      if (running) loop();
    };

    seed();
    if (calm) frame();
    else loop();
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [calm, atmosphere.particles]);

  return <canvas ref={ref} className="sky-canvas" aria-hidden="true" />;
}
