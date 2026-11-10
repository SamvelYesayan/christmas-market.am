// Catch the Falling Gifts — the round simulation, identical to the website's (same seeded RNG, spawn rate, speeds
// and scoring), so a phone round is judged exactly like a browser round by the server's plausibility checks.
export const DURATION = 45;

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export type Kind = 'gift' | 'gold' | 'coal';
export interface Item { id: number; x: number; y: number; vy: number; rot: number; vr: number; s: number; kind: Kind; color: string }
export interface Pop { id: number; x: number; y: number; t: number; text: string; good: boolean }

export interface Round {
  rand: () => number;
  W: number;
  H: number;
  sleighX: number;
  sleighW: number;
  sleighY: number;
  items: Item[];
  pops: Pop[];
  spawn: number;
  elapsed: number;
  score: number;
  catches: number;
  seq: number;
}

export function newRound(seed: number, W: number, H: number): Round {
  return { rand: rng(seed), W, H, sleighX: W / 2, sleighW: Math.max(70, W * 0.12), sleighY: H - 46, items: [], pops: [], spawn: 0, elapsed: 0, score: 0, catches: 0, seq: 0 };
}

const COLORS = ['#c8102e', '#0f6b4f', '#2a4fa8', '#7a2a1e'];

/** Advance the round by dt seconds. Returns true while the round is still running. */
export function step(g: Round, dtRaw: number): boolean {
  const dt = Math.min(0.05, dtRaw);
  g.elapsed += dt;
  const difficulty = 1 + g.elapsed / 30;
  g.spawn -= dt;
  if (g.spawn <= 0) {
    const r = g.rand();
    g.items.push({
      id: ++g.seq, x: 20 + g.rand() * (g.W - 40), y: -20, vy: (110 + g.rand() * 90) * difficulty, rot: 0, vr: (g.rand() - 0.5) * 3, s: 22 + g.rand() * 10,
      kind: r < 0.08 ? 'gold' : r < 0.25 ? 'coal' : 'gift', color: COLORS[Math.floor(g.rand() * 4)],
    });
    g.spawn = 0.55 / difficulty;
  }
  for (let k = g.items.length - 1; k >= 0; k--) {
    const it = g.items[k];
    it.y += it.vy * dt;
    it.rot += it.vr * dt;
    const hit = it.y > g.sleighY - 20 && it.y < g.sleighY + 10 && Math.abs(it.x - g.sleighX) < g.sleighW / 2 + it.s / 3;
    if (hit) {
      const pts = it.kind === 'gold' ? 30 : it.kind === 'coal' ? -20 : 10;
      g.score = Math.max(0, g.score + pts);
      if (pts > 0) g.catches += 1;
      g.pops.push({ id: ++g.seq, x: it.x, y: it.y, t: 1, text: pts > 0 ? `+${pts}` : `${pts}`, good: pts > 0 });
      g.items.splice(k, 1);
      continue;
    }
    if (it.y > g.H + 30) g.items.splice(k, 1);
  }
  for (let k = g.pops.length - 1; k >= 0; k--) {
    const p = g.pops[k];
    p.t -= dt * 1.5;
    p.y -= 40 * dt;
    if (p.t <= 0) g.pops.splice(k, 1);
  }
  return g.elapsed < DURATION;
}

export const moveSleigh = (g: Round, x: number) => {
  g.sleighX = Math.max(g.sleighW / 2, Math.min(g.W - g.sleighW / 2, x));
};

/** Immutable copy of what the screen draws (render never reads the mutable round). */
export interface Snapshot { items: Item[]; pops: Pop[]; sleighX: number; sleighW: number; sleighY: number; score: number; remaining: number }
export const snapshot = (g: Round): Snapshot => ({
  items: g.items.map((i) => ({ ...i })),
  pops: g.pops.map((p) => ({ ...p })),
  sleighX: g.sleighX,
  sleighW: g.sleighW,
  sleighY: g.sleighY,
  score: g.score,
  remaining: Math.max(0, Math.ceil(DURATION - g.elapsed)),
});
