// One shared reward burst: stars, snowflakes and ribbon curls on a temporary full-screen canvas.
// Respects calm mode (renders nothing; the toast still announces the reward).
const PALETTES = {
  festive: ['#f2c46d', '#c8102e', '#f6f8ff', '#0f6b4f', '#ffdf9e'],
  gold: ['#f2c46d', '#ffe7a8', '#fff6dc', '#d4a537'],
  frost: ['#a9c7ff', '#f6f8ff', '#cfe0ff', '#7fe0c4'],
};

let active = null;

export function celebrate({ intensity = 1, palette = 'festive', origin } = {}) {
  if (typeof window === 'undefined' || document.documentElement.classList.contains('calm')) return;
  const colors = PALETTES[palette] ?? PALETTES.festive;
  const canvas = active?.canvas ?? Object.assign(document.createElement('canvas'), { className: 'celebrate-canvas' });
  if (!active) document.body.appendChild(canvas);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const ox = origin?.x ?? innerWidth / 2;
  const oy = origin?.y ?? innerHeight * 0.45;
  const count = Math.round((innerWidth < 700 ? 70 : 130) * intensity);
  const parts = (active?.parts ?? []).concat(Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2;
    const v = 4 + Math.random() * 9;
    return {
      x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5,
      r: 3 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
      shape: ['star', 'flake', 'ribbon', 'dot'][Math.floor(Math.random() * 4)],
      color: colors[Math.floor(Math.random() * colors.length)], life: 1,
    };
  }));

  const draw = (p) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;
    if (p.shape === 'star') {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? p.r * 0.45 : p.r;
        ctx.lineTo(Math.cos((i * Math.PI) / 5) * rr, Math.sin((i * Math.PI) / 5) * rr);
      }
      ctx.fill();
    } else if (p.shape === 'flake') {
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(-p.r, 0);
        ctx.lineTo(p.r, 0);
        ctx.stroke();
      }
    } else if (p.shape === 'ribbon') {
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-p.r, 0);
      ctx.quadraticCurveTo(0, -p.r, p.r, 0);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const state = { canvas, parts };
  if (active) {
    active.parts = parts;
    return;
  }
  active = state;
  const tick = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of state.parts) {
      p.vy += 0.22;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 0.0075;
      draw(p);
    }
    state.parts = state.parts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
    if (state.parts.length) requestAnimationFrame(tick);
    else {
      canvas.remove();
      active = null;
    }
  };
  requestAnimationFrame(tick);
}
