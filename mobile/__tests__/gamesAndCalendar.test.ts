// Game simulations and calendar helpers. The phone only plays/animates; rewards come from the server.
import { DURATION, newRound, rng, snapshot, step } from '@/features/games/catchEngine';
import { inTree, targetRotation } from '@/features/games/geometry';
import { appPathFor } from '@/features/games/hiddenLocations';
import { reminderDates } from '@/lib/notifications';

describe('catch game engine', () => {
  it('uses the same seeded RNG as the website (deterministic per server seed)', () => {
    const a = rng(12345);
    const b = rng(12345);
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    // LCG reference values: s = s * 1664525 + 1013904223 (mod 2^32)
    const first = ((12345 * 1664525 + 1013904223) >>> 0) / 4294967296;
    expect(seqA[0]).toBeCloseTo(first, 12);
  });

  it('a round lasts exactly the server duration and never scores below zero', () => {
    const g = newRound(42, 360, 600);
    let t = 0;
    while (step(g, 0.016)) t += 0.016;
    expect(t).toBeGreaterThan(DURATION - 0.1);
    expect(t).toBeLessThan(DURATION + 0.1);
    expect(g.score).toBeGreaterThanOrEqual(0);
    expect(snapshot(g).remaining).toBe(0);
  });

  it('caps a frame step at 50 ms so a stalled phone cannot fast-forward', () => {
    const g = newRound(1, 360, 600);
    step(g, 10);
    expect(g.elapsed).toBeCloseTo(0.05, 5);
  });

  it('catching with the sleigh under every gift scores like the website (+10 / +30 / −20)', () => {
    const g = newRound(7, 360, 600);
    let guard = 0;
    while (g.items.length === 0 && guard++ < 100) step(g, 0.05);
    const it = g.items[0];
    g.sleighX = it.x;
    while (g.items.includes(it) && guard++ < 1000) step(g, 0.016);
    const expected = it.kind === 'gold' ? 30 : it.kind === 'gift' ? 10 : 0;
    expect(g.score).toBe(expected);
  });
});

describe('tree and wheel geometry', () => {
  it('only accepts ornaments inside the tree outline', () => {
    expect(inTree(50, 50)).toBe(true);
    expect(inTree(5, 50)).toBe(false);
    expect(inTree(50, 5)).toBe(false);
    expect(inTree(50, 95)).toBe(false);
  });

  it('wheel lands the server-chosen segment under the pointer', () => {
    for (const [index, n] of [[0, 8], [3, 8], [7, 8], [2, 5]]) {
      const r = targetRotation(index, n, 123);
      const seg = 360 / n;
      const centreAfter = (((index * seg + seg / 2 + r) % 360) + 360) % 360;
      expect(centreAfter).toBeCloseTo(0, 6);
      expect(r).toBeGreaterThan(123);
    }
  });
});

describe('hidden wonders', () => {
  it('maps website locations to app screens', () => {
    expect(appPathFor('/shop')).toBe('/shop');
    expect(appPathFor('/academy?x=1')).toBe('/academy');
    expect(appPathFor('/games/hidden')).toBe('/games');
    expect(appPathFor('/')).toBe('/');
    expect(appPathFor('/nowhere')).toBeNull();
  });
});

describe('calendar reminders (local, opt-in)', () => {
  it('schedules only the remaining December days at 10:00', () => {
    const dates = reminderDates(new Date(2026, 11, 20, 12, 0));
    expect(dates[0]).toEqual(new Date(2026, 11, 21, 10, 0, 0));
    expect(dates).toHaveLength(11);
    expect(dates.every((d) => d.getMonth() === 11 && d.getHours() === 10)).toBe(true);
  });
  it('before December: all 31 days of this December', () => {
    expect(reminderDates(new Date(2026, 10, 5))).toHaveLength(31);
  });
  it('after the 31st: next December', () => {
    const d = reminderDates(new Date(2026, 11, 31, 22));
    expect(d[0].getFullYear()).toBe(2027);
  });
});
