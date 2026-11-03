// Sparkle trail that follows fine pointers (mouse/trackpad). Disabled on touch and in calm mode.
import { useEffect, useRef } from 'react';
import { useApp } from '../state/AppState.jsx';
import { useMediaQuery } from '../lib.js';

export default function CursorMagic() {
  const ref = useRef(null);
  const { calm } = useApp();
  const fine = useMediaQuery('(pointer: fine)');

  useEffect(() => {
    if (calm || !fine) return undefined;
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let sparks = [];
    let raf = 0;
    let idle = true;
    const size = () => {
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const tick = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const s of sparks) {
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.03;
        s.life -= 0.022;
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.fillStyle = s.c;
        ctx.beginPath();
        const r = s.r * s.life;
        ctx.moveTo(s.x, s.y - r * 2);
        ctx.quadraticCurveTo(s.x, s.y, s.x + r * 2, s.y);
        ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + r * 2);
        ctx.quadraticCurveTo(s.x, s.y, s.x - r * 2, s.y);
        ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - r * 2);
        ctx.fill();
      }
      sparks = sparks.filter((s) => s.life > 0);
      if (sparks.length) raf = requestAnimationFrame(tick);
      else idle = true;
    };
    let last = 0;
    const onMove = (e) => {
      const now = performance.now();
      if (now - last < 22) return;
      last = now;
      if (sparks.length > 80) return;
      const colors = ['#f2c46d', '#fff3cf', '#a9c7ff'];
      sparks.push({ x: e.clientX, y: e.clientY, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8, r: 1.5 + Math.random() * 2.2, life: 1, c: colors[Math.floor(Math.random() * 3)] });
      if (idle) {
        idle = false;
        raf = requestAnimationFrame(tick);
      }
    };
    size();
    window.addEventListener('resize', size);
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      window.removeEventListener('pointermove', onMove);
    };
  }, [calm, fine]);

  if (calm || !fine) return null;
  return <canvas ref={ref} className="cursor-canvas" aria-hidden="true" />;
}
